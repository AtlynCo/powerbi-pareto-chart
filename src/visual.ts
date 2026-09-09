import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { valueFormatter } from "powerbi-visuals-utils-formattingutils";
import { analyze, contributionProblem, InputRow, ParetoModel, RankedRow } from "./model";
import { Binding, canonicalCategory, getBinding, MAX_CATEGORIES, SegmentTracker } from "./data";
import { boundedNumber, safeColor, VisualFormattingSettingsModel } from "./settings";
import { localize, TextKey } from "./localization";
import notices from "./third-party-notices.json";
import "../style/visual.less";

type Host = powerbi.extensibility.visual.IVisualHost;
type Update = powerbi.extensibility.visual.VisualUpdateOptions;
type SelectionId = powerbi.visuals.ISelectionId;
const NS = "http://www.w3.org/2000/svg";

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number> = {}, text?: string): SVGElementTagNameMap[K] {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    if (text !== undefined) node.textContent = text;
    return node;
}

function isSelectionId(id: powerbi.extensibility.ISelectionId): id is SelectionId {
    return "getKey" in id && typeof id.getKey === "function";
}

function on<K extends keyof HTMLElementEventMap>(target: EventTarget, name: K, listener: (event: HTMLElementEventMap[K]) => void): void {
    target.addEventListener(name, listener as EventListener);
}

export class Visual implements powerbi.extensibility.visual.IVisual {
    private readonly host: Host;
    private readonly root: HTMLElement;
    private readonly localization: powerbi.extensibility.ILocalizationManager;
    private readonly selection: powerbi.extensibility.ISelectionManager;
    private readonly formats: FormattingSettingsService;
    private readonly textContext: CanvasRenderingContext2D;
    private readonly segments = new SegmentTracker();
    private settings = new VisualFormattingSettingsModel();
    private view?: powerbi.DataView;
    private binding?: Binding;
    private model?: ParetoModel;
    private inputRows: InputRow[] = [];
    private modelPrepared = false;
    private tailIssues = { missing: 0, invalid: 0, negative: 0 };
    private identities: SelectionId[] = [];
    private options?: Update;
    private page = 0;
    private startRank = 1;
    private focusedKey?: string;
    private focusedTable = false;
    private destroyed = false;
    private hasHighlights = false;
    private hasLongLabels = false;
    private sharesVisible = false;
    private universe = "";

    constructor(options?: powerbi.extensibility.visual.VisualConstructorOptions) {
        if (!options) throw new Error("Power BI constructor options are required.");
        this.host = options.host;
        this.localization = this.host.createLocalizationManager();
        this.selection = this.host.createSelectionManager();
        this.formats = new FormattingSettingsService(this.localization);
        const textContext = document.createElement("canvas").getContext("2d");
        if (!textContext) throw new Error("Text measurement is unavailable.");
        this.textContext = textContext;
        this.root = element("div", "atlyn-pareto");
        this.root.tabIndex = 0;
        this.root.setAttribute("role", "region");
        this.root.setAttribute("aria-label", this.t("Title"));
        this.root.dir = /^(ar|fa|he|ur)(-|$)/i.test(this.host.locale) ? "rtl" : "ltr";
        options.element.appendChild(this.root);
        this.selection.registerOnSelectCallback(() => {
            if (!this.destroyed) this.syncSelection();
        });
        on(this.root, "keydown", event => {
            if (event.key === "Escape" && !event.defaultPrevented) {
                event.preventDefault();
                this.clearSelection();
            }
        });
        on(this.root, "click", event => {
            if (event.target === this.root) this.clearSelection();
        });
        on(this.root, "contextmenu", event => {
            if (event.defaultPrevented) return;
            event.preventDefault();
            if (!this.interactionsAllowed) return;
            this.selection.showContextMenu({}, { x: event.clientX, y: event.clientY }).then(
                () => undefined, error => this.interactionFailed(error)
            );
        });
    }

