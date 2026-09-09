import type { Page } from "@playwright/test";
import { test, expect, type PackagedApp } from "./fixtures";
import { readPackage } from "../../scripts/package-utils.mjs";
import { categoricalView, installHostMock, type HostOptions, type HostState } from "./host-mock";

type Viewport = { width: number; height: number };
const CURRENT_GUID = (readPackage() as { payload: { visual: { guid: string } } }).payload.visual.guid;

declare global {
    interface Window {
        __qualityHarnesses?: Record<string, Window["__paretoTest"]>;
    }
}

function defectView() {
    return categoricalView([47, 29, 18, 11, 7, 5, 3, 2], {
        labels: ["Authentication", "Export", "Refresh", "Modeling", "Permissions", "Scheduling", "Filters", "Formatting"],
        keys: ["def-auth", "def-export", "def-refresh", "def-modeling", "def-permissions", "def-scheduling", "def-filters", "def-formatting"],
        objects: { analysis: { threshold: 80 }, appearance: { showTable: true } }
    });
}

function costView() {
    return categoricalView([146000, 92000, 54000, 38000, 26000, 19000, 13000, 9000], {
        labels: ["Data refresh", "Onboarding", "Warehouse", "Model reviews", "Security", "Licensing", "Operations", "Other"],
        keys: ["cost-refresh", "cost-onboarding", "cost-warehouse", "cost-reviews", "cost-security", "cost-licensing", "cost-ops", "cost-other"],
        format: "$#,0.00",
        objects: { analysis: { threshold: 85 }, appearance: { showTable: true } }
    });
}

function customerView() {
    return categoricalView([240, 180, 130, 90, 72, 56, 31, 18], {
        labels: ["Northwind", "Contoso", "Fabrikam", "Tailwind", "Alpine", "A. Datum", "Adventure Works", "Wide World Importers"],
        keys: ["cust-nw", "cust-contoso", "cust-fabrikam", "cust-tailwind", "cust-alpine", "cust-adatum", "cust-aw", "cust-wwi"],
        objects: { analysis: { threshold: 75 }, appearance: { showTable: true } }
    });
}

function longLabelsView() {
    return categoricalView([88, 74, 63, 52, 41, 35, 29, 24, 18, 13, 8, 5], {
        labels: [
            "Demand planning exceptions requiring weekly cross-functional review",
            "Customer lifetime value cohorts with shared revenue attribution",
            "Manual reconciliation tasks carried over from the previous month",
            "Sales enablement content requests awaiting regional localization",
            "Backlog items with ambiguous scope and external dependencies",
            "Escalations from enterprise tenants requesting custom thresholds",
            "Legacy semantic model refreshes still using old field bindings",
            "Support conversations reopened after downstream validation failures",
            "Chart interactions retried from touch devices on compact tiles",
            "Localization strings validated against right-to-left environments",
            "Accessibility fixes verified under forced-colors high contrast",
            "Residual low-volume categories after concentration threshold crossing"
        ],
        keys: Array.from({ length: 12 }, (_, index) => `long-${index + 1}`),
        objects: { analysis: { threshold: 80 }, appearance: { showTable: true, fontSize: 14 } }
    });
}

function dense100View(segmented = false) {
    const values = Array.from({ length: 100 }, (_, index) => Math.max(1, 700 - index * 6 + (index % 5)));
    return categoricalView(values, {
        labels: values.map((_, index) => `Category ${String(index + 1).padStart(3, "0")}`),
        keys: values.map((_, index) => `dense-${index + 1}`),
        segmented,
        objects: { analysis: { threshold: 80, pageSize: 30 }, appearance: { showTable: true } }
    });
}

function invalidView() {
    return categoricalView([60, -5, null, Number.POSITIVE_INFINITY], {
        labels: ["Valid", "Negative", "Missing", "Infinite"],
        keys: ["invalid-ok", "invalid-negative", "invalid-missing", "invalid-infinite"],
        objects: { analysis: { threshold: 80 }, appearance: { showTable: true } }
    });
}

async function stashPrimaryHarness(page: Page): Promise<void> {
    await page.evaluate(() => {
        window.__qualityHarnesses ??= {};
        window.__qualityHarnesses.primary = window.__paretoTest;
    });
}

