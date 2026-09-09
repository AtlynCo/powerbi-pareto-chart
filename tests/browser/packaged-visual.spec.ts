import { test, expect, tableRows, lastTooltip, formattingValues } from "./fixtures";
import { categoricalView } from "./host-mock";

const money = "$#,0.00";
const threeRows = () => categoricalView([10, 60, 30], { labels: ["C", "A", "B"], format: money });

test("loads the distributed plugin and exposes cold and customized formatting cards", async ({ app, page }) => {
    const cold = formattingValues(await app.formatting());
    expect(cold).toMatchObject({
        "analysis.threshold": 80,
        "analysis.partialPolicy": "withhold",
        "analysis.pageSize": 30,
        "analysis.startRank": 1,
        "appearance.fontSize": 12,
        "appearance.showTable": true
    });
    expect(Object.keys(cold).sort()).toEqual([
        "analysis.pageSize", "analysis.partialPolicy", "analysis.startRank", "analysis.threshold",
        "appearance.barColor", "appearance.fontSize", "appearance.lineColor",
        "appearance.showTable", "appearance.thresholdColor"
    ]);
    expect((await app.state()).events).toEqual([]);
    await app.update(categoricalView([60, 30, 10], {
        objects: {
            analysis: { threshold: 50, partialPolicy: "subset", pageSize: 10 },
            appearance: {
                barColor: { solid: { color: "#112233" } }, thresholdColor: { solid: { color: "#445566" } },
                lineColor: { solid: { color: "#778899" } }, fontSize: 18, showTable: false
            }
        }
    }));
    expect(formattingValues(await app.formatting())).toMatchObject({
        "analysis.threshold": 50, "analysis.partialPolicy": "subset", "analysis.pageSize": 10,
        "appearance.barColor": { value: "#112233" },
        "appearance.thresholdColor": { value: "#445566" },
        "appearance.lineColor": { value: "#778899" },
        "appearance.fontSize": 18, "appearance.showTable": false
    });
    await expect(page.locator(".data-table")).toHaveCount(0);
    await expect(page.locator(".atlyn-pareto")).toHaveCSS("font-size", "18px");
    await expect(page.locator(".contribution-bar").first()).toHaveAttribute("fill", "#445566");
    await expect(page.locator(".contribution-bar").last()).toHaveAttribute("fill", "#112233");
    await expect(page.locator(".cumulative-line")).toHaveAttribute("stroke", "#778899");
    await expect(page.locator(".threshold-summary")).toHaveText("50% threshold · 1 of 3 categories");
});

test("packaged third-party notices expand offline and retain upstream copyright and permission text", async ({ app, page }) => {
    await app.update();
    const notices = page.locator(".third-party-notices");
    const summary = notices.locator("summary");
    const license = notices.locator("pre");
    await expect(summary).toHaveText("Third-party notices");
    await expect(notices).not.toHaveAttribute("open");
    await expect(license).not.toBeVisible();
    await summary.click();
    await expect(notices).toHaveAttribute("open", "");
    await expect(license).toBeVisible();
    await expect(license).toContainText("Microsoft Corporation");
    await expect(license).toContainText("Software Freedom Conservancy");
    await expect(license).toContainText("Permission is hereby granted, free of charge");
    await expect(notices.locator("script, iframe, a[href]")).toHaveCount(0);
    await summary.click();
    await expect(license).not.toBeVisible();
    await app.update(threeRows());
    await expect(summary).toBeVisible();
    await expect(notices).not.toHaveAttribute("open");
});

