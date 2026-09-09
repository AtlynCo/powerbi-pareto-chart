import { test, expect, tableRows, lastTooltip, formattingValues } from "./fixtures";
import { categoricalView } from "./host-mock";

test("cached resizing and appearance/bookmark updates preserve arithmetic without rebuilding native identities", async ({ app, page }) => {
    const view = categoricalView([50, 30, 15, 5], { keys: ["a", "b", "c", "d"] });
    await app.update(view);
    await page.locator(".bar-target").nth(1).focus();
    const builders = (await app.state()).builderKeys.length;
    await app.update(undefined, { type: 4, viewport: { width: 398, height: 298 } });
    expect((await app.state()).builderKeys.length).toBe(builders);
    await expect(page.locator('.bar-target[data-row-index="1"]')).toBeFocused();
    view.metadata.objects = { analysis: { threshold: 50 }, appearance: { lineColor: { solid: { color: "#AA4400" } } } };
    await app.update(view, { type: 16 });
    expect((await app.state()).builderKeys.length).toBe(builders);
    await expect(page.locator(".threshold-summary")).toContainText("1 of 4 categories");
    await expect(page.locator(".total")).toHaveText("Denominator total: 100.00");
});

test("saved rank position can be persisted and replayed by native formatting/bookmark metadata", async ({ app, page }) => {
    const view = categoricalView(Array.from({ length: 40 }, (_, i) => 40 - i), { objects: { analysis: { pageSize: 10 } } });
    await app.update(view);
    await page.getByLabel("Go to rank", { exact: false }).fill("23");
    await page.getByRole("button", { name: "Go", exact: true }).click();
    expect((await app.state()).persisted.at(-1)?.merge?.[0]).toMatchObject({
        objectName: "analysis", properties: { startRank: 23 }
    });
    expect((await tableRows(page))[0][0]).toBe("21");
    await app.update(undefined, { type: 4 });
    expect((await tableRows(page))[0][0]).toBe("21");
    expect(formattingValues(await app.formatting())["analysis.startRank"]).toBe(23);
    view.metadata.objects = { analysis: { pageSize: 10, startRank: 11, threshold: 60 } };
    await app.update(view, { type: 16 });
    expect((await tableRows(page))[0][0]).toBe("11");
    expect(formattingValues(await app.formatting())).toMatchObject({ "analysis.startRank": 11, "analysis.threshold": 60 });
    await page.getByRole("button", { name: "Show threshold", exact: true }).click();
    expect((await tableRows(page)).some(row => row[5] === "First threshold crossing")).toBe(true);
    // New filtered query has its own denominator and clamps the saved rank.
    await app.update(categoricalView([8, 2], { keys: ["c", "d"], objects: view.metadata.objects }));
    await expect(page.locator(".total")).toHaveText("Denominator total: 10.00");
    expect((await tableRows(page)).map(row => row[4])).toEqual(["80%", "100%"]);
    expect(formattingValues(await app.formatting())["analysis.startRank"]).toBe(2);
});

test("persisted threshold zero is visibly normalized to the supported minimum; 100 includes every positive contribution", async ({ app, page }) => {
    await app.update(categoricalView([80, 20, 0], { objects: { analysis: { threshold: 0 } } }));
    expect(formattingValues(await app.formatting())["analysis.threshold"]).toBe(1);
    await expect(page.locator(".threshold-summary")).toContainText("1% threshold");
    await app.update(categoricalView([80, 20, 0], { objects: { analysis: { threshold: 100 } } }));
    await expect(page.locator(".rank-label")).toHaveText(["1*", "2*", "3"]);
    await expect(page.locator(".threshold-summary")).toContainText("2 of 3 categories");
    await app.update(categoricalView([80, 20, 0], {
        objects: { analysis: { threshold: NaN, pageSize: Infinity, startRank: -50, partialPolicy: "unsupported" }, appearance: { fontSize: NaN } }
    }));
    expect(formattingValues(await app.formatting())).toMatchObject({
        "analysis.threshold": 80, "analysis.pageSize": 30, "analysis.startRank": 1,
        "analysis.partialPolicy": "withhold", "appearance.fontSize": 12
    });
    await expect(page.locator(".contribution-bar")).toHaveCount(3);
});

