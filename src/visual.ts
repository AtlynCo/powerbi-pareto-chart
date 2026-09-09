import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { valueFormatter } from "powerbi-visuals-utils-formattingutils";
import { analyze, ParetoModel, RankedRow } from "./model";
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
    private readonly segments = new SegmentTracker();
    private settings = new VisualFormattingSettingsModel();
    private view?: powerbi.DataView;
    private binding?: Binding;
    private model?: ParetoModel;
    private identities: SelectionId[] = [];
    private options?: Update;
    private page = 0;
    private destroyed = false;
    private hasHighlights = false;
    private sharesVisible = false;
    private universe = "";

    constructor(options?: powerbi.extensibility.visual.VisualConstructorOptions) {
        if (!options) throw new Error("Power BI constructor options are required.");
        this.host = options.host;
        this.localization = this.host.createLocalizationManager();
        this.selection = this.host.createSelectionManager();
        this.formats = new FormattingSettingsService(this.localization);
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
            this.options = options;
            this.host.tooltipService.hide({ immediately: true, isTouchEvent: false });
            const hasDataUpdate = (options.type & powerbi.VisualUpdateType.Data) !== 0 || !this.view;
            if (hasDataUpdate) {
                this.view = options.dataViews?.[0];
                this.binding = this.view ? getBinding(this.view) : undefined;
                if (options.operationKind !== powerbi.VisualDataChangeOperationKind.Append) this.page = 0;
                if (this.binding && this.view) {
                    this.segments.accept(
                        this.binding.category.values.length,
                        this.view.metadata.segment !== undefined,
                        options.operationKind,
                        () => typeof this.host.fetchMoreData === "function" && this.host.fetchMoreData(true)
                    );
                }
            } else if (options.dataViews?.[0]) {
                // Formatting updates may supply changed metadata without a new data segment.
                this.view = options.dataViews[0];
                this.binding = getBinding(this.view);
            }
            this.settings = this.view
                ? this.formats.populateFormattingSettingsModel(VisualFormattingSettingsModel, this.view)
                : new VisualFormattingSettingsModel();
            this.prepareModel();
            this.render();
            this.host.eventService.renderingFinished(options);
        } catch (error) {
            this.root.replaceChildren();
            this.message(this.t("Failure"), "message error");
            this.host.eventService.renderingFailed(options, String(error));
            console.error("Atlyn Pareto render failed", error);
        }
    }

    private prepareModel(): void {
        this.identities = [];
        this.model = undefined;
        if (!this.binding) return;
        const { category, contribution } = this.binding;
        if (contribution.values.length !== category.values.length ||
            (category.values.length > 0 && (!category.identity || category.identity.length !== category.values.length))) {
            throw new Error("Category identities and contribution rows must have matching lengths.");
        }
        this.hasHighlights = contribution.highlights !== undefined;
        const input = category.values.slice(0, MAX_CATEGORIES).map((value, index) => {
            const identity = this.host.createSelectionIdBuilder().withCategory(category, index).createSelectionId();
            this.identities[index] = identity;
            return {
                index, key: identity.getKey(), sortKey: canonicalCategory(value),
                label: value === null || value === undefined ? this.t("Blank") : this.format(value, category.source),
                value: contribution.values[index],
                highlight: contribution.highlights?.[index]
            };
        });
        this.model = analyze(input, this.settings.analysis.threshold.value);
    }

    private render(): void {
        if (!this.options) return;
        const focusedIndex = this.root.contains(document.activeElement)
            ? document.activeElement?.getAttribute("data-row-index") : null;
        const appearance = this.settings.appearance;
        const palette = this.host.colorPalette;
        this.root.style.setProperty("--text", palette.isHighContrast ? palette.foreground.value : "#182D3D");
        this.root.style.setProperty("--background", palette.isHighContrast ? palette.background.value : "#FFFFFF");
        this.root.style.setProperty("--focus", palette.isHighContrast ? palette.foregroundSelected.value : "#005FCC");
        this.root.style.fontSize = `${boundedNumber(appearance.fontSize.value, 12, 10, 24)}px`;
        this.root.style.width = `${Math.max(0, this.options.viewport.width)}px`;
        this.root.style.height = `${Math.max(0, this.options.viewport.height)}px`;
        this.root.replaceChildren();
        this.root.appendChild(element("h2", "title", this.t("Title")));
        const legal = element("details", "third-party-notices");
        legal.append(
            element("summary", undefined, this.t("Notices")),
            element("pre", undefined, notices.components.map(item => `${item.name} ${item.version}\n\n${item.license}`).join("\n\n"))
        );
        this.root.appendChild(legal);
        if (!this.binding || !this.model) {
            this.message(this.t("Bind"));
            return;
        }
        const model = this.model;
        const complete = this.segments.status === "complete";
        this.sharesVisible = model.kind === "ready" && (complete || this.settings.analysis.partialPolicy.value === "subset");
        this.universe = this.t(complete ? "Complete" : this.sharesVisible ? "Subset" : "Withhold");
        this.message(this.universe, complete ? "universe" : "universe warning");
        const statusKeys: Record<string, TextKey> = {
            loading: "Loading", refused: "Refused", limit: "Limit", stalled: "Stalled", unexpected: "Unexpected"
        };
        if (!complete) this.message(this.t(statusKeys[this.segments.status]), "retrieval warning");
        this.message(this.t("Counts", this.number(Math.min(this.binding.category.values.length, MAX_CATEGORIES)),
            this.number(this.binding.category.values.length)), "counts");
        this.message(this.t(complete ? "Excluded" : "Limited"), "exclusions");
        if (model.kind === "empty") {
            this.message(this.t("Empty"));
            return;
        }
        if (model.kind === "invalid") {
            this.message(this.t(model.overflow ? "Overflow" : "Invalid"), "message error");
            this.message(`${this.t("Missing")}: ${model.issues.missing}; ${this.t("InvalidNumber")}: ${model.issues.invalid}; ${this.t("Negative")}: ${model.issues.negative}`, "invalid-counts");
            return;
        }
        if (model.kind === "zero") this.message(this.t("Zero"), "message warning");
        if (complete || this.sharesVisible) {
            this.message(`${this.t("Total")}: ${this.format(model.total, this.binding.contribution.source)}`, "total");
        }
        if (this.sharesVisible) {
            this.message(this.t("ThresholdSummary", this.percent(model.threshold / 100), this.number(model.includedCount), this.number(model.rows.length)), "threshold-summary");
        }
        if (this.hasHighlights) this.message(this.t("Highlights"), "highlight-note");
        if (model.issues.invalidHighlight) this.message(this.t("InvalidHighlight", model.issues.invalidHighlight), "warning");
        if (this.options.viewport.width < 230 || this.options.viewport.height < 160) {
            this.message(this.t("Small"));
            return;
        }
        const pageSize = Math.round(boundedNumber(this.settings.analysis.pageSize.value, 30, 10, 100));
        this.page = Math.min(this.page, Math.max(0, Math.ceil(model.rows.length / pageSize) - 1));
        const rows = model.rows.slice(this.page * pageSize, (this.page + 1) * pageSize);
        const toolbar = element("div", "toolbar");
        toolbar.append(
            this.button(this.t("Previous"), () => this.changePage(-1), this.page === 0),
            element("span", "page-label", this.t("Paging", rows[0].rank, rows[rows.length - 1].rank, this.number(model.rows.length))),
            this.button(this.t("Next"), () => this.changePage(1), (this.page + 1) * pageSize >= model.rows.length),
            this.button(this.t("Clear"), () => this.clearSelection(), !this.interactionsAllowed)
        );
        this.root.appendChild(toolbar);
        this.message(this.t("Keyboard"), "keyboard-help");
        this.renderChart(rows);
        if (this.sharesVisible) this.message(this.t("Convention"), "legend");
        this.message(this.t("NoOther"), "paging-note");
        if (appearance.showTable.value) this.renderTable(rows);
        this.syncSelection();
        if (focusedIndex !== null) {
            this.root.querySelector<SVGElement>(`[data-row-index="${focusedIndex}"]`)?.focus();
        }
    }

    private renderChart(rows: RankedRow[]): void {
        if (!this.model || !this.binding || !this.options) return;
        const palette = this.host.colorPalette;
        const highContrast = palette.isHighContrast;
        const foreground = highContrast ? palette.foreground.value : "#182D3D";
        const bar = highContrast ? foreground : safeColor(this.settings.appearance.barColor.value.value, "#7895B2");
        const included = highContrast ? foreground : safeColor(this.settings.appearance.thresholdColor.value.value, "#176B78");
        const line = highContrast ? palette.foregroundSelected.value : safeColor(this.settings.appearance.lineColor.value.value, "#B24C16");
        const font = boundedNumber(this.settings.appearance.fontSize.value, 12, 10, 24);
        const left = Math.max(88, font * 7);
        const right = Math.max(76, font * 5);
        const width = Math.max(this.options.viewport.width - 24, left + right + rows.length * 34);
        const height = Math.max(300, Math.min(440, this.options.viewport.height * 0.62));
        const top = 52;
        const bottom = height - 78;
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
            svg("text", { x: left, y: 20, fill: foreground, class: "value-axis-title" }, this.binding.contribution.source.displayName),
            svg("line", { x1: left, x2: left, y1: top, y2: bottom, stroke: foreground }),
            svg("line", { x1: left, x2: width - right, y1: bottom, y2: bottom, stroke: foreground })
        );
        if (this.sharesVisible) {
            chart.append(
                svg("text", { x: width - right, y: 38, "text-anchor": "end", fill: line, class: "percent-axis-title" }, this.t("CumulativeShare")),
                svg("line", { x1: width - right, x2: width - right, y1: top, y2: bottom, stroke: line })
            );
        }
        for (let tick = 0; tick <= 4; tick++) {
            const fraction = tick / 4;
            const y = yShare(fraction);
            chart.append(
                svg("line", { x1: left, x2: width - right, y1: y, y2: y, stroke: foreground, "stroke-opacity": 0.18 }),
                svg("text", { x: left - 8, y: y + 4, "text-anchor": "end", fill: foreground, class: "value-tick" }, this.format(maximum * fraction, this.binding.contribution.source))
            );
            if (this.sharesVisible) chart.append(svg("text", { x: width - right + 8, y: y + 4, fill: line, class: "percent-tick" }, this.percent(fraction)));
        }
        if (this.sharesVisible) {
            const y = yShare(this.model.threshold / 100);
            chart.append(
                svg("line", { x1: left, x2: width - right, y1: y, y2: y, stroke: line, "stroke-dasharray": "5 4", class: "threshold-line" }),
                svg("text", { x: left + 4, y: y - 6, fill: line }, `${this.t("Threshold")} ${this.percent(this.model.threshold / 100)}`)
            );
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
            group.append(svg("text", { x: x(i), y: bottom + 18, "text-anchor": "middle", fill: foreground, class: "rank-label" }, `${row.rank}${this.sharesVisible && row.included ? "*" : ""}`));
            const categoryText = svg("text", { transform: `translate(${x(i)},${bottom + 34}) rotate(-30)`, "text-anchor": "end", fill: foreground, class: "category-label" }, this.truncate(row.label, 18));
            categoryText.appendChild(svg("title", {}, row.label));
            group.appendChild(categoryText);
            this.bindInteractions(group, row, true);
            chart.appendChild(group);
        });
        if (this.sharesVisible) {
            const path = rows.map((row, i) => `${i ? "L" : "M"} ${x(i)} ${yShare(row.cumulativeShare)}`).join(" ");
            chart.appendChild(svg("path", { d: path, fill: "none", stroke: line, "stroke-width": 2.5, class: "cumulative-line", "pointer-events": "none" }));
            rows.forEach((row, i) => {
                chart.appendChild(svg("circle", { cx: x(i), cy: yShare(row.cumulativeShare), r: row.crossing ? 5 : 3, fill: line, class: row.crossing ? "crossing-point" : "cumulative-point", "pointer-events": "none" }));
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
            if ((event.key === "Enter" || event.key === " ") && chart) {
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
        console.error("Atlyn Pareto host interaction failed", error);
    }

    private changePage(delta: number): void {
        if (!this.options) return;
        this.host.eventService.renderingStarted(this.options);
        try {
            this.page += delta;
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

    private message(text: string, className = "message"): void {
        const message = element("p", className, text);
        if (className.includes("error")) message.setAttribute("role", "alert");
        if (className.includes("universe")) message.setAttribute("role", "status");
        this.root.appendChild(message);
    }

    private format(value: powerbi.PrimitiveValue | undefined, source: powerbi.DataViewMetadataColumn): string {
        if (value === null || value === undefined) return this.t("Blank");
        return valueFormatter.format(value, valueFormatter.getFormatStringByColumn(source), false, this.host.locale);
    }

    private number(value: number): string {
        return new Intl.NumberFormat(this.host.locale).format(value);
    }

    private percent(value: number): string {
        return new Intl.NumberFormat(this.host.locale, { style: "percent", maximumFractionDigits: 2 }).format(value);
    }

    private truncate(value: string, limit: number): string {
        const characters = Array.from(value);
        return characters.length > limit ? characters.slice(0, limit - 3).join("") + "..." : value;
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
        this.identities = [];
    }
}