test("complete contributions use descending bars, separate percent axis, and full-denominator cumulative points", async ({ app, page }) => {
    await app.update(threeRows());
    await expect(page.locator(".universe")).toHaveText("Completed query · 3 categories");
    await expect(page.locator(".total")).toHaveText("Denominator total: $100.00");
    expect(await tableRows(page)).toEqual([
        ["1", "A", "$60.00", "$60.00", "60%", "Threshold contributor (ties included)"],
        ["2", "B", "$30.00", "$90.00", "90%", "First threshold crossing"],
        ["3", "C", "$10.00", "$100.00", "100%", "After threshold set"]
    ]);
    await expect(page.locator(".value-axis-title")).toHaveText("Contribution");
    await expect(page.locator(".percent-axis-title")).toHaveText("Cumulative share (%)");
    await expect(page.locator(".value-tick")).toHaveText(["$0.00", "$15.00", "$30.00", "$45.00", "$60.00"]);
    await expect(page.locator(".percent-tick")).toHaveText(["0%", "25%", "50%", "75%", "100%"]);
    await expect(page.locator(".rank-label")).toHaveText(["1*", "2*", "3"]);
    const chart = await page.locator("svg").evaluate(node => {
        const bars = Array.from(node.querySelectorAll(".contribution-bar"), bar => ({
            y: Number(bar.getAttribute("y")), height: Number(bar.getAttribute("height"))
        }));
        return {
            bars,
            points: Array.from(node.querySelectorAll(".cumulative-point, .crossing-point"), point => Number(point.getAttribute("cy"))),
            thresholdY: Number(node.querySelector(".threshold-line")!.getAttribute("y1")),
            crossingX: Number(node.querySelector(".crossing-point")!.getAttribute("cx")),
            path: node.querySelector(".cumulative-line")!.getAttribute("d"),
            valueAxisX: Number(node.querySelector(".value-axis-title")!.getAttribute("x")),
            percentAxisX: Number(node.querySelector(".percent-axis-title")!.getAttribute("x"))
        };
    });
    const top = chart.bars[0].y;
    const height = chart.bars[0].height;
    const bottom = top + height;
    expect(chart.bars[1].height / height).toBeCloseTo(0.5);
    expect(chart.bars[2].height / height).toBeCloseTo(1 / 6);
    for (const [index, share] of [0.6, 0.9, 1].entries()) {
        expect(chart.points[index]).toBeCloseTo(bottom - height * share);
    }
    expect(chart.thresholdY).toBeCloseTo(bottom - height * 0.8);
    expect(chart.percentAxisX).toBeGreaterThan(chart.valueAxisX);
    expect(chart.path).not.toMatch(/NaN|Infinity/);
    expect((await app.state()).fetchRequests).toEqual([]);
});

test("threshold crossing includes all boundary ties, but 100 percent excludes trailing zero contributions", async ({ app, page }) => {
    await app.update(categoricalView([20, 40, 20, 20], {
        labels: ["D", "A", "C", "B"], objects: { analysis: { threshold: 60 } }
    }));
    expect((await tableRows(page)).map(row => [row[1], row[4], row[5]])).toEqual([
        ["A", "40%", "Threshold contributor (ties included)"],
        ["B", "60%", "First threshold crossing"],
        ["C", "80%", "Threshold contributor (ties included)"],
        ["D", "100%", "Threshold contributor (ties included)"]
    ]);
    await expect(page.locator(".crossing-point")).toHaveCount(1);
    await expect(page.locator(".rank-label")).toHaveText(["1*", "2*", "3*", "4*"]);
    await expect(page.locator(".threshold-summary")).toContainText("4 of 4 categories");
    await app.update(categoricalView([0, 60, 40, 0], { objects: { analysis: { threshold: 100 } } }));
    await expect(page.locator(".rank-label")).toHaveText(["1*", "2*", "3", "4"]);
    await expect(page.locator(".threshold-summary")).toContainText("2 of 4 categories");
    expect((await tableRows(page)).map(row => row[4])).toEqual(["60%", "100%", "100%", "100%"]);
});

test("malicious category and tooltip text stay literal and the packaged visual never requests the network", async ({ app, page }) => {
    const malicious = '<img src="https://invalid.example/pareto" onerror="window.__categoryScriptRan=true"><script>window.__categoryScriptRan=true</script>';
    const tooltipName = "<b>Additional cost</b>";
    await app.update(categoricalView([1250.5, 249.5], {
        labels: [malicious, "Safe"], format: money,
        tooltips: [{ name: tooltipName, values: [12.5, 5], format: money }]
    }));
    await expect(page.locator(".category-button").first()).toHaveText(malicious);
    await expect(page.locator(".category-label title").first()).toHaveText(malicious);
    await expect(page.locator("#visual img, #visual script, #visual iframe, #visual b")).toHaveCount(0);
    expect(await page.evaluate(() => window.__categoryScriptRan)).toBeUndefined();
    await page.locator(".bar-target").first().hover();
    const tooltip = await lastTooltip(app);
    expect(tooltip.Category).toBe(malicious);
    expect(tooltip.Contribution).toBe("$1,250.50");
    expect(tooltip["Denominator total"]).toBe("$1,500.00");
    expect(tooltip[tooltipName]).toBe("$12.50");
    const show = (await app.state()).tooltips.filter(call => call.name === "show").at(-1)!;
    expect(show.options.identities).toEqual(["category:row-0"]);
    expect(show.options.isTouchEvent).toBe(false);
    expect(show.options.coordinates).toHaveLength(2);
    await page.mouse.move(2, 2);
    expect((await app.state()).tooltips.at(-1)?.name).toBe("hide");
});

