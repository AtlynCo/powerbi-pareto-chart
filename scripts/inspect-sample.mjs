import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import Ajv from "ajv";
import { readPackage, validatePackage } from "./package-utils.mjs";
import { inspectSampleLayout } from "./sample-layout.mjs";
import { readSampleModel } from "./sample-model.mjs";

const root = path.resolve(process.argv[2] ?? path.join("artifacts", "sample"));
const layout = inspectSampleLayout(root);
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const manifest = read("sample-manifest.json");
assert.equal(manifest.report.artifactVersion, layout.reportArtifactVersion);
assert.equal(manifest.report.definitionVersion, layout.reportDefinitionVersion);
const packaged = validatePackage(readPackage());
assert.equal(manifest.package.sha256, packaged.sha256);
const reportRoot = path.dirname(path.join(root, manifest.report.pbirPath));
const report = read(manifest.report.reportJsonPath);
assert.equal(report.settings?.enableDeveloperMode, undefined);
const resource = report.resourcePackages.find(item => item.type === "CustomVisual");
assert.equal(resource.name, packaged.payload.visual.guid);
assert.equal(resource.items.length, 1);
const resourceRoot = path.join(reportRoot, "CustomVisuals", resource.name);
assert.equal(resource.items[0].path, path.basename(packaged.manifest.resources[0].file));
assert.deepEqual(fs.readFileSync(path.join(resourceRoot, "package.json")), Buffer.from(packaged.entries["package.json"]));
assert.deepEqual(fs.readFileSync(path.join(resourceRoot, "resources", resource.items[0].path)),
    Buffer.from(packaged.entries[packaged.manifest.resources[0].file]));

const model = readSampleModel(root);
const pages = read("Atlyn Pareto.Report/definition/pages/pages.json");
assert.equal(pages.pageOrder.length, 3);
for (const pageName of pages.pageOrder) {
    const pageDirectory = path.join(reportRoot, "definition", "pages", pageName);
    const page = JSON.parse(fs.readFileSync(path.join(pageDirectory, "page.json"), "utf8"));
    const visuals = fs.readdirSync(path.join(pageDirectory, "visuals"));
    assert.equal(visuals.length, 2, `Expected the Pareto visual plus one usage-hint textbox on ${pageName}`);
    const visualJsons = visuals.map(name => JSON.parse(fs.readFileSync(path.join(pageDirectory, "visuals", name, "visual.json"), "utf8")));
    const item = visualJsons.find(candidate => candidate.visual.visualType === packaged.payload.visual.guid);
    assert.ok(item, `Missing Pareto visual on ${pageName}`);
    assert.equal(item.visual.visualType, packaged.payload.visual.guid);
    const hint = visualJsons.find(candidate => candidate.visual.visualType === "textbox");
    assert.ok(hint, `Missing usage-hint textbox on ${pageName}`);
    const hintText = hint.visual.objects.general[0].properties.paragraphs
        .flatMap(paragraph => paragraph.textRuns.map(run => run.value))
        .join(" ");
    assert.match(hintText, /Category/, `Usage hint on ${pageName} must name the required Category field`);
    assert.match(hintText, /Contribution/, `Usage hint on ${pageName} must name the required Contribution field`);
    assert.match(hintText, /context menu/i, `Usage hint on ${pageName} must mention the context menu`);
    assert.match(hintText, /Threshold/i, `Usage hint on ${pageName} must mention the Threshold filter`);
    assert.match(hintText, /100,000/, `Usage hint on ${pageName} must mention the category pagination limit`);
    assert.ok(item.position.width > 0 && item.position.height > 0);
    assert.ok(item.position.x + item.position.width <= page.width && item.position.y + item.position.height <= page.height);
    for (const role of ["Category", "Contribution", "Tooltips"]) {
        const projections = item.visual.query.queryState[role].projections;
        assert.equal(projections.length, 1);
        const field = projections[0].field[role === "Category" ? "Column" : "Measure"];
        const table = model.tables.find(table => table.name === field.Expression.SourceRef.Entity);
        assert.ok(table, `Missing bound table for ${pageName}/${role}`);
        assert.ok(table[role === "Category" ? "columns" : "measures"].includes(field.Property));
    }
    const properties = item.visual.objects.analysis[0].properties;
    assert.equal(properties.threshold.expr.Literal.Value, "80D");
    assert.equal(properties.partialPolicy.expr.Literal.Value, "'withhold'");
    assert.equal(item.visual.objects.appearance[0].properties.showTable.expr.Literal.Value, "true");
}
for (const size of [20, 300]) {
    const icon = fs.readFileSync(size === 20 ? "assets/icon.png" : "assets/icon-300.png");
    assert.equal(icon.readUInt32BE(16), size);
    assert.equal(icon.readUInt32BE(20), size);
}

const cache = path.resolve("artifacts", "schemas");
fs.mkdirSync(cache, { recursive: true });
const schemas = {};
const ajv = new Ajv({
    allErrors: true,
    schemaId: "auto",
    loadSchema: async uri => {
        assert.ok(uri.startsWith("https://developer.microsoft.com/json-schemas/"), `Unexpected schema host: ${uri}`);
        const key = createHash("sha256").update(uri).digest("hex");
        const filename = path.join(cache, `${key}.json`);
        if (!fs.existsSync(filename)) {
            const response = await fetch(uri);
            if (!response.ok) throw new Error(`Schema download ${response.status}: ${uri}`);
            fs.writeFileSync(filename, await response.text());
        }
        const bytes = fs.readFileSync(filename);
        schemas[uri] = { file: path.basename(filename), sha256: createHash("sha256").update(bytes).digest("hex") };
        return JSON.parse(bytes.toString("utf8"));
    }
});
const validated = [];
for (const relative of fs.readdirSync(root, { recursive: true })) {
    const filename = path.join(root, relative);
    if (!fs.statSync(filename).isFile() || !/\.(?:json|pbip|pbir|pbism)$/.test(filename) || filename.includes(`${path.sep}CustomVisuals${path.sep}`)) continue;
    const data = JSON.parse(fs.readFileSync(filename, "utf8"));
    if (!data.$schema) continue;
    const validate = await ajv.compileAsync({ $ref: data.$schema });
    assert.ok(validate(data), `${relative}: ${JSON.stringify(validate.errors)}`);
    validated.push(relative.replaceAll("\\", "/"));
}
const evidence = { packageSha256: packaged.sha256, layout, validated, schemas, resourceBytesMatchPackage: true,
    nativeValidation: "Not performed; schema and local binding/resource checks are not Power BI Desktop validation." };
const evidencePath = process.argv[2] ? path.join(root, "sample-validation.json") : path.join("artifacts", "sample-validation.json");
fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + "\n");
console.log(`Assembled sample: ${validated.length} schema-validated files, 3 bound pages, exact package resources ${packaged.sha256}. Native validation remains manual.`);