    public update(options: Update): void {
        this.host.eventService.renderingStarted(options);
        try {
            const active = document.activeElement;
            const focusedIndex = this.root.contains(active) ? active?.getAttribute("data-row-index") : null;
            this.focusedKey = focusedIndex === null ? undefined : this.identities[Number(focusedIndex)]?.getKey();
            this.focusedTable = active instanceof HTMLButtonElement;
            const scrollTop = this.root.scrollTop;
            this.options = options;
            this.host.tooltipService.hide({ immediately: true, isTouchEvent: false });
            const hasDataUpdate = (options.type & powerbi.VisualUpdateType.Data) !== 0 || !this.view;
            if (hasDataUpdate) {
                this.view = options.dataViews?.[0];
                this.binding = this.view ? getBinding(this.view) : undefined;
                if (this.binding && this.view) {
                    this.segments.accept(
                        this.binding.category.values.length,
                        this.view.metadata.segment != null,
                        options.operationKind,
                        () => typeof this.host.fetchMoreData === "function" && this.host.fetchMoreData(true)
                    );
                } else {
                    this.segments.reset();
                }
            } else if (options.dataViews?.[0]) {
                // A resize/style update is not another segment. Retain the cached
                // categorical data while accepting native formatting/bookmark metadata.
                this.view = { ...this.view, metadata: options.dataViews[0].metadata };
                const incoming = getBinding(options.dataViews[0]);
                if (incoming && this.binding) {
                    if (valueFormatter.getFormatStringByColumn(incoming.category.source) !== valueFormatter.getFormatStringByColumn(this.binding.category.source)) this.modelPrepared = false;
                    this.binding = {
                        category: { ...this.binding.category, source: incoming.category.source },
                        contribution: { ...this.binding.contribution, source: incoming.contribution.source },
                        tooltips: this.binding.tooltips.map((column, index) => ({ ...column, source: incoming.tooltips[index]?.source ?? column.source }))
                    };
                }
            }
            this.settings = this.view
                ? this.formats.populateFormattingSettingsModel(VisualFormattingSettingsModel, this.view)
                : new VisualFormattingSettingsModel();
            this.settings.analysis.threshold.value = boundedNumber(this.settings.analysis.threshold.value, 80, 1, 100);
            this.settings.analysis.pageSize.value = Math.round(boundedNumber(this.settings.analysis.pageSize.value, 30, 10, 100));
            this.settings.analysis.startRank.value = Math.round(boundedNumber(this.settings.analysis.startRank.value, 1, 1, MAX_CATEGORIES));
            this.settings.appearance.fontSize.value = boundedNumber(this.settings.appearance.fontSize.value, 12, 10, 24);
            if (this.settings.analysis.partialPolicy.value !== "subset") this.settings.analysis.partialPolicy.value = "withhold";
            if (hasDataUpdate || (options.type & powerbi.VisualUpdateType.Style) !== 0) {
                this.startRank = this.settings.analysis.startRank.value;
            } else {
                this.settings.analysis.startRank.value = this.startRank;
            }
            if (hasDataUpdate || !this.modelPrepared) this.prepareModel();
            else if (this.model?.threshold !== this.settings.analysis.threshold.value) {
                if (this.binding) this.analyzeModel();
                else this.model = undefined;
            }
            this.render();
            if (!hasDataUpdate) this.root.scrollTop = scrollTop;
            else if (options.operationKind !== powerbi.VisualDataChangeOperationKind.Append) this.root.scrollTop = 0;
            this.host.eventService.renderingFinished(options);
        } catch (error) {
            this.root.replaceChildren();
            this.root.scrollTop = 0;
            this.applyViewport();
            this.root.setAttribute("aria-label", `${this.t("Title")}. ${this.t("Failure")}`);
            this.message(this.t("Failure"), "message error");
            this.host.eventService.renderingFailed(options, String(error));
            console.warn("Atlyn Pareto render failed", error);
        }
    }

    private prepareModel(): void {
        this.modelPrepared = false;
        this.identities = [];
        this.inputRows = [];
        this.hasLongLabels = false;
        this.tailIssues = { missing: 0, invalid: 0, negative: 0 };
        this.model = undefined;
        if (!this.binding) {
            this.modelPrepared = true;
            return;
        }
        const { category, contribution } = this.binding;
        if (contribution.values.length !== category.values.length ||
            (category.values.length > 0 && (!category.identity || category.identity.length !== category.values.length))) {
            throw new Error("Category identities and contribution rows must have matching lengths.");
        }
        this.hasHighlights = contribution.highlights !== undefined;
        const identityKeys = new Set<string>();
        this.inputRows = category.values.slice(0, MAX_CATEGORIES).map((value, index) => {
            const identity = this.host.createSelectionIdBuilder().withCategory(category, index).createSelectionId();
            const key = identity.getKey();
            if (identityKeys.has(key)) throw new Error("Duplicate category identities in the aggregated data view.");
            identityKeys.add(key);
            this.identities[index] = identity;
            return {
                index, key, sortKey: canonicalCategory(value),
                label: typeof value === "string" ? value : value == null ? this.t("Blank") : this.format(value, category.source),
                value: contribution.values[index],
                highlight: contribution.highlights?.[index]
            };
        });
        this.hasLongLabels = this.inputRows.some(row => row.label.length > 24);
        // The ranking/identity bound is not permission to conceal a known
        // invalid contribution elsewhere in the host's received view.
        for (let index = MAX_CATEGORIES; index < contribution.values.length; index++) {
            const problem = contributionProblem(contribution.values[index]);
            if (problem) this.tailIssues[problem]++;
        }
        this.analyzeModel();
        this.modelPrepared = true;
    }

    private analyzeModel(): void {
        this.model = analyze(this.inputRows, this.settings.analysis.threshold.value);
        const tail = this.tailIssues;
        if (tail.missing || tail.invalid || tail.negative) {
            this.model = {
                ...this.model, kind: "invalid", rows: [], total: undefined, crossingRank: undefined, includedCount: 0, overflow: false,
                issues: {
                    ...this.model.issues,
                    missing: this.model.issues.missing + tail.missing,
                    invalid: this.model.issues.invalid + tail.invalid,
                    negative: this.model.issues.negative + tail.negative
                }
            };
        }
    }