test("native selection, Ctrl multi-selection, clear, and incoming host selection preserve original category identities", async ({ app, page }) => {
    await app.update(threeRows());
    const bars = page.locator(".bar-target");
    await bars.nth(0).click();
    await bars.nth(1).click({ modifiers: ["Control"] });
    expect((await app.state()).selections).toEqual([
        { keys: ["category:row-1"], multiSelect: false },
        { keys: ["category:row-2"], multiSelect: true }
    ]);
    await expect(bars.nth(0)).toHaveAttribute("aria-pressed", "true");
    await expect(bars.nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect(bars.nth(2)).toHaveClass(/is-dimmed/);
    await expect(page.locator(".category-button").nth(0)).toHaveAttribute("aria-pressed", "true");
    await page.locator(".category-button").nth(2).click();
    expect((await app.state()).selectedKeys).toEqual(["category:row-0"]);
    await page.getByRole("button", { name: "Clear selection", exact: true }).click();
    expect((await app.state()).selectedKeys).toEqual([]);
    await app.incomingSelection(["category:row-2"]);
    await expect(bars.nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".category-button").nth(1)).toHaveAttribute("aria-pressed", "true");
    await bars.nth(1).focus();
    await page.keyboard.press("Escape");
    expect((await app.state()).selectedKeys).toEqual([]);
    await expect(page.locator(".is-selected, .is-dimmed")).toHaveCount(0);
    expect((await app.state()).clears).toBe(2);
    await expect(page.locator(".total")).toHaveText("Denominator total: $100.00");
});

test("keyboard tab and roving arrows select bars and open the host context menu without duplicate bubbling", async ({ app, page }) => {
    await app.update(threeRows());
    const bars = page.locator(".bar-target");
    await page.locator(".atlyn-pareto").focus();
    await page.keyboard.press("Tab");
    await expect(page.locator(".chart-scroll")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(bars.nth(0)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(bars.nth(1)).toBeFocused();
    await expect(bars.nth(0)).toHaveAttribute("tabindex", "-1");
    await expect(bars.nth(1)).toHaveAttribute("tabindex", "0");
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Control+Space");
    expect((await app.state()).selectedKeys).toEqual(["category:row-2", "category:row-0"]);
    await page.keyboard.press("Home");
    await expect(bars.nth(0)).toBeFocused();
    await page.keyboard.press("End");
    await expect(bars.nth(2)).toBeFocused();
    await page.keyboard.press("Shift+F10");
    expect((await app.state()).menus).toHaveLength(1);
    expect((await app.state()).menus[0].key).toBe("category:row-0");
    await bars.nth(0).click({ button: "right" });
    const state = await app.state();
    expect(state.menus).toHaveLength(2);
    expect(state.menus[1].key).toBe("category:row-1");
    expect(state.menus[1].position.x).toBeGreaterThan(0);
    expect(state.menus[1].position.y).toBeGreaterThan(0);
    expect(state.tooltips.some(call => call.name === "move")).toBe(true);
    expect(state.tooltips.filter(call => call.name === "hide").at(-1)?.options.immediately).toBe(true);
    await page.keyboard.press("Escape");
    expect((await app.state()).selectedKeys).toEqual([]);
});

test("incoming composite host selectors match categories through native includes rather than exact keys", async ({ app, page }) => {
    await app.update(threeRows());
    await page.evaluate(() => window.__paretoTest.incomingCompositeSelection(["category:row-1", "category:row-0"]));
    expect((await app.state()).selectedKeys).toEqual(["composite:category:row-1|category:row-0"]);
    const bars = page.locator(".bar-target");
    await expect(bars.nth(0)).toHaveAttribute("aria-pressed", "true");
    await expect(bars.nth(1)).toHaveAttribute("aria-pressed", "false");
    await expect(bars.nth(1)).toHaveClass(/is-dimmed/);
    await expect(bars.nth(2)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".category-button").nth(0)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".category-button").nth(2)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".total")).toHaveText("Denominator total: $100.00");
    expect((await app.state()).selections).toEqual([]);
    await app.incomingSelection([]);
    await expect(page.locator(".is-selected, .is-dimmed")).toHaveCount(0);
});