async function configureThreeUpLayout(page: Page): Promise<void> {
    await page.evaluate(() => {
        document.body.setAttribute("style", "margin:0;background:#f3f5f7;font-family:Segoe UI,sans-serif;");
        const primary = document.getElementById("visual");
        if (!primary) throw new Error("Missing primary fixture root.");
        primary.id = "quality-primary";
        primary.setAttribute("style", "width:400px;height:680px;");
        const wrapper = document.createElement("main");
        wrapper.id = "quality-grid";
        wrapper.setAttribute("style", "display:grid;grid-template-columns:repeat(3, 1fr);gap:16px;padding:16px;height:768px;");
        const card = (title: string, id: string, dark = false, existing?: HTMLElement) => {
            const section = document.createElement("section");
            section.setAttribute("style", `background:${dark ? "#111111" : "#ffffff"};color:${dark ? "#ffffff" : "#182d3d"};border:1px solid ${dark ? "#3d444d" : "#d0d7de"};border-radius:8px;padding:8px;`);
            const heading = document.createElement("h1");
            heading.textContent = title;
            heading.setAttribute("style", "font-size:16px;margin:0 0 8px;");
            const root = existing ?? document.createElement("div");
            root.id = id;
            root.setAttribute("style", "width:400px;height:680px;");
            section.append(heading, root);
            return section;
        };
        wrapper.append(
            card("Default host", "quality-primary", false, primary),
            card("RTL host", "quality-rtl"),
            card("High contrast host", "quality-hc", true)
        );
        document.body.replaceChildren(wrapper);
    });
}

async function createAdditionalVisual(
    page: Page,
    app: PackagedApp,
    args: { key: string; rootId: string; hostOptions?: HostOptions; viewport: Viewport }
): Promise<void> {
    await page.evaluate(() => {
        const globals = window as unknown as {
            __qualityPluginStore?: Record<string, unknown>;
            powerbi?: { visuals?: { plugins?: Record<string, unknown> } };
        };
        globals.__qualityPluginStore = { ...(globals.powerbi?.visuals?.plugins ?? {}) };
    });
    await page.evaluate(installHostMock, { ...args.hostOptions, resources: app.resources });
    await page.evaluate(({ key, rootId, viewport, guid }) => {
        window.__qualityHarnesses ??= {};
        const primary = window.__qualityHarnesses.primary;
        const harness = window.__paretoTest;
        type Constructor = new (options: { element: HTMLElement; host: Record<string, unknown> }) => NonNullable<Window["__paretoTest"]["visual"]>;
        type Plugin = { create?: (options: { element: HTMLElement; host: Record<string, unknown> }) => NonNullable<Window["__paretoTest"]["visual"]>; Visual?: Constructor };
        const globals = window as unknown as Record<string, unknown>;
        const plugins = (globals as { __qualityPluginStore?: Record<string, Plugin>; powerbi?: { visuals?: { plugins?: Record<string, Plugin> } } }).__qualityPluginStore ?? {};
        const powerbi = (globals.powerbi as { visuals?: { plugins?: Record<string, Plugin> } } | undefined) ?? { visuals: { plugins: {} } };
        powerbi.visuals ??= { plugins: {} };
        powerbi.visuals.plugins = { ...plugins };
        (globals as { powerbi: typeof powerbi }).powerbi = powerbi;
        const namespace = globals[guid] as (Plugin & { default?: Plugin }) | undefined;
        const plugin = powerbi?.visuals?.plugins?.[guid] ?? namespace?.default ?? namespace;
        const element = document.getElementById(rootId);
        if (!element) throw new Error(`Missing extra visual root ${rootId}.`);
        element.setAttribute("style", `width:${viewport.width}px;height:${viewport.height}px;`);
        try {
            const options = { element, host: harness.host };
            if (plugin?.create) harness.visual = plugin.create(options);
            else if (namespace?.Visual) harness.visual = new namespace.Visual(options);
            else throw new Error(`No Power BI plugin or Visual export in the packaged bundle for ${guid}.`);
            window.__qualityHarnesses[key] = harness;
        } finally {
            if (primary) window.__paretoTest = primary;
        }
    }, { ...args, guid: CURRENT_GUID });
}

async function updateStoredVisual(
    page: Page,
    key: string,
    view: ReturnType<typeof categoricalView>,
    viewport: Viewport,
    type = 2
): Promise<void> {
    await page.evaluate(({ key, view, viewport, type }) => {
        const harness = window.__qualityHarnesses?.[key];
        if (!harness?.visual) throw new Error(`Missing harness ${key}.`);
        harness.visual.update({ type, operationKind: 0, viewport, dataViews: view ? [view] : [] });
    }, { key, view, viewport, type });
}

async function storedState(page: Page, key: string): Promise<HostState> {
    return page.evaluate(id => {
        const harness = window.__qualityHarnesses?.[id];
        if (!harness) throw new Error(`Missing harness ${id}.`);
        return harness.state;
    }, key);
}