test("shrinking final Append stays incomplete and malformed duplicate identity errors survive resize until corrected", async ({ app, page }) => {
    await app.update(categoricalView([60, 30], { segmented: true }));
    await app.update(categoricalView([10]), { operationKind: 1 });
    await expect(page.locator(".retrieval")).toHaveText(app.resources["en-US"].Unexpected);
    await expect(page.locator(".cumulative-line")).toHaveCount(0);
    app.expectedRenderFailures = 2;
    await app.update(categoricalView([8, 2], { keys: ["duplicate", "duplicate"] }));
    await expect(page.getByRole("alert")).toHaveText(app.resources["en-US"].Failure);
    await app.update(undefined, { type: 4, viewport: { width: 80, height: 80 } });
    await expect(page.getByRole("alert")).toHaveText(app.resources["en-US"].Failure);
    await expect(page.getByRole("region")).toHaveAttribute("aria-label", `Atlyn Pareto. ${app.resources["en-US"].Failure}`);
    expect((await page.getByRole("region").boundingBox())!.width).toBe(80);
    await app.update(categoricalView([8, 2]));
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.locator(".total")).toHaveText("Denominator total: 10.00");
});

test("table keyboard multiselection preserves Ctrl and does not double-dispatch native button activation", async ({ app, page }) => {
    await app.update(categoricalView([6, 3, 1]));
    const buttons = page.locator(".category-button");
    await buttons.nth(0).focus();
    await page.keyboard.press("Enter");
    await buttons.nth(1).focus();
    await page.keyboard.press("Control+Space");
    expect((await app.state()).selections).toEqual([
        { keys: ["category:row-0"], multiSelect: false },
        { keys: ["category:row-1"], multiSelect: true }
    ]);
});