test("highlight overlays retain base ranking, denominator, cumulative path, selection, and model formats", async ({ app, page }) => {
    await app.update(threeRows());
    await page.locator(".bar-target").first().click();
    const path = await page.locator(".cumulative-line").getAttribute("d");
    await app.update(categoricalView([10, 60, 30], {
        labels: ["C", "A", "B"], format: money, highlights: [5, 15, null]
    }));
    await expect(page.locator(".cumulative-line")).toHaveAttribute("d", path!);
    await expect(page.locator(".total")).toHaveText("Denominator total: $100.00");
    await expect(page.locator(".highlight-bar")).toHaveCount(2);
    await expect(page.locator(".bar-target").first()).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".highlight-note")).toHaveText(app.resources["en-US"].Highlights);
    await expect(page.locator(".contribution-bar").first()).toHaveAttribute("fill-opacity", "0.3");
    await page.locator(".bar-target").first().focus();
    expect(await lastTooltip(app)).toMatchObject({
        Contribution: "$60.00", "Highlighted contribution": "$15.00",
        "Denominator total": "$100.00", "Cumulative share (%)": "60%"
    });
    const heights = await page.locator(".bar-target").first().evaluate(node => ({
        base: Number(node.querySelector(".contribution-bar")!.getAttribute("height")),
        highlight: Number(node.querySelector(".highlight-bar")!.getAttribute("height"))
    }));
    expect(heights.highlight / heights.base).toBeCloseTo(0.25);
    await app.update(categoricalView([10, 60, 30], { labels: ["C", "A", "B"], highlights: [-1, 61, Infinity] }));
    await expect(page.locator(".highlight-bar")).toHaveCount(0);
    await expect(page.locator(".warning")).toContainText("3 unsupported highlight values");
    await expect(page.locator(".total")).toHaveText("Denominator total: 100.00");
});

test("render lifecycle balances successful updates, an actual malformed-view failure, recovery, and destroy", async ({ app, page }) => {
    await app.update(threeRows());
    await app.update(undefined, { type: 4, viewport: { width: 640, height: 480 } });
    const malformed = threeRows();
    malformed.categorical!.categories![0].identity = [];
    app.expectedRenderFailures = 1;
    await app.update(malformed);
    await expect(page.locator(".message.error")).toHaveText(app.resources["en-US"].Failure);
    await expect.soft(page.getByRole("alert")).toHaveText(app.resources["en-US"].Failure);
    expect((await app.state()).events.at(-1)).toMatchObject({
        name: "failed", type: 2, message: expect.stringContaining("matching lengths")
    });
    await app.update(threeRows());
    await expect(page.locator(".bar-target")).toHaveCount(3);
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect((await app.state()).events.map(event => event.name)).toEqual([
        "started", "finished", "started", "finished", "started", "failed", "started", "finished"
    ]);
    await app.destroy();
    await app.incomingSelection(["category:row-0"]);
    await expect(page.locator("#visual")).toBeEmpty();
    expect((await app.state()).tooltips.at(-1)).toMatchObject({
        name: "hide", options: { immediately: true, isTouchEvent: false }
    });
});

test("native host Promise rejection is surfaced without an unhandled browser error", async ({ app, page }) => {
    await app.update(threeRows());
    await page.evaluate(() => window.__paretoTest.rejectNextInteraction("select"));
    await page.locator(".bar-target").first().click();
    await expect(page.getByRole("alert")).toHaveText(app.resources["en-US"].InteractionFailure);
    expect((await app.state()).selectedKeys).toEqual([]);
    await page.locator(".bar-target").nth(1).click();
    await expect(page.locator(".bar-target").nth(1)).toHaveAttribute("aria-pressed", "true");
});

test.describe("host disables interactions", () => {
    test.use({ hostOptions: { allowInteractions: false } });
    test("does not send selection, clear, or context-menu actions from mouse or keyboard", async ({ app, page }) => {
        await app.update(threeRows());
        const first = page.locator(".bar-target").first();
        const firstBounds = (await first.boundingBox())!;
        const secondBounds = (await page.locator(".bar-target").nth(1).boundingBox())!;
        // aria-disabled SVG groups still receive native events: verify the host
        // guard, rather than letting Playwright's enabled check suppress clicks.
        await page.mouse.click(firstBounds.x + firstBounds.width / 2, firstBounds.y + firstBounds.height / 2);
        await page.keyboard.down("Control");
        await page.mouse.click(secondBounds.x + secondBounds.width / 2, secondBounds.y + secondBounds.height / 2);
        await page.keyboard.up("Control");
        await page.mouse.click(firstBounds.x + firstBounds.width / 2, firstBounds.y + firstBounds.height / 2, { button: "right" });
        await first.focus();
        await page.keyboard.press("Enter");
        await page.keyboard.press("Space");
        await page.keyboard.press("Shift+F10");
        await page.keyboard.press("Escape");
        const category = page.locator(".category-button").first();
        if (await category.isEnabled()) await category.click();
        const clear = page.getByRole("button", { name: "Clear selection", exact: true });
        if (await clear.isEnabled()) await clear.click();
        await page.locator(".atlyn-pareto").click({ button: "right", position: { x: 1, y: 1 } });
        const state = await app.state();
        expect(state.selections).toEqual([]);
        expect(state.selectedKeys).toEqual([]);
        expect(state.clears).toBe(0);
        expect(state.menus).toEqual([]);
        await expect(page.locator(".total")).toHaveText("Denominator total: $100.00");
        await expect(page.locator(".cumulative-line")).toHaveCount(1);
    });
});