test("multiple real packaged instances remain independent across default, RTL, and high-contrast hosts", async ({ app, page }) => {
    const viewport = { width: 1366, height: 768 };
    await page.setViewportSize(viewport);
    await stashPrimaryHarness(page);
    await configureThreeUpLayout(page);
    await app.update(defectView(), { viewport: { width: 400, height: 680 } });
    await createAdditionalVisual(page, app, { key: "rtl", rootId: "quality-rtl", hostOptions: { locale: "ar-SA" }, viewport: { width: 400, height: 680 } });
    await createAdditionalVisual(page, app, {
        key: "hc",
        rootId: "quality-hc",
        hostOptions: { highContrast: true, foreground: "#FFFFFF", background: "#000000", foregroundSelected: "#00FF00" },
        viewport: { width: 400, height: 680 }
    });
    await updateStoredVisual(page, "rtl", costView(), { width: 400, height: 680 });
    await updateStoredVisual(page, "hc", customerView(), { width: 400, height: 680 });
    await page.evaluate(() => {
        const target = document.querySelectorAll<SVGElement>("#quality-rtl .bar-target")[1];
        if (!target) throw new Error("Missing RTL target.");
        target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, composed: true }));
        if (window.__qualityHarnesses?.primary) window.__paretoTest = window.__qualityHarnesses.primary;
    });
    const snapshot = await page.evaluate(() => {
        const roots = [
            document.querySelector("#quality-primary .atlyn-pareto"),
            document.querySelector("#quality-rtl .atlyn-pareto"),
            document.querySelector("#quality-hc .atlyn-pareto")
        ].map(root => {
            const element = root as HTMLElement | null;
            const rect = element?.getBoundingClientRect();
            return {
                direction: element?.getAttribute("dir") ?? null,
                total: element?.querySelector(".total")?.textContent ?? null,
                thresholdSummary: element?.querySelector(".threshold-summary")?.textContent ?? null,
                chartDirection: element?.querySelector(".chart-scroll")?.getAttribute("dir")
                    ?? getComputedStyle(element?.querySelector(".chart-scroll") as Element).direction,
                background: element ? getComputedStyle(element).backgroundColor : null,
                color: element ? getComputedStyle(element).color : null,
                rect: rect ? { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom } : null
            };
        });
        return {
            roots,
            primarySelected: window.__qualityHarnesses?.primary.state.selectedKeys ?? [],
            rtlSelected: window.__qualityHarnesses?.rtl.state.selectedKeys ?? [],
            hcSelected: window.__qualityHarnesses?.hc.state.selectedKeys ?? []
        };
    });
    expect(snapshot.primarySelected).toEqual([]);
    expect(snapshot.rtlSelected).toEqual(["category:cost-onboarding"]);
    expect(snapshot.hcSelected).toEqual([]);
    expect(snapshot.roots[1].direction).toBe("rtl");
    expect(snapshot.roots[1].chartDirection).toBe("ltr");
    expect(snapshot.roots[2]).toMatchObject({ background: "rgb(0, 0, 0)", color: "rgb(255, 255, 255)" });
    snapshot.roots.forEach(root => {
        expect(root.total).toContain("Denominator total");
        expect(root.thresholdSummary).not.toBeNull();
        expect(root.rect?.x ?? -1).toBeGreaterThanOrEqual(0);
        expect(root.rect?.y ?? -1).toBeGreaterThanOrEqual(0);
        expect(root.rect?.right ?? Number.MAX_VALUE).toBeLessThanOrEqual(viewport.width);
        expect(root.rect?.bottom ?? Number.MAX_VALUE).toBeLessThanOrEqual(viewport.height);
    });
    expect((await storedState(page, "rtl")).events.filter(event => event.name === "failed")).toHaveLength(0);
    expect((await storedState(page, "hc")).events.filter(event => event.name === "failed")).toHaveLength(0);
});