    private render(): void {
        if (!this.options) return;
        const detailsOpen = this.root.querySelector<HTMLDetailsElement>(".analysis-details")?.open ?? false;
        const legalOpen = this.root.querySelector<HTMLDetailsElement>(".third-party-notices")?.open ?? false;
        const appearance = this.settings.appearance;
        const palette = this.host.colorPalette;
        this.root.style.setProperty("--text", palette.isHighContrast ? palette.foreground.value : "#182D3D");
        this.root.style.setProperty("--background", palette.isHighContrast ? palette.background.value : "#FFFFFF");
        this.root.style.setProperty("--focus", palette.isHighContrast ? palette.foregroundSelected.value : "#005FCC");
        this.root.style.fontSize = `${boundedNumber(appearance.fontSize.value, 12, 10, 24)}px`;
        this.applyViewport();
        this.root.replaceChildren();
        this.root.setAttribute("aria-label", this.t("Title"));
        this.root.appendChild(element("h2", "title", this.t("Title")));
        if (this.micro) {
            const state = !this.binding ? "BindCompact" : this.model?.kind === "invalid" ? "InvalidCompact" :
                this.segments.status !== "complete" ? "IncompleteCompact" : this.model?.kind === "zero" ? "ZeroCompact" : undefined;
            if (state) {
                this.message(this.t(state), `message ${this.model?.kind === "invalid" ? "error" : ""}`);
                this.root.setAttribute("aria-label", `${this.t("Title")}. ${this.t(state)}. ${this.t("Small")}`);
            } else if (this.model?.kind === "empty") {
                this.message(this.t("Empty"));
                this.root.setAttribute("aria-label", `${this.t("Title")}. ${this.t("Empty")}. ${this.t("Small")}`);
            } else if (this.model && this.binding) {
                const total = this.format(this.model.total, this.binding.contribution.source);
                const metric = element("p", "total", this.formatAxis(this.model.total ?? 0, this.binding.contribution.source));
                metric.title = total;
                this.root.appendChild(metric);
                this.message(this.t("CountsCompact", this.number(this.model.rows.length)), "counts");
                this.root.setAttribute("aria-label", `${this.t("Title")}. ${this.t("Total")}: ${total}. ${this.t("Complete")}. ${this.t("Small")}`);
            }
            return;
        }
        const legal = element("details", "third-party-notices");
        legal.open = legalOpen;
        legal.append(
            element("summary", undefined, this.t("Notices")),
            element("pre", undefined, notices.components.map(item => `${item.name} ${item.version}\n\n${item.license}`).join("\n\n"))
        );
        if (!this.binding || !this.model) {
            const columns = this.view?.metadata.columns ?? [];
            const category = columns.some(column => column.roles?.Category);
            const contribution = columns.some(column => column.roles?.Contribution);
            const metadataOnly = category && contribution && !this.view?.categorical;
            this.message(this.t(metadataOnly ? "NoRowsDelivered" : category && !contribution ? "BindContribution" : contribution && !category ? "BindCategory" : "Bind"));
            this.root.appendChild(legal);
            return;
        }
        const model = this.model;
        const complete = this.segments.status === "complete";
        this.sharesVisible = model.kind === "ready" && (complete || this.settings.analysis.partialPolicy.value === "subset");
        this.universe = this.t(complete ? "Complete" : this.sharesVisible ? "Subset" : "Withhold");
        const banner = element("p", complete ? "universe" : "universe warning",
            this.t(complete ? "CompleteBrief" : this.sharesVisible ? "SubsetBrief" : "WithholdBrief", this.number(Math.min(this.binding.category.values.length, MAX_CATEGORIES))));
        banner.setAttribute("role", "status");
        banner.title = this.universe;
        this.root.appendChild(banner);
        const statusKeys: Record<string, TextKey> = {
            loading: "Loading", refused: "Refused", limit: "Limit", stalled: "Stalled", unexpected: "Unexpected"
        };
        if (!complete) this.message(this.t(statusKeys[this.segments.status]), "retrieval warning");
        const details = element("details", "analysis-details");
        details.open = detailsOpen;
        details.appendChild(element("summary", undefined, this.t("Details")));
        this.message(this.universe, "scope-detail", details);
        this.message(this.t("Counts", this.number(Math.min(this.binding.category.values.length, MAX_CATEGORIES)),
            this.number(this.binding.category.values.length)), "counts", details);
        this.message(this.t(complete ? "Excluded" : "Limited"), "exclusions", details);
        if (model.kind === "empty") {
            this.message(this.t("Empty"));
            this.root.append(details, legal);
            return;
        }
        if (model.kind === "invalid") {
            this.message(this.t(model.overflow ? "Overflow" : "Invalid"), "message error");
            this.message(`${this.t("Missing")}: ${model.issues.missing}; ${this.t("InvalidNumber")}: ${model.issues.invalid}; ${this.t("Negative")}: ${model.issues.negative}`, "invalid-counts");
            this.root.append(details, legal);
            return;
        }
        if (model.kind === "zero") this.message(this.t("Zero"), "message warning");
        if (complete || this.sharesVisible) {
            this.message(`${this.t("Total")}: ${this.format(model.total, this.binding.contribution.source)}`, "total");
        }
        if (this.sharesVisible) {
            const summary = element("p", "threshold-summary", this.t("ThresholdBrief", this.percent(model.threshold / 100), this.number(model.includedCount), this.number(model.rows.length)));
            summary.title = this.t("ThresholdSummary", this.percent(model.threshold / 100), this.number(model.includedCount), this.number(model.rows.length));
            const swatch = element("span", "threshold-swatch");
            swatch.setAttribute("aria-hidden", "true");
            swatch.style.borderTopColor = this.cumulativeColor;
            summary.prepend(swatch);
            this.root.appendChild(summary);
        }
        if (this.hasHighlights) this.message(this.t("Highlights"), "highlight-note");
        if (model.issues.invalidHighlight) this.message(this.t("InvalidHighlight", model.issues.invalidHighlight), "warning");
        const pageSize = this.pageSize;
        this.startRank = Math.min(this.startRank, Math.max(1, model.rows.length));
        this.settings.analysis.startRank.value = this.startRank;
        this.page = Math.min(Math.floor((this.startRank - 1) / pageSize), Math.max(0, Math.ceil(model.rows.length / pageSize) - 1));
        const rows = model.rows.slice(this.page * pageSize, (this.page + 1) * pageSize);
        if (model.rows.length > pageSize && this.sharesVisible && !this.compact) this.renderOverview();
        this.renderChart(rows);
        const toolbar = element("div", "toolbar");
        const pageLabel = element("span", "page-label", this.t("PageBrief", this.number(rows[0].rank), this.number(rows[rows.length - 1].rank), this.number(model.rows.length)));
        pageLabel.dir = "ltr";
        toolbar.append(
            this.button(this.t("Previous"), () => this.changePage(-1), this.page === 0),
            pageLabel,
            this.button(this.t("Next"), () => this.changePage(1), (this.page + 1) * pageSize >= model.rows.length),
            this.button(this.t("Clear"), () => this.clearSelection(), !this.interactionsAllowed)
        );
        this.root.appendChild(toolbar);
        if (model.rows.length > pageSize) this.renderRankNavigation();
        this.message(this.t("Paging", rows[0].rank, rows[rows.length - 1].rank, this.number(model.rows.length)), "page-scope", details);
        this.message(this.t("Keyboard"), "keyboard-help", details);
        if (this.sharesVisible) this.message(this.t("Convention"), "legend", details);
        this.message(this.t("NoOther"), "paging-note", details);
        this.root.appendChild(details);
        if (appearance.showTable.value) this.renderTable(rows);
        this.root.appendChild(legal);
        this.syncSelection();
        if (this.focusedKey) {
            const index = this.inputRows.find(row => row.key === this.focusedKey)?.index;
            const selector = this.focusedTable ? ".category-button" : ".bar-target";
            if (index !== undefined) this.root.querySelector<HTMLElement | SVGElement>(`${selector}[data-row-index="${index}"]`)?.focus();
        }
    }

