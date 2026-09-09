import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { analyze } from "../src/model";
import { canonicalCategory } from "../src/data";

const samples = path.resolve("samples");
const database = JSON.parse(fs.readFileSync(path.join(samples, "Atlyn Pareto.SemanticModel", "model.bim"), "utf8"));

for (const scenario of [
    { file: "defect-count.csv", table: "Defects", total: 200, count: 9, crossing: "Packaging", cumulative: 160, tooltipTotal: 576 },
    { file: "complaint-cost.csv", table: "Complaints", total: 10000, count: 8, crossing: "Returns", cumulative: 8100, tooltipTotal: 100 }
]) {
    test(`${scenario.table} CSV, embedded PBIP data and documented Pareto result agree`, () => {
        const lines = fs.readFileSync(path.join(samples, scenario.file), "utf8").trim().split(/\r?\n/).slice(1);
        const csvRows = lines.map(line => {
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
        assert.equal(model.includedCount, 5);
        assert.equal(model.crossingRank, 4);
        assert.equal(model.rows[3].label, scenario.crossing);
        assert.equal(model.rows[3].cumulative, scenario.cumulative);
        assert.equal(model.rows[4].cumulativeShare, 0.9);
        assert.equal(model.rows.at(-1)?.value, 0);
        assert.equal(embedded.reduce((sum, row) => sum + row[2], 0), scenario.tooltipTotal);
    });
}

test("PBIP references real local report and model definitions, not cached or remote data", () => {
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
    assert.equal(database.model.tables.length, 2);
});