test("quality transitions cover loading, invalid alerts, touch and keyboard input, and scrolling without render failures", async ({ app, page }) => {
    const viewport = { width: 1280, height: 620 };
    await page.setViewportSize(viewport);
    await app.update(dense100View(true), { viewport });
    await expect(page.locator(".retrieval")).toBeVisible();
    await expect(page.locator(".universe")).toBeVisible();
    await app.update(customerView(), { viewport });
    const bars = page.locator(".bar-target");
    await bars.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(bars.nth(1)).toBeFocused();
    await page.keyboard.press("Enter");
    await bars.nth(1).dispatchEvent("pointerenter", { pointerType: "touch", clientX: 36, clientY: 20 });
    await page.keyboard.press("Escape");
    const interactionState = await app.state();
    expect(interactionState.selections.at(-1)).toEqual({ keys: ["category:cust-contoso"], multiSelect: false });
    expect(interactionState.clears).toBe(1);
    expect(interactionState.tooltips.filter(tooltip => tooltip.name === "show").at(-1)?.options.isTouchEvent).toBe(true);
    await app.update(invalidView(), { viewport });
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.locator(".cumulative-line")).toHaveCount(0);
    await app.update(dense100View(), { viewport });
    const scrollState = await page.locator(".atlyn-pareto").evaluate(root => {
        const before = root.scrollTop;
        root.scrollTop = root.scrollHeight;
        return { before, after: root.scrollTop, scrollHeight: root.scrollHeight, clientHeight: root.clientHeight };
    });
    expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight);
    expect(scrollState.after).toBeGreaterThanOrEqual(scrollState.before);
    const rows = await page.locator(".data-table tbody tr").count();
    expect(rows).toBeGreaterThan(0);
    expect(rows).toBeLessThan(30);
    expect(rows).toBe(await page.locator(".bar-target").count());
    expect((await app.state()).events.filter(event => event.name === "failed")).toHaveLength(0);
});

test("micro and compact package renders stay bounded and meaningful across key capture sizes", async ({ app, page }) => {
    const cases: Array<{ viewport: Viewport; view: ReturnType<typeof categoricalView>; expectBars: boolean }> = [
        { viewport: { width: 80, height: 80 }, view: customerView(), expectBars: false },
        { viewport: { width: 258, height: 198 }, view: defectView(), expectBars: true },
        { viewport: { width: 398, height: 298 }, view: longLabelsView(), expectBars: true }
    ];
    for (const { viewport, view, expectBars } of cases) {
        await page.setViewportSize(viewport);
        await app.update(view, { viewport });
        const geometry = await page.locator(".atlyn-pareto").evaluate(root => {
            const rect = root.getBoundingClientRect();
            const svg = root.querySelector(".chart-scroll svg");
            const groups = Array.from(root.querySelectorAll<SVGElement>(".bar-target")).map(target => {
                const box = target.getBoundingClientRect();
                return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
            });
            return {
                rect: { width: rect.width, height: rect.height, x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom },
                text: root.textContent?.trim() ?? "",
                ariaLabel: root.getAttribute("aria-label"),
                svgViewBox: svg?.getAttribute("viewBox") ?? null,
                groups,
                hitTargets: Array.from(root.querySelectorAll<SVGGraphicsElement>(".hit-target")).slice(0, 3).map(target => {
                    const box = target.getBoundingClientRect();
                    return { width: box.width, height: box.height };
                })
            };
        });
        expect(geometry.rect.width).toBeLessThanOrEqual(viewport.width);
        expect(geometry.rect.height).toBeLessThanOrEqual(viewport.height);
        expect(geometry.rect.x).toBeGreaterThanOrEqual(0);
        expect(geometry.rect.y).toBeGreaterThanOrEqual(0);
        expect(geometry.text.length).toBeGreaterThan(0);
        expect(geometry.ariaLabel).toContain(app.resources["en-US"].Title);
        if (!expectBars) {
            expect(geometry.svgViewBox).toBeNull();
            continue;
        }
        expect(geometry.svgViewBox).not.toMatch(/NaN|Infinity/);
        expect(geometry.groups.length).toBeGreaterThan(0);
        geometry.groups.forEach(group => {
            expect(group.width).toBeGreaterThan(0);
            expect(group.height).toBeGreaterThan(0);
            expect(group.x).toBeGreaterThanOrEqual(geometry.rect.x);
            expect(group.right).toBeLessThanOrEqual(geometry.rect.right + 1);
        });
        if (viewport.width === 258) {
            for (const target of geometry.hitTargets) {
                expect(target.width).toBeGreaterThanOrEqual(44);
                expect(target.height).toBeGreaterThanOrEqual(44);
            }
        }
    }
    await app.update(longLabelsView(), { viewport: { width: 398, height: 298 } });
    const labelGeometry = await page.locator(".bar-target").first().evaluate(group => {
        const rank = group.querySelector<SVGTextElement>(".rank-label")!.getBBox();
        const category = group.querySelector<SVGTextElement>(".category-label")!.getBBox();
        const chart = group.closest("svg")!;
        return {
            rankBottom: rank.y + rank.height,
            labelTop: category.y,
            labelBottom: category.y + category.height,
            chartHeight: chart.viewBox.baseVal.height
        };
    });
    expect(labelGeometry.rankBottom).toBeLessThanOrEqual(labelGeometry.labelTop);
    expect(labelGeometry.labelBottom).toBeLessThanOrEqual(labelGeometry.chartHeight);
});