    private renderChart(rows: RankedRow[]): void {
        if (!this.model || !this.binding || !this.options) return;
        const palette = this.host.colorPalette;
        const highContrast = palette.isHighContrast;
        const foreground = highContrast ? palette.foreground.value : "#182D3D";
        const background = highContrast ? palette.background.value : "#FFFFFF";
        const bar = highContrast ? foreground : safeColor(this.settings.appearance.barColor.value.value, "#7895B2");
        const included = highContrast ? foreground : safeColor(this.settings.appearance.thresholdColor.value.value, "#176B78");
        const line = this.cumulativeColor;
        const font = this.compact ? 10 : boundedNumber(this.settings.appearance.fontSize.value, 12, 10, 24);
        const labelLineHeight = Math.ceil(font * 1.5);
        const { left, right, width } = this.chartDimensions;
        const preferredHeight = this.compact ? Math.max(115, Math.min(215, this.options.viewport.height - 108)) :
            Math.max(210, Math.min(350, this.options.viewport.height - (this.model.rows.length > this.pageSize ? 300 : 235)));
        const valueTitleY = font + (this.compact ? 1 : 3);
        const percentTitleY = valueTitleY + labelLineHeight;
        const top = percentTitleY + Math.ceil(font / 2) + 3;
        const labelSpace = labelLineHeight * 3 + 8;
        const height = Math.max(preferredHeight, top + labelLineHeight * 2 + labelSpace);
        const bottom = height - labelSpace;
        const plotHeight = bottom - top;
        const plotWidth = width - left - right;
        const band = plotWidth / rows.length;
        const maximum = this.model.rows[0]?.value || 1;
        const x = (index: number) => left + band * (index + 0.5);
        const yValue = (value: number) => bottom - (value / maximum) * plotHeight;
        const yShare = (value: number) => bottom - value * plotHeight;
        const scroller = element("div", "chart-scroll");
        scroller.tabIndex = 0;
        scroller.setAttribute("aria-label", this.t("Title"));
        const chart = svg("svg", { width, height, viewBox: `0 0 ${width} ${height}`, role: "group", "aria-label": this.t("Title") });
        chart.style.fontSize = `${font}px`;
        chart.append(
            svg("text", { x: left, y: valueTitleY, fill: foreground, class: "value-axis-title" }, this.truncate(this.binding.contribution.source.displayName, Math.max(8, Math.floor(plotWidth / (font * 0.62))))),
            svg("line", { x1: left, x2: left, y1: top, y2: bottom, stroke: foreground }),
            svg("line", { x1: left, x2: width - right, y1: bottom, y2: bottom, stroke: foreground })
        );
        if (this.sharesVisible) {
            chart.append(
                svg("text", { x: width - right, y: percentTitleY, "text-anchor": "end", fill: line, class: "percent-axis-title" }, this.t("CumulativeShare")),
                svg("line", { x1: width - right, x2: width - right, y1: top, y2: bottom, stroke: line })
            );
        }
        const tickCount = this.compact || plotHeight < (font + 6) * 4 ? 2 : 4;
        for (let tick = 0; tick <= tickCount; tick++) {
            const fraction = tick / tickCount;
            const y = yShare(fraction);
            chart.append(
                svg("line", { x1: left, x2: width - right, y1: y, y2: y, stroke: foreground, "stroke-opacity": 0.18 }),
                svg("text", { x: left - 5, y: y + 4, "text-anchor": "end", fill: foreground, class: "value-tick" }, this.formatAxis(maximum * fraction, this.binding.contribution.source))
            );
            if (this.sharesVisible) chart.append(svg("text", { x: width - right + 5, y: y + 4, fill: line, class: "percent-tick" }, this.percent(fraction)));
        }
        rows.forEach((row, i) => {
            const group = svg("g", { class: "bar-target", role: "button", tabindex: i === 0 ? 0 : -1, "data-row-index": row.index, "aria-label": this.rowLabel(row), "aria-pressed": "false" });
            const fill = this.sharesVisible && row.included ? included : bar;
            group.append(
                svg("rect", { x: x(i) - band * 0.4, y: top, width: band * 0.8, height: plotHeight + 20, fill: "transparent", class: "hit-target" }),
                svg("rect", { x: x(i) - band * 0.34, y: yValue(row.value), width: band * 0.68, height: Math.max(row.value === 0 ? 1 : 0, bottom - yValue(row.value)), fill, "fill-opacity": this.hasHighlights ? 0.3 : 1, stroke: fill, class: "contribution-bar" })
            );
            if (row.highlight !== undefined) {
                group.append(svg("rect", { x: x(i) - band * 0.2, y: yValue(row.highlight), width: band * 0.4, height: bottom - yValue(row.highlight), fill, class: "highlight-bar" }));
            }
            group.append(svg("text", { x: x(i), y: bottom + labelLineHeight, "text-anchor": "middle", fill: foreground, class: "rank-label" }, `${this.number(row.rank)}${this.sharesVisible && row.included ? "*" : ""}`));
            const categoryText = svg("text", { x: x(i), y: bottom + labelLineHeight * 2, "text-anchor": "middle", fill: foreground, class: "category-label" });
            const lines = this.categoryLines(row.label, band - 6, font);
            lines.forEach((text, index) => categoryText.appendChild(svg("tspan", { x: x(i), dy: index === 0 ? 0 : labelLineHeight }, text)));
            categoryText.appendChild(svg("title", {}, row.label));
            group.appendChild(categoryText);
            this.bindInteractions(group, row, true);
            chart.appendChild(group);
        });
        if (this.sharesVisible) {
            const y = yShare(this.model.threshold / 100);
            const thresholdAttributes = { x1: left, x2: width - right, y1: y, y2: y, "stroke-dasharray": "5 4", "pointer-events": "none" };
            const thresholdLine = svg("line", { ...thresholdAttributes, stroke: line, class: "threshold-line" });
            thresholdLine.appendChild(svg("title", {}, `${this.t("Threshold")} ${this.percent(this.model.threshold / 100)}`));
            chart.append(
                svg("line", { ...thresholdAttributes, stroke: background, "stroke-width": 3, "aria-hidden": "true" }),
                thresholdLine
            );
            const path = rows.map((row, i) => `${i ? "L" : "M"} ${x(i)} ${yShare(row.cumulativeShare)}`).join(" ");
            chart.appendChild(svg("path", { d: path, fill: "none", stroke: background, "stroke-width": 5.5, "aria-hidden": "true", class: "cumulative-halo", "pointer-events": "none" }));
            chart.appendChild(svg("path", { d: path, fill: "none", stroke: line, "stroke-width": 2.5, class: "cumulative-line", "pointer-events": "none" }));
            rows.forEach((row, i) => {
                chart.appendChild(svg("circle", { cx: x(i), cy: yShare(row.cumulativeShare), r: row.crossing ? 5 : 3, fill: line, stroke: background, "stroke-width": 1.5, class: row.crossing ? "crossing-point" : "cumulative-point", "pointer-events": "none" }));
                if (row.crossing) chart.appendChild(svg("text", { x: x(i) + 7, y: yShare(row.cumulativeShare) - 7, fill: line, "pointer-events": "none" }, "X"));
            });
        }
        scroller.appendChild(chart);
        this.root.appendChild(scroller);
    }

