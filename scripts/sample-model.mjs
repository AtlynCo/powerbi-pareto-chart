import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

export function readSampleModel(root) {
    const modelRoot = path.join(root, "Atlyn Pareto.SemanticModel");
    const definitionRoot = path.join(modelRoot, "definition");
    const tableRoot = path.join(definitionRoot, "tables");
    assert.ok(fs.existsSync(path.join(definitionRoot, "database.tmdl")));
    assert.ok(fs.existsSync(path.join(definitionRoot, "model.tmdl")));
    assert.ok(fs.existsSync(tableRoot));
    assert.ok(!fs.existsSync(path.join(modelRoot, "model.bim")),
        "The Desktop-ready sample must not retain the legacy model.bim beside TMDL");

    const pbism = JSON.parse(fs.readFileSync(path.join(modelRoot, "definition.pbism"), "utf8"));
    assert.equal(pbism.version, "4.0", "Expected semantic model definition version 4.0");
    const database = fs.readFileSync(path.join(definitionRoot, "database.tmdl"), "utf8");
    const compatibility = database.match(/^\s*compatibilityLevel:\s*(\d+)\s*$/m)?.[1];
    assert.equal(compatibility, "1601", "Expected semantic model compatibility level 1601");
    assert.match(database, /^database\s*$/m, "Expected an anonymous TMDL database");
    const model = fs.readFileSync(path.join(definitionRoot, "model.tmdl"), "utf8");
    assert.doesNotMatch(model, /PBI_QueryOrder/, "TMDL model must not use the unsupported PBI_QueryOrder annotation");
    for (const table of ["Defects", "Complaints", "CustomerRevenue"]) {
        assert.match(model, new RegExp(`^ref table ${table}$`, "m"), `Missing root-level TMDL model reference for ${table}`);
    }
    assert.doesNotMatch(model, /^[ \t]+ref table /m, "TMDL table references must be root-level");

    const tables = fs.readdirSync(tableRoot)
        .filter(filename => filename.endsWith(".tmdl"))
        .sort()
        .map(filename => {
            const source = fs.readFileSync(path.join(tableRoot, filename), "utf8");
            const name = source.match(/^table\s+(.+?)\s*$/m)?.[1];
            assert.ok(name, `Missing table name in ${filename}`);
            const columns = [...source.matchAll(/^\tcolumn\s+(.+?)\s*$/gm)].map(match => match[1]);
            const measures = [...source.matchAll(/^\tmeasure\s+'([^']+)'\s*=/gm)].map(match => match[1]);
            const partitions = [...source.matchAll(/^\tpartition\s+(.+?)\s*=\s*m\s*$/gm)];
            assert.equal(partitions.length, 1, `Expected one M partition in ${filename}`);
            assert.match(source, /^\t\tmode:\s+import\s*$/m, `Expected Import mode in ${filename}`);
            assert.match(source, /#table\(/, `Expected embedded #table data in ${filename}`);
            assert.doesNotMatch(source, /^\s+description:/m, `Unsupported TMDL description property found in ${filename}`);
            if (name === "CustomerRevenue") {
                assert.match(source, /type table \[Category = text, RevenueUSD = Currency\.Type, InvoiceCount = Int64\.Type\]/,
                    "CustomerRevenue must use a self-contained typed #table expression");
                assert.match(source, /\bin\s+Source\s*```/s, "CustomerRevenue M partition must return its local Source");
                assert.doesNotMatch(source, /Table\.TransformColumnTypes\s*\(\s*Source/,
                    "CustomerRevenue must not transform its own partition source");
            }
            assert.doesNotMatch(source, /(?:File|Web|Sql)\.Contents|https?:|[A-Z]:\\/i,
                `External data source found in ${filename}`);
            return { name, columns, measures, source, filename };
        });

    return { compatibility: Number(compatibility), tables };
}
