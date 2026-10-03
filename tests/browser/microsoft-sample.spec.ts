import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { unzipSync, strFromU8 } from "fflate";
import { test, expect, tableRows } from "./fixtures";
import { categoricalView } from "./host-mock";

test("Microsoft-linked workbook category volumes agree with an independent integer oracle in the package", async ({ app, page }) => {
    const url = "https://raw.githubusercontent.com/PowerBi-Projects/PowerBI-visuals/gh-pages/assets/excel/workbook/test-visuals-data.xlsx";
    const directory = path.resolve("artifacts", "microsoft-sample");
    const filename = path.join(directory, "test-visuals-data.xlsx");
    mkdirSync(directory, { recursive: true });
    if (!existsSync(filename)) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Microsoft test workbook download failed: ${response.status}`);
        writeFileSync(filename, Buffer.from(await response.arrayBuffer()));
    }
    const bytes = readFileSync(filename);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    expect(sha256, "Review upstream workbook changes before accepting different test input").toBe("c17157c21cb99e1946dedca29e47a8f877fd0aaeadb57d2ba6ee8bcaec2b70e1");
    const archive = unzipSync(bytes);
    const data = await page.evaluate(({ stringsXml, sheetXml }) => {
        const parser = new DOMParser();
        const strings = parser.parseFromString(stringsXml, "application/xml");
        const sheet = parser.parseFromString(sheetXml, "application/xml");
        if (strings.querySelector("parsererror") || sheet.querySelector("parsererror")) throw new Error("Invalid workbook XML");
        const shared = Array.from(strings.getElementsByTagName("si"), item => item.textContent ?? "");
        const cell = (ref: string) => sheet.querySelector(`c[r="${ref}"]`);
        const text = (ref: string) => shared[Number(cell(ref)?.querySelector("v")?.textContent)];
        if (text("B7") !== "Produce" || text("C7") !== "Volume") throw new Error("Unexpected workbook columns");
        return Array.from({ length: 11 }, (_, index) => {
            const ref = `C${index + 8}`;
            if (cell(ref)?.querySelector("f")) throw new Error("Formula evaluation is outside this test adapter");
            return { label: text(`B${index + 8}`), value: Number(cell(ref)?.querySelector("v")?.textContent) };
        });
    }, { stringsXml: strFromU8(archive["xl/sharedStrings.xml"]), sheetXml: strFromU8(archive["xl/worksheets/sheet4.xml"]) });
    expect(data.every(row => row.label && Number.isSafeInteger(row.value) && row.value >= 0)).toBe(true);
    const total = data.reduce((sum, row) => sum + BigInt(row.value), 0n);
    expect(total).toBe(1219n);
    const ordered = [...data].sort((a, b) => b.value - a.value);
    let prefix = 0n;
    const expected = ordered.map(row => ({ ...row, cumulative: Number(prefix += BigInt(row.value)) }));
    const crossing = expected.findIndex(row => BigInt(row.cumulative) * 5n >= total * 4n) + 1;
    expect(crossing).toBe(7);
    const view = categoricalView(data.map(row => row.value), { labels: data.map(row => row.label), format: "#,0" });
    await app.update(view, { viewport: { width: 1280, height: 620 } });
    await expect(page.locator(".total")).toHaveText("Denominator total: 1,219");
    const actual = await tableRows(page);
    expect(actual).toHaveLength(11);
    for (let index = 0; index < expected.length; index++) {
        expect(actual[index][1]).toBe(expected[index].label);
        expect(Number(actual[index][2].replaceAll(",", ""))).toBe(expected[index].value);
        expect(Number(actual[index][3].replaceAll(",", ""))).toBe(expected[index].cumulative);
        expect(Math.abs(Number(actual[index][4].replace("%", "")) - expected[index].cumulative / Number(total) * 100)).toBeLessThanOrEqual(0.005);
    }
    await expect(page.locator(".threshold-summary")).toContainText("7 of 11 categories");
    writeFileSync(path.join(directory, "evidence.json"), JSON.stringify({
        url, sha256, sheet: "Word Cloud", cells: "B7:C18", categoryColumn: "Produce", additiveColumn: "Volume",
        categories: data.length, total: Number(total), firstCrossing: crossing,
        scope: "Actual packaged runtime with host mock; not native workbook import or Desktop validation.",
        redistribution: "Workbook used locally from the Microsoft-linked source; not included in the release handoff."
    }, null, 2) + "\n");
});