    private renderTable(rows: RankedRow[]): void {
        if (!this.binding) return;
        const scroller = element("div", "table-scroll");
        scroller.tabIndex = 0;
        scroller.setAttribute("aria-label", this.t("Table"));
        const table = element("table", "data-table");
        table.appendChild(element("caption", undefined, this.t("Table")));
        const header = element("tr");
        [this.t("Rank"), this.binding.category.source.displayName, this.binding.contribution.source.displayName,
            this.t("CumulativeValue"), this.t("CumulativeShare"), this.t("Threshold")].forEach(label => {
            const th = element("th", undefined, label);
            th.scope = "col";
            header.appendChild(th);
        });
        const head = element("thead");
        head.appendChild(header);
        table.appendChild(head);
        const body = element("tbody");
        rows.forEach(row => {
            const tr = element("tr");
            tr.appendChild(element("td", undefined, this.number(row.rank)));
            const category = element("td");
            const button = element("button", "category-button", row.label);
            button.type = "button";
            button.dataset.rowIndex = String(row.index);
            button.setAttribute("aria-label", this.rowLabel(row));
            this.bindInteractions(button, row, false);
            category.appendChild(button);
            tr.append(
                category,
                element("td", undefined, this.format(row.value, this.binding!.contribution.source)),
                element("td", undefined, this.sharesVisible ? this.format(row.cumulative, this.binding!.contribution.source) : this.t("Unavailable")),
                element("td", undefined, this.sharesVisible ? this.percent(row.cumulativeShare) : this.t("Unavailable")),
                element("td", undefined, this.sharesVisible ? this.t(row.crossing ? "Crossing" : row.included ? "Included" : "After") : this.t("Unavailable"))
            );
            body.appendChild(tr);
        });
        table.appendChild(body);
        scroller.appendChild(table);
        this.root.appendChild(scroller);
    }