test("resizing to a small tile and back preserves data and renders the explicit small state", async ({ app, page }) => {
    await app.update(threeRows());
    await app.update(undefined, { type: 4, viewport: { width: 80, height: 80 } });
    await expect(page.locator(".atlyn-pareto")).toHaveCSS("width", "80px");
    await expect(page.locator(".atlyn-pareto")).toHaveCSS("height", "80px");
    await expect(page.locator(".atlyn-pareto")).toHaveAttribute("aria-label", new RegExp(app.resources["en-US"].Small.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    await expect(page.locator("svg, .data-table")).toHaveCount(0);
    await app.update(undefined, { type: 4, viewport: { width: 600, height: 450 } });
    await expect(page.locator(".bar-target")).toHaveCount(3);
    await expect(page.locator(".total")).toHaveText("Denominator total: $100.00");
    await expect(page.locator(".atlyn-pareto")).toHaveCSS("width", "600px");
    expect((await app.state()).fetchRequests).toEqual([]);
});

test("unbound and bound-empty views are distinct from a defined zero-total population", async ({ app, page }) => {
    await app.update();
    await expect(page.getByText(app.resources["en-US"].Bind, { exact: true })).toBeVisible();
    await expect(page.locator(".total, svg")).toHaveCount(0);
    await app.update(categoricalView([]));
    await expect(page.getByText(app.resources["en-US"].Empty, { exact: true })).toBeVisible();
    await expect(page.getByText(app.resources["en-US"].Bind, { exact: true })).toHaveCount(0);
    await expect(page.locator(".total, svg")).toHaveCount(0);
    await app.update(categoricalView([0, -0, 0], { labels: [null, "B", "A"] }));
    await expect(page.getByText(app.resources["en-US"].Zero, { exact: true })).toBeVisible();
    await expect(page.locator(".total")).toHaveText("Denominator total: 0.00");
    await expect(page.locator(".contribution-bar")).toHaveCount(3);
    await expect(page.locator(".cumulative-line, .percent-axis-title, .threshold-line, .threshold-summary")).toHaveCount(0);
    expect((await tableRows(page)).map(row => row.slice(3))).toEqual(Array(3).fill(["Unavailable", "Unavailable", "Unavailable"]));
    await expect(page.locator(".category-button").first()).toHaveText("(Blank)");
    await expect(page.locator(".rank-label")).toHaveText(["1", "2", "3"]);
});

test("negative, missing, nonnumeric, nonfinite, and overflowing contributions withhold the whole analysis", async ({ app, page }) => {
    const cases = [
        { value: -1, count: "Negative: 1" }, { value: null, count: "Blank or missing: 1" },
        { value: undefined, count: "Blank or missing: 1" }, { value: Infinity, count: "Non-numeric or nonfinite: 1" },
        { value: NaN, count: "Non-numeric or nonfinite: 1" }, { value: "2", count: "Non-numeric or nonfinite: 1" }
    ];
    for (const entry of cases) {
        await test.step(`reject ${String(entry.value)}`, async () => {
            await app.update(categoricalView([10, entry.value, 20]));
            await expect(page.getByRole("alert")).toHaveText(app.resources["en-US"].Invalid);
            await expect(page.locator(".invalid-counts")).toContainText(entry.count);
            await expect(page.locator(".total, .contribution-bar, .cumulative-line, .data-table")).toHaveCount(0);
        });
    }
    await app.update(categoricalView([Number.MAX_VALUE, Number.MAX_VALUE]));
    await expect(page.getByRole("alert")).toHaveText(app.resources["en-US"].Overflow);
    await expect(page.locator(".total, .cumulative-line")).toHaveCount(0);
});

test("partial data withholds shares by default, does not refetch on resize/style, and replaces aggregate append data", async ({ app, page }) => {
    const partial = categoricalView([60, 30], { labels: ["A", "B"], segmented: true });
    await app.update(partial);
    await expect(page.locator(".universe")).toHaveText(app.resources["en-US"].WithholdBrief);
    await expect(page.locator(".retrieval")).toHaveText(app.resources["en-US"].Loading);
    await expect(page.locator(".contribution-bar")).toHaveCount(2);
    await expect(page.locator(".total, .cumulative-line, .percent-axis-title, .threshold-line, .threshold-summary")).toHaveCount(0);
    await expect(page.locator(".rank-label")).toHaveText(["1", "2"]);
    expect((await tableRows(page)).map(row => row.slice(3))).toEqual(Array(2).fill(["Unavailable", "Unavailable", "Unavailable"]));
    await page.locator(".bar-target").first().hover();
    expect(await lastTooltip(app)).toMatchObject({
        "Denominator total": "Unavailable", "Contribution share": "Unavailable",
        "Cumulative share (%)": "Unavailable", "Cumulative contribution": "Unavailable", Threshold: "Unavailable"
    });
    expect((await app.state()).fetchRequests).toEqual([true]);
    await app.update(undefined, { type: 4, viewport: { width: 600, height: 500 } });
    partial.metadata.objects = { appearance: { fontSize: 16 } };
    await app.update(partial, { type: 16 });
    expect((await app.state()).fetchRequests).toEqual([true]);
    await expect(page.locator(".atlyn-pareto")).toHaveCSS("font-size", "16px");
    await app.update(categoricalView([60, 30, 10], { labels: ["A", "B", "C"] }), { operationKind: 1 });
    await expect(page.locator(".universe")).toHaveText("Completed query · 3 categories");
    await expect(page.locator(".total")).toHaveText("Denominator total: 100.00");
    await expect(page.locator(".contribution-bar")).toHaveCount(3);
    expect((await tableRows(page)).map(row => row[4])).toEqual(["60%", "90%", "100%"]);
    expect((await app.state()).fetchRequests).toEqual([true]);
    await app.update(categoricalView([5, 5]));
    await expect(page.locator(".total")).toHaveText("Denominator total: 10.00");
    await expect(page.locator(".contribution-bar")).toHaveCount(2);
});

test("subset opt-in labels its partial denominator and aggregates additional host rows without double-counting", async ({ app, page }) => {
    const objects = { analysis: { partialPolicy: "subset" } };
    await app.update(categoricalView([60, 30], { segmented: true, objects }));
    await expect(page.locator(".universe.warning")).toHaveText(app.resources["en-US"].SubsetBrief);
    await expect(page.locator(".total")).toHaveText("Denominator total: 90.00");
    expect((await tableRows(page)).map(row => row[4])).toEqual(["66.67%", "100%"]);
    await app.update(categoricalView([60, 30, 10], { segmented: true, objects }), { operationKind: 1 });
    await expect(page.locator(".total")).toHaveText("Denominator total: 100.00");
    expect((await tableRows(page)).map(row => row[4])).toEqual(["60%", "90%", "100%"]);
    expect((await app.state()).fetchRequests).toEqual([true, true]);
    await app.update(categoricalView([60, 30, 10], { objects }), { operationKind: 1 });
    await expect(page.locator(".universe")).toHaveText("Completed query · 3 categories");
    await expect(page.locator(".retrieval")).toHaveCount(0);
    await expect(page.locator(".total")).toHaveText("Denominator total: 100.00");
    expect((await app.state()).fetchRequests).toEqual([true, true]);
});

test("host refusal stops retrieval and leaves truthful incomplete messaging without hidden retries", async ({ app, page }) => {
    await page.evaluate(() => window.__paretoTest.setFetchAccepted(false));
    const partial = categoricalView([60, 30], { segmented: true });
    await app.update(partial);
    await expect(page.locator(".retrieval")).toHaveText(app.resources["en-US"].Refused);
    await app.update(undefined, { type: 4 });
    await app.update(partial, { type: 16 });
    await expect(page.locator(".cumulative-line, .total")).toHaveCount(0);
    expect((await app.state()).fetchRequests).toEqual([true]);
});

test.describe("host does not implement fetchMoreData", () => {
    test.use({ hostOptions: { fetchAvailable: false } });
    test("reports unsupported retrieval as refused, not a rendering failure or completed population", async ({ app, page }) => {
        const partial = categoricalView([60, 30], { segmented: true });
        await app.update(partial);
        await expect(page.locator(".retrieval")).toHaveText(app.resources["en-US"].Refused);
        await expect(page.locator(".universe")).toHaveText(app.resources["en-US"].WithholdBrief);
        await expect(page.getByRole("alert")).toHaveCount(0);
        await expect(page.locator(".contribution-bar")).toHaveCount(2);
        await expect(page.locator(".cumulative-line, .total")).toHaveCount(0);
        await app.update(undefined, { type: 4 });
        await app.update(partial, { type: 16 });
        expect((await app.state()).fetchRequests).toEqual([]);
        expect((await app.state()).events.filter(event => event.name === "failed")).toEqual([]);
    });
});

test("stalled aggregate and unexpected incremental segments stop fetching until a new create update", async ({ app, page }) => {
    const partial = categoricalView([60, 30], { segmented: true });
    await app.update(partial);
    await app.update(partial, { operationKind: 1 });
    await expect(page.locator(".retrieval")).toHaveText(app.resources["en-US"].Stalled);
    expect((await app.state()).fetchRequests).toEqual([true]);
    await app.update(categoricalView([10], { segmented: true }), { operationKind: 2 });
    await expect(page.locator(".retrieval")).toHaveText(app.resources["en-US"].Unexpected);
    await expect(page.locator(".counts")).toHaveText("Within the analysis bound: 1 categories; 1 rows received.");
    await expect(page.locator(".cumulative-line, .total")).toHaveCount(0);
    expect((await app.state()).fetchRequests).toEqual([true]);
    await app.update(partial);
    await expect(page.locator(".retrieval")).toHaveText(app.resources["en-US"].Loading);
    expect((await app.state()).fetchRequests).toEqual([true, true]);
});

test("100,000-category boundary stops fetching and excludes rows beyond the hard bound from an opted-in denominator", async ({ app, page }) => {
    test.setTimeout(120_000);
    await app.update(categoricalView(Array(100_000).fill(1), { segmented: true }));
    await expect(page.locator(".retrieval")).toHaveText(app.resources["en-US"].Limit);
    await expect(page.locator(".counts")).toHaveText("Within the analysis bound: 100,000 categories; 100,000 rows received.");
    await expect(page.locator(".contribution-bar")).toHaveCount(12);
    await expect(page.locator(".cumulative-line, .total")).toHaveCount(0);
    expect((await app.state()).fetchRequests).toEqual([]);
    await app.update(categoricalView([...Array(100_000).fill(1), 1_000_000], {
        objects: { analysis: { partialPolicy: "subset", pageSize: 10 } }
    }));
    await expect(page.locator(".retrieval")).toHaveText(app.resources["en-US"].Limit);
    await expect(page.locator(".universe")).toHaveText(app.resources["en-US"].SubsetBrief);
    await expect(page.locator(".counts")).toHaveText("Within the analysis bound: 100,000 categories; 100,001 rows received.");
    await expect(page.locator(".total")).toHaveText("Denominator total: 100,000.00");
    await expect(page.locator(".contribution-bar")).toHaveCount(10);
    expect((await tableRows(page))[0][2]).toBe("1.00");
    expect((await app.state()).fetchRequests).toEqual([]);
});

test("rank pagination preserves global cumulative values, denominator, and selection instead of adding Other", async ({ app, page }) => {
    await app.update(categoricalView(Array.from({ length: 25 }, (_, index) => 25 - index), {
        objects: { analysis: { pageSize: 10 } }
    }));
    await page.locator(".bar-target").first().click();
    await expect(page.locator(".total")).toHaveText("Denominator total: 325.00");
    await expect(page.getByRole("button", { name: "Previous ranks", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Next ranks", exact: true }).click();
    await expect(page.locator(".page-label")).toHaveText("11–20 / 25");
    expect((await tableRows(page))[0].slice(0, 5)).toEqual(["11", "Category 10", "15.00", "220.00", "67.69%"]);
    await expect(page.locator(".bar-target").first()).toBeFocused();
    const firstPointShare = await page.locator(".chart-scroll svg").evaluate(node => {
        const baseline = Number(node.querySelector(".value-tick")!.getAttribute("y")) - 4;
        const top = Number(node.querySelectorAll(".percent-tick")[4].getAttribute("y")) - 4;
        const firstY = Number(node.querySelector(".cumulative-point, .crossing-point")!.getAttribute("cy"));
        return (baseline - firstY) / (baseline - top);
    });
    expect(firstPointShare).toBeCloseTo(220 / 325, 8);
    await page.getByRole("button", { name: "Next ranks", exact: true }).click();
    await expect(page.locator(".bar-target")).toHaveCount(5);
    expect((await tableRows(page)).at(-1)?.slice(0, 5)).toEqual(["25", "Category 24", "1.00", "325.00", "100%"]);
    await expect(page.getByRole("button", { name: "Next ranks", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Previous ranks", exact: true }).click();
    await page.getByRole("button", { name: "Previous ranks", exact: true }).click();
    await expect(page.locator(".bar-target").first()).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".total")).toHaveText("Denominator total: 325.00");
    await expect(page.locator(".paging-note")).toHaveText(app.resources["en-US"].NoOther);
    expect((await app.state()).fetchRequests).toEqual([]);
});

test.describe("host high contrast and reduced motion", () => {
    test.use({ hostOptions: { highContrast: true, foreground: "#FFFF00", background: "#000000", foregroundSelected: "#00FFFF" } });
    test("uses host colors rather than custom colors and has no animated rendering", async ({ app, page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await app.update(categoricalView([60, 30, 10], {
            objects: { appearance: {
                barColor: { solid: { color: "#112233" } }, lineColor: { solid: { color: "#445566" } }
            } }
        }));
        await expect(page.locator(".atlyn-pareto")).toHaveCSS("color", "rgb(255, 255, 0)");
        await expect(page.locator(".atlyn-pareto")).toHaveCSS("background-color", "rgb(0, 0, 0)");
        for (const bar of await page.locator(".contribution-bar").all()) {
            await expect(bar).toHaveAttribute("fill", "#FFFF00");
            await expect(bar).toHaveAttribute("stroke", "#FFFF00");
        }
        await expect(page.locator(".cumulative-line")).toHaveAttribute("stroke", "#00FFFF");
        await page.locator(".bar-target").first().focus();
        await expect(page.locator(".hit-target").first()).toHaveCSS("stroke", "rgb(0, 255, 255)");
        const motion = await page.locator(".atlyn-pareto").evaluate(root => ({
            reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
            animations: root.getAnimations({ subtree: true }).length,
            activeStyles: Array.from(root.querySelectorAll("*")).filter(node => {
                const style = getComputedStyle(node);
                return style.animationName !== "none" || style.transitionDuration.split(",").some(value => parseFloat(value) > 0);
            }).length
        }));
        expect(motion).toEqual({ reduced: true, animations: 0, activeStyles: 0 });
    });
});

test.describe("French packaged resources", () => {
    test.use({ hostOptions: { locale: "fr-FR" } });
    test("localizes UI, formatting cards, numeric model formats, and host tooltip labels", async ({ app, page }) => {
        await app.update(categoricalView([1000, 250.5], { labels: ["A", "B"] }));
        await expect(page.locator(".universe")).toHaveText("Requête terminée · 2 catégories");
        await expect(page.locator(".total")).toHaveText(/Total du dénominateur: 1[\u00a0\u202f ]250,50/);
        await expect(page.getByRole("button", { name: "Effacer la sélection", exact: true })).toBeVisible();
        await expect(page.locator(".atlyn-pareto")).toHaveAttribute("dir", "ltr");
        expect(JSON.stringify(await app.formatting())).toContain('"displayName":"Analyse"');
        await page.locator(".bar-target").first().focus();
        const tooltip = await lastTooltip(app);
        expect(tooltip.Rang).toBe("1");
        expect(tooltip["Total du dénominateur"]).toMatch(/1[\u00a0\u202f ]250,50/);
        expect(tooltip["Part cumulée (%)"]).toMatch(/^79,97[\u00a0\u202f ]%$/);
    });
});

test.describe("Arabic host locale with English resource fallback", () => {
    test.use({ hostOptions: { locale: "ar-SA" } });
    test("sets RTL while preserving numeric chart direction and valid localized shares", async ({ app, page }) => {
        await app.update(categoricalView([60, 30, 10]));
        await expect(page.locator(".atlyn-pareto")).toHaveAttribute("dir", "rtl");
        await expect(page.locator(".atlyn-pareto")).toHaveCSS("direction", "rtl");
        await expect(page.locator(".chart-scroll")).toHaveCSS("direction", "ltr");
        await expect(page.locator(".universe")).toHaveText("Completed query · ٣ categories");
        await expect(page.getByRole("button", { name: "Clear selection", exact: true })).toBeVisible();
        const expected = new Intl.NumberFormat("ar-SA", { style: "percent", maximumFractionDigits: 2 }).format(0.6);
        expect((await tableRows(page))[0][4]).toBe(expected);
        await expect(page.locator(".cumulative-line")).not.toHaveAttribute("d", /NaN|Infinity/);
    });
});