test("progressive field binding identifies the missing field rather than implying an empty result", async ({ app, page }) => {
    const categoryOnly = categoricalView([3]);
    categoryOnly.metadata.columns = categoryOnly.metadata.columns.filter(column => column.roles?.Category);
    categoryOnly.categorical!.values = undefined;
    await app.update(categoryOnly);
    await expect(page.getByText(app.resources["en-US"].BindContribution, { exact: true })).toBeVisible();
    const measureOnly = categoricalView([3]);
    measureOnly.metadata.columns = measureOnly.metadata.columns.filter(column => column.roles?.Contribution);
    measureOnly.categorical!.categories = undefined;
    await app.update(measureOnly);
    await expect(page.getByText(app.resources["en-US"].BindCategory, { exact: true })).toBeVisible();
    await app.update(categoricalView([3]));
    await expect(page.locator(".cumulative-line")).toHaveCount(1);
    const metadataOnly = categoricalView([3]);
    metadataOnly.categorical = undefined;
    await app.update(metadataOnly);
    await expect(page.getByText(app.resources["en-US"].NoRowsDelivered, { exact: true })).toBeVisible();
    await app.update(categoricalView([3]), { viewport: { width: 80, height: 80 } });
    await expect(page.getByRole("region")).toHaveAttribute("aria-label", /Denominator total/);
    await app.update(categoricalView([]), { viewport: { width: 80, height: 80 } });
    await expect(page.getByRole("region")).toHaveAttribute("aria-label", new RegExp(app.resources["en-US"].Empty.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    await expect(page.getByRole("region")).not.toHaveAttribute("aria-label", /Denominator total/);
});

test("huge and tiny values retain finite SVG geometry and nonzero scientific axis labels with model-format tooltips", async ({ app, page }) => {
    for (const values of [[1e300, 5e299, 0], [1e-300, 5e-301, 0]]) {
        await app.update(categoricalView(values));
        const text = await page.locator(".chart-scroll svg").getAttribute("viewBox");
        expect(text).not.toMatch(/NaN|Infinity/);
        await expect(page.locator(".cumulative-line")).not.toHaveAttribute("d", /NaN|Infinity/);
        const ticks = await page.locator(".value-tick").allTextContents();
        expect(ticks.at(-1)).toMatch(/E|e|×/);
        await page.locator(".bar-target").first().focus();
        expect((await lastTooltip(app))["Cumulative share (%)"]).toBe("66.67%");
    }
});

test("large text keeps rank and two-line labels apart; compact category touch targets remain at least 44 pixels", async ({ app, page }) => {
    const values = Array.from({ length: 30 }, (_, i) => 30 - i);
    await app.update(categoricalView(values, {
        labels: values.map((_, i) => `Long category name number ${i + 1}`),
        objects: { appearance: { fontSize: 24 } }
    }), { viewport: { width: 1280, height: 620 } });
    await expect(page.locator(".category-label").first().locator("tspan")).toHaveCount(2);
    const geometry = await page.locator(".bar-target").first().evaluate(group => {
        const rank = group.querySelector<SVGTextElement>(".rank-label")!.getBBox();
        const category = group.querySelector<SVGTextElement>(".category-label")!.getBBox();
        const chart = group.closest("svg")!;
        const valueTitle = chart.querySelector<SVGTextElement>(".value-axis-title")!.getBBox();
        const shareTitle = chart.querySelector<SVGTextElement>(".percent-axis-title")!.getBBox();
        return { rankBottom: rank.y + rank.height, labelTop: category.y, labelBottom: category.y + category.height,
            height: chart.viewBox.baseVal.height, valueTitleBottom: valueTitle.y + valueTitle.height, shareTitleTop: shareTitle.y };
    });
    expect(geometry.rankBottom).toBeLessThanOrEqual(geometry.labelTop);
    expect(geometry.labelBottom).toBeLessThanOrEqual(geometry.height);
    expect(geometry.valueTitleBottom).toBeLessThanOrEqual(geometry.shareTitleTop);
    await app.update(undefined, { type: 4, viewport: { width: 258, height: 198 } });
    for (const target of await page.locator(".hit-target").all()) {
        const bounds = await target.boundingBox();
        expect(bounds!.width).toBeGreaterThanOrEqual(44);
        expect(bounds!.height).toBeGreaterThanOrEqual(44);
    }
});

test("wide glyphs and Unicode clusters fit their category bands even when selected", async ({ app, page }) => {
    await app.update(categoricalView(Array(20).fill(1), {
        labels: Array.from({ length: 20 }, (_, index) => `${"W".repeat(25)} 👩🏽‍🔬 e\u0301 ${index}`)
    }), { viewport: { width: 398, height: 298 } });
    await app.incomingSelection(["category:row-0"]);
    const widths = await page.locator(".bar-target").evaluateAll(groups => groups.map(group => ({
        available: Number(group.querySelector(".hit-target")!.getAttribute("width")) / 0.8 - 6,
        lines: Array.from(group.querySelectorAll<SVGTSpanElement>(".category-label tspan"), line => line.getBBox().width)
    })));
    for (const row of widths) for (const width of row.lines) expect(width).toBeLessThanOrEqual(row.available + 0.5);
    await expect(page.locator(".category-label title").first()).toContainText("👩🏽‍🔬 e\u0301");
});

test("a known invalid received tail beyond the ranking cap cannot be concealed by subset opt-in", async ({ app, page }) => {
    test.setTimeout(120000);
    await app.update(categoricalView([...Array(100000).fill(1), -1, null, Infinity], {
        objects: { analysis: { partialPolicy: "subset" } }
    }));
    await expect(page.getByRole("alert")).toHaveText(app.resources["en-US"].Invalid);
    await expect(page.locator(".invalid-counts")).toHaveText("Blank or missing: 1; Non-numeric or nonfinite: 1; Negative: 1");
    await expect(page.locator(".total, .cumulative-line, .contribution-bar")).toHaveCount(0);
    await app.update(categoricalView([1], { objects: { analysis: { threshold: 100, partialPolicy: "subset" } } }), { type: 16 });
    await expect(page.getByRole("alert")).toHaveText(app.resources["en-US"].Invalid);
    await expect(page.locator(".invalid-counts")).toContainText("Negative: 1");
});

test("wide charts give long customer labels enough room to distinguish portfolio identifiers", async ({ app, page }) => {
    await app.update(categoricalView(Array.from({ length: 25 }, (_, index) => 25 - index), {
        labels: Array.from({ length: 25 }, (_, index) => `Customer portfolio ${String(index + 1).padStart(2, "0")} - enterprise renewal program`)
    }), { viewport: { width: 1366, height: 768 } });
    const labels = await page.locator(".category-label").evaluateAll(elements => elements.map(element =>
        Array.from(element.querySelectorAll("tspan"), span => span.textContent).join(" ")));
    expect(labels.length).toBeGreaterThanOrEqual(5);
    expect(labels.length).toBeLessThan(25);
    for (const [index, label] of labels.entries()) expect(label).toContain(String(index + 1).padStart(2, "0"));
    await expect(page.locator(".total")).toHaveText("Denominator total: 325.00");
    await page.getByRole("button", { name: "Show threshold", exact: true }).click();
    expect((await tableRows(page)).some(row => row[5] === "First threshold crossing")).toBe(true);
    await expect(page.locator(".total")).toHaveText("Denominator total: 325.00");
});

test.describe("browser touch input", () => {
    test.use({ hasTouch: true });
    test("a touchscreen tap selects a native category and supplies a touch tooltip", async ({ app, page }) => {
        await app.update(categoricalView([60, 30, 10]), { viewport: { width: 398, height: 298 } });
        await page.locator(".hit-target").first().tap();
        const state = await app.state();
        expect(state.selections.at(-1)).toEqual({ keys: ["category:row-0"], multiSelect: false });
        expect(state.tooltips.some(call => call.name === "show" && call.options.isTouchEvent)).toBe(true);
    });
});