    private tooltip(row: RankedRow): powerbi.extensibility.VisualTooltipDataItem[] {
        if (!this.binding || !this.model) return [];
        const data = [
            { displayName: this.binding.category.source.displayName, value: row.label },
            { displayName: this.t("Rank"), value: this.number(row.rank) },
            { displayName: this.binding.contribution.source.displayName, value: this.format(row.value, this.binding.contribution.source) },
            { displayName: this.t("Universe"), value: this.universe },
            { displayName: this.t("Total"), value: this.sharesVisible || this.segments.status === "complete" ? this.format(this.model.total, this.binding.contribution.source) : this.t("Unavailable") },
            { displayName: this.t("Share"), value: this.sharesVisible ? this.percent(row.share) : this.t("Unavailable") },
            { displayName: this.t("CumulativeValue"), value: this.sharesVisible ? this.format(row.cumulative, this.binding.contribution.source) : this.t("Unavailable") },
            { displayName: this.t("CumulativeShare"), value: this.sharesVisible ? this.percent(row.cumulativeShare) : this.t("Unavailable") },
            { displayName: this.t("Threshold"), value: this.sharesVisible ? this.t(row.crossing ? "Crossing" : row.included ? "Included" : "After") : this.t("Unavailable") }
        ];
        if (row.highlight !== undefined) data.push({ displayName: this.t("HighlightedValue"), value: this.format(row.highlight, this.binding.contribution.source) });
        for (const column of this.binding.tooltips.slice(0, 5)) {
            data.push({ displayName: column.source.displayName, value: this.format(column.values[row.index], column.source) });
        }
        return data;
    }

