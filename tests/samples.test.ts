import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { analyze } from "../src/model";
import { canonicalCategory } from "../src/data";
import { inspectSampleLayout } from "../scripts/sample-layout.mjs";
import { PBIR_ARTIFACT_VERSION, PBIR_DEFINITION_VERSION } from "../scripts/sample-versions.mjs";

const samples = path.resolve("samples");
const database = JSON.parse(fs.readFileSync(path.join(samples, "Atlyn Pareto.SemanticModel", "model.bim"), "utf8"));

for (const scenario of [
    { file: "defect-count.csv", table: "Defects", total: 200, count: 9, crossing: "Packaging", cumulative: 160, tooltipTotal: 576, crossingRank: 4, included: 5, includedShare: 0.9 },
    { file: "complaint-cost.csv", table: "Complaints", total: 10000, count: 8, crossing: "Returns", cumulative: 8100, tooltipTotal: 100, crossingRank: 4, included: 5, includedShare: 0.9 },
    { file: "customer-revenue.csv", table: "CustomerRevenue", total: 1000000, count: 25, crossing: "Customer portfolio 06 - national distributor umbrella", cumulative: 800000, tooltipTotal: 640, crossingRank: 6, included: 7, includedShare: 0.86 }
]) {
    test(`${scenario.table} CSV, embedded PBIP data and documented Pareto result agree`, () => {
        const lines = fs.readFileSync(path.join(samples, scenario.file), "utf8").trim().split(/\r?\n/).slice(1);
        const csvRows = lines.map((line): [string | null, number, number] => {
            const [category, value, tooltip] = line.split(",");
            return [category || null, Number(value), Number(tooltip)];
        });
        const table = database.model.tables.find((item: { name: string }) => item.name === scenario.table);
        assert.equal(table.partitions.length, 1);
        assert.equal(table.partitions[0].mode, "import");
        assert.equal(table.partitions[0].source.type, "m");
        const expression: string = table.partitions[0].source.expression.join("\n");
        assert.match(expression, /#table\(/);
        assert.doesNotMatch(expression, /(?:File|Web|Sql)\.Contents|https?:|[A-Z]:\\/i);
        const embedded = [...expression.matchAll(/^\s*\{((".*"|null),\s*\d+(?:\.\d+)?,\s*\d+)\},?\s*$/gm)]
            .map(match => JSON.parse(`[${match[1]}]`));
        assert.deepEqual(embedded, csvRows);
        const model = analyze(embedded.map(([category, value], index) => ({
            index, key: String(index), sortKey: canonicalCategory(category), label: category ?? "(Blank)", value
        })), 80);
        assert.equal(model.kind, "ready");
        assert.equal(model.total, scenario.total);
        assert.equal(model.rows.length, scenario.count);
        assert.equal(model.includedCount, scenario.included);
        assert.equal(model.crossingRank, scenario.crossingRank);
        assert.equal(model.rows[scenario.crossingRank - 1].label, scenario.crossing);
        assert.equal(model.rows[scenario.crossingRank - 1].cumulative, scenario.cumulative);
        assert.equal(model.rows[scenario.included - 1].cumulativeShare, scenario.includedShare);
        assert.equal(model.rows.at(-1)?.value, 0);
        assert.equal(embedded.reduce((sum, row) => sum + row[2], 0), scenario.tooltipTotal);
    });
}

test("PBIP references real local report and model definitions, not cached or remote data", () => {
    assert.equal(inspectSampleLayout(samples).modelFormat, "TMSL");
    const project = JSON.parse(fs.readFileSync(path.join(samples, "Atlyn Pareto.pbip"), "utf8"));
    assert.equal(project.artifacts.length, 1);
    const reportPath = path.resolve(samples, project.artifacts[0].report.path);
    assert.ok(reportPath.startsWith(samples + path.sep));
    const report = JSON.parse(fs.readFileSync(path.join(reportPath, "definition.pbir"), "utf8"));
    assert.deepEqual(Object.keys(report.datasetReference), ["byPath"]);
    const modelPath = path.resolve(reportPath, report.datasetReference.byPath.path);
    assert.ok(modelPath.startsWith(samples + path.sep));
    assert.ok(fs.existsSync(path.join(modelPath, "definition.pbism")));
    assert.ok(fs.existsSync(path.join(modelPath, "model.bim")));
    assert.equal(database.compatibilityLevel, 1600);
    assert.equal(database.model.tables.length, 3);
});

test("sample validation rejects missing PBIR version metadata even when remaining JSON is valid", t => {
    fs.mkdirSync(path.resolve("artifacts"), { recursive: true });
    const root = fs.mkdtempSync(path.resolve("artifacts", "sample-layout-"));
    t.after(() => fs.rmSync(root, { recursive: true }));
    fs.cpSync(samples, root, { recursive: true });
    inspectSampleLayout(root);
    const versionFile = path.join(root, "Atlyn Pareto.Report", "definition", "version.json");
    const versionBytes = fs.readFileSync(versionFile);
    fs.unlinkSync(versionFile);
    assert.throws(() => inspectSampleLayout(root), /Required sample file missing: .*version\.json/);
    fs.writeFileSync(versionFile, JSON.stringify({ $schema: JSON.parse(versionBytes.toString()).$schema, version: "1.0.0" }));
    assert.throws(() => inspectSampleLayout(root), /Expected PBIR definition version 2\.0\.0/);
    fs.writeFileSync(versionFile, versionBytes);
    inspectSampleLayout(root);
    fs.writeFileSync(path.join(root, "Atlyn Pareto.SemanticModel", "model.tmdl"), "model Model\n    ref table Defects\n");
    assert.throws(() => inspectSampleLayout(root), /do not mix a TMDL definition/);
});

test("each authored page pairs the Pareto visual with a concise usage-hint textbox (policy 1180.2.3.1)", () => {
    const pages = JSON.parse(fs.readFileSync(path.join(samples, "Atlyn Pareto.Report", "definition", "pages", "pages.json"), "utf8"));
    assert.equal(pages.pageOrder.length, 3);
    for (const pageName of pages.pageOrder) {
        const visualsRoot = path.join(samples, "Atlyn Pareto.Report", "definition", "pages", pageName, "visuals");
        const visualNames = fs.readdirSync(visualsRoot);
        assert.equal(visualNames.length, 2, `Expected the Pareto visual plus one usage-hint textbox on ${pageName}`);
        const visuals = visualNames.map(name => JSON.parse(fs.readFileSync(path.join(visualsRoot, name, "visual.json"), "utf8")));
        const chart = visuals.find(candidate => candidate.visual.visualType.startsWith("atlynPareto"));
        assert.ok(chart, `Missing Pareto visual on ${pageName}`);
        assert.ok(chart.position.width > 0 && chart.position.height > 0);
        const hint = visuals.find(candidate => candidate.visual.visualType === "textbox");
        assert.ok(hint, `Missing usage-hint textbox on ${pageName}`);
        assert.ok(hint.position.width > 0 && hint.position.height > 0);
        assert.ok(hint.position.y + hint.position.height <= chart.position.y, `Hint textbox must not overlap the chart on ${pageName}`);
        assert.ok(chart.position.y - (hint.position.y + hint.position.height) <= 16, `Hint textbox should sit just above the chart on ${pageName}`);
        const runs: { value: string }[] = hint.visual.objects.general[0].properties.paragraphs
            .flatMap((paragraph: { textRuns: { value: string }[] }) => paragraph.textRuns);
        const text = runs.map(run => run.value).join(" ");
        // The hint must document required field roles, selection/context-menu interaction,
        // the threshold filter, and the visual's category pagination limit.
        assert.match(text, /Category \(1\)/);
        assert.match(text, /Contribution \(1 measure\)/);
        assert.match(text, /Tooltips \(up to 5\)/);
        assert.match(text, /cross-filter/);
        assert.match(text, /context menu/i);
        assert.match(text, /Threshold %/);
        assert.match(text, /Maximum categories per page/);
        assert.match(text, /100,000 categories/);
    }
});

test("PBIR artifact 4.0 and definition 2.0.0 remain distinct and reject the native empty-report regression", t => {
    assert.equal(PBIR_ARTIFACT_VERSION, "4.0");
    assert.equal(PBIR_DEFINITION_VERSION, "2.0.0");
    const layout = inspectSampleLayout(samples);
    assert.equal(layout.reportArtifactVersion, "4.0");
    assert.equal(layout.reportDefinitionVersion, "2.0.0");
    fs.mkdirSync(path.resolve("artifacts"), { recursive: true });
    const root = fs.mkdtempSync(path.resolve("artifacts", "sample-versions-"));
    t.after(() => fs.rmSync(root, { recursive: true }));
    fs.cpSync(samples, root, { recursive: true });
    const definitionPath = path.join(root, "Atlyn Pareto.Report", "definition", "version.json");
    const definitionBytes = fs.readFileSync(definitionPath);
    const definition = JSON.parse(definitionBytes.toString());
    for (const unsupported of ["4.0.0", "4.0"]) {
        fs.writeFileSync(definitionPath, JSON.stringify({ ...definition, version: unsupported }));
        assert.throws(() => inspectSampleLayout(root), /Expected PBIR definition version 2\.0\.0/);
    }
    fs.writeFileSync(definitionPath, definitionBytes);
    const artifactPath = path.join(root, "Atlyn Pareto.Report", "definition.pbir");
    const artifactBytes = fs.readFileSync(artifactPath);
    const artifact = JSON.parse(artifactBytes.toString());
    for (const swapped of ["2.0.0", "4.0.0"]) {
        fs.writeFileSync(artifactPath, JSON.stringify({ ...artifact, version: swapped }));
        assert.throws(() => inspectSampleLayout(root), /Expected PBIR artifact version 4\.0/);
    }
    fs.writeFileSync(artifactPath, artifactBytes);
    inspectSampleLayout(root);
});