    private bindInteractions(target: SVGElement | HTMLButtonElement, row: RankedRow, chart: boolean): void {
        const identity = this.identities[row.index];
        target.setAttribute("aria-disabled", String(!this.interactionsAllowed));
        on(target, "click", event => {
            event.stopPropagation();
            if (!this.interactionsAllowed) return;
            this.selection.select(identity, event.ctrlKey || event.metaKey).then(
                () => this.syncSelection(), error => this.interactionFailed(error)
            );
        });
        on(target, "contextmenu", event => {
            event.preventDefault();
            this.contextMenu(identity, event.clientX, event.clientY);
        });
        on(target, "pointerenter", event => {
            if (this.host.tooltipService.enabled()) {
                this.host.tooltipService.show({ coordinates: [event.clientX, event.clientY], isTouchEvent: event.pointerType === "touch", dataItems: this.tooltip(row), identities: [identity] });
            }
        });
        on(target, "pointermove", event => {
            if (this.host.tooltipService.enabled()) this.host.tooltipService.move({ coordinates: [event.clientX, event.clientY], isTouchEvent: event.pointerType === "touch", identities: [identity] });
        });
        on(target, "pointerleave", () => this.hideTooltip());
        on(target, "focus", () => {
            const bounds = target.getBoundingClientRect();
            if (this.host.tooltipService.enabled()) this.host.tooltipService.show({ coordinates: [bounds.x + bounds.width / 2, bounds.y], isTouchEvent: false, dataItems: this.tooltip(row), identities: [identity] });
        });
        on(target, "blur", () => this.hideTooltip());
        on(target, "keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                if (!this.interactionsAllowed) return;
                this.selection.select(identity, event.ctrlKey || event.metaKey).then(
                    () => this.syncSelection(), error => this.interactionFailed(error)
                );
            } else if (event.key === "Escape") {
                event.preventDefault();
                this.clearSelection();
            } else if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) {
                event.preventDefault();
                const bounds = target.getBoundingClientRect();
                this.contextMenu(identity, bounds.x, bounds.y);
            } else if (chart && ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
                event.preventDefault();
                const bars = Array.from(this.root.querySelectorAll<SVGElement>(".bar-target"));
                const current = bars.findIndex(bar => bar === target);
                const destination = event.key === "Home" ? 0 : event.key === "End" ? bars.length - 1 :
                    Math.max(0, Math.min(bars.length - 1, current + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1)));
                bars.forEach((bar, index) => bar.setAttribute("tabindex", index === destination ? "0" : "-1"));
                bars[destination].focus();
            }
        });
    }

    private syncSelection(): void {
        if (this.destroyed) return;
        const selected = this.selection.getSelectionIds().filter(isSelectionId);
        const keys = new Set(selected.map(id => id.getKey()));
        this.root.querySelectorAll<HTMLElement | SVGElement>("[data-row-index]").forEach(node => {
            const identity = this.identities[Number(node.dataset.rowIndex)];
            const chosen = !!identity && (keys.has(identity.getKey()) || selected.some(id => id.includes(identity)));
            node.setAttribute("aria-pressed", String(chosen));
            node.classList.toggle("is-selected", chosen);
            node.classList.toggle("is-dimmed", keys.size > 0 && !chosen);
        });
    }

    private rowLabel(row: RankedRow): string {
        return this.tooltip(row).map(item => `${item.displayName}: ${item.value}`).join(". ");
    }

    private contextMenu(identity: SelectionId, x: number, y: number): void {
        if (!this.interactionsAllowed) return;
        this.hideTooltip();
        this.selection.showContextMenu(identity, { x, y }).then(() => undefined, error => this.interactionFailed(error));
    }

    private clearSelection(): void {
        if (!this.interactionsAllowed) return;
        this.selection.clear().then(() => this.syncSelection(), error => this.interactionFailed(error));
    }

    private interactionFailed(error: unknown): void {
        if (this.destroyed) return;
        this.message(this.t("InteractionFailure"), "message error");
        console.warn("Atlyn Pareto host interaction failed", error);
    }

    private changePage(delta: number): void {
        this.changeRank((this.page + delta) * this.pageSize + 1);
    }

    private changeRank(rank: number): void {
        if (!this.options) return;
        this.host.eventService.renderingStarted(this.options);
        try {
            this.startRank = Math.round(boundedNumber(rank, 1, 1, this.model?.rows.length || 1));
            this.settings.analysis.startRank.value = this.startRank;
            if (this.interactionsAllowed) {
                this.host.persistProperties({
                    merge: [{ objectName: "analysis", selector: {}, properties: { startRank: this.startRank } }]
                });
            }
            this.focusedKey = undefined;
            this.hideTooltip();
            this.render();
            this.root.querySelector<SVGElement>(".bar-target")?.focus();
            this.host.eventService.renderingFinished(this.options);
        } catch (error) {
            this.message(this.t("Failure"), "message error");
            this.host.eventService.renderingFailed(this.options, String(error));
        }
    }

    private button(label: string, click: () => void, disabled = false): HTMLButtonElement {
        const button = element("button", undefined, label);
        button.type = "button";
        button.disabled = disabled;
        button.addEventListener("click", click);
        return button;
    }

    private message(text: string, className = "message", target = this.root): void {
        const message = element("p", className, text);
        if (className.includes("error")) message.setAttribute("role", "alert");
        if (className.includes("universe")) message.setAttribute("role", "status");
        target.appendChild(message);
    }

    private format(value: powerbi.PrimitiveValue | undefined, source: powerbi.DataViewMetadataColumn): string {
        if (value === null || value === undefined) return this.t("Blank");
        return valueFormatter.format(value, valueFormatter.getFormatStringByColumn(source), false, this.host.locale);
    }

    private formatAxis(value: number, source: powerbi.DataViewMetadataColumn): string {
        const formatted = this.format(value, source);
        const digits = formatted.replace(/\D/g, "");
        if (formatted.length <= (this.compact ? 7 : 12) && (value === 0 || /[1-9]/.test(digits))) return formatted;
        return new Intl.NumberFormat(this.host.locale, {
            notation: Math.abs(value) >= 1e15 || (value !== 0 && Math.abs(value) < 1e-4) ? "scientific" : "compact",
            maximumSignificantDigits: 3
        }).format(value);
    }

    private get compact(): boolean {
        return !!this.options && (this.options.viewport.width < 500 || this.options.viewport.height < 300);
    }

    private get cumulativeColor(): string {
        return this.host.colorPalette.isHighContrast ? this.host.colorPalette.foregroundSelected.value :
            safeColor(this.settings.appearance.lineColor.value.value, "#B24C16");
    }

    private applyViewport(): void {
        if (!this.options) return;
        this.root.style.width = `${Math.max(0, this.options.viewport.width)}px`;
        this.root.style.height = `${Math.max(0, this.options.viewport.height)}px`;
        this.root.classList.toggle("compact", this.compact);
        this.root.classList.toggle("micro", this.micro);
    }

    private get micro(): boolean {
        return !!this.options && (this.options.viewport.width < 160 || this.options.viewport.height < 140);
    }

    private get chartDimensions(): { left: number; right: number; width: number } {
        const font = boundedNumber(this.settings.appearance.fontSize.value, 12, 10, 24);
        return {
            left: this.compact ? 48 : Math.max(90, font * 7),
            right: this.compact ? 42 : Math.max(72, font * 5),
            width: Math.max(120, (this.options?.viewport.width ?? 0) - (this.compact ? 12 : 24))
        };
    }

    private get pageSize(): number {
        const { width, left, right } = this.chartDimensions;
        const minimumBand = this.compact ? 56 : Math.max(this.hasLongLabels ? 112 : 56,
            this.settings.appearance.fontSize.value * (this.hasLongLabels ? 8 : 4));
        return Math.max(1, Math.min(this.settings.analysis.pageSize.value, Math.floor((width - left - right) / minimumBand)));
    }

    private renderRankNavigation(): void {
        if (!this.model) return;
        const form = element("form", "rank-navigation");
        const label = element("label", undefined, this.t("GoRank") + " ");
        const input = element("input");
        input.type = "number";
        input.min = "1";
        input.max = String(this.model.rows.length);
        input.step = "1";
        input.required = true;
        input.value = String(this.page * this.pageSize + 1);
        label.appendChild(input);
        const go = element("button", undefined, this.t("Go"));
        go.type = "submit";
        form.append(label, go);
        if (this.sharesVisible && this.model.crossingRank !== undefined) {
            form.appendChild(this.button(this.t("ThresholdRanks"), () => this.changeRank(this.model!.crossingRank!)));
        }
        form.addEventListener("submit", event => {
            event.preventDefault();
            if (input.reportValidity()) this.changeRank(Number(input.value));
        });
        this.root.appendChild(form);
    }

    private renderOverview(): void {
        if (!this.model) return;
        const width = this.chartDimensions.width;
        const height = 64;
        const inset = 8;
        const plotWidth = width - 2 * inset;
        const rows = this.model.rows;
        const count = Math.min(rows.length, Math.floor(plotWidth));
        const coordinates: string[] = [];
        for (let i = 0; i < count; i++) {
            const index = Math.round(i * (rows.length - 1) / Math.max(1, count - 1));
            coordinates.push(`${i === 0 ? "M" : "L"} ${inset + index / Math.max(1, rows.length - 1) * plotWidth} ${42 - rows[index].cumulativeShare * 28}`);
        }
        const chart = svg("svg", { width, height, viewBox: `0 0 ${width} ${height}`, role: "img", class: "concentration-overview", "aria-label": this.t("Overview") });
        chart.append(
            svg("title", {}, this.t("OverviewHelp")),
            svg("text", { x: inset, y: 11, fill: "var(--text)" }, this.t("Overview")),
            svg("path", { d: coordinates.join(" "), stroke: "var(--text)", fill: "none", "stroke-width": 1.5 }),
            svg("text", { x: inset, y: 60, fill: "var(--text)" }, "1"),
            svg("text", { x: width - inset, y: 60, "text-anchor": "end", fill: "var(--text)" }, this.number(rows.length))
        );
        if (this.model.crossingRank !== undefined) {
            const x = inset + (this.model.crossingRank - 1) / Math.max(1, rows.length - 1) * plotWidth;
            chart.appendChild(svg("line", { x1: x, x2: x, y1: 14, y2: 45, stroke: "var(--text)", "stroke-dasharray": "3 2" }));
        }
        this.root.appendChild(chart);
    }
    private number(value: number): string {
        return new Intl.NumberFormat(this.host.locale).format(value);
    }

    private percent(value: number): string {
        return new Intl.NumberFormat(this.host.locale, { style: "percent", maximumFractionDigits: 2 }).format(value);
    }

    private truncate(value: string, limit: number): string {
        const characters = this.graphemes(value);
        return characters.length > limit ? characters.slice(0, limit - 3).join("") + "..." : value;
    }

    private categoryLines(value: string, width: number, font: number): string[] {
        // Measure the selected (bold) form too, so selection cannot cause overlap.
        this.textContext.font = `700 ${font}px "Segoe UI", sans-serif`;
        const fits = (text: string) => this.textContext.measureText(text).width <= width;
        const characters = this.graphemes(value);
        const prefixLength = (parts: string[], suffix: string): number => {
            let low = 0;
            let high = parts.length;
            while (low < high) {
                const middle = Math.ceil((low + high) / 2);
                if (fits(parts.slice(0, middle).join("") + suffix)) low = middle;
                else high = middle - 1;
            }
            return low;
        };
        const firstLength = prefixLength(characters, "");
        if (firstLength === characters.length) return [value];
        if (firstLength === 0) return ["..."];
        const first = characters.slice(0, firstLength);
        const wordBreak = Math.max(first.lastIndexOf(" "), first.lastIndexOf("-") + 1);
        const split = wordBreak > 0 ? wordBreak : firstLength;
        const remaining = this.graphemes(characters.slice(split).join("").trimStart());
        const last = remaining.join("");
        return [characters.slice(0, split).join("").trimEnd(),
            fits(last) ? last : remaining.slice(0, prefixLength(remaining, "...")).join("") + "..."];
    }

    private graphemes(value: string): string[] {
        return Array.from(new Intl.Segmenter(this.host.locale, { granularity: "grapheme" }).segment(value), part => part.segment);
    }

    private t(key: TextKey, ...args: (string | number)[]): string {
        return localize(this.localization, key, ...args);
    }

    private hideTooltip(): void {
        this.host.tooltipService.hide({ immediately: true, isTouchEvent: false });
    }

    private get interactionsAllowed(): boolean {
        return this.host.hostCapabilities?.allowInteractions !== false;
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formats.buildFormattingModel(this.settings);
    }

    public destroy(): void {
        this.destroyed = true;
        this.hideTooltip();
        this.root.remove();
        this.view = undefined;
        this.binding = undefined;
        this.model = undefined;
        this.inputRows = [];
        this.identities = [];
    }
}
