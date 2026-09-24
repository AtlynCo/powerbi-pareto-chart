import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PBIR_ARTIFACT_VERSION, PBIR_DEFINITION_VERSION } from "./sample-versions.mjs";
import { readSampleModel } from "./sample-model.mjs";

export function inspectSampleLayout(root) {
    const required = [
        "Atlyn Pareto.pbip",
        "Atlyn Pareto.Report/definition.pbir",
        "Atlyn Pareto.Report/definition/report.json",
        "Atlyn Pareto.Report/definition/version.json",
        "Atlyn Pareto.Report/definition/pages/pages.json",
        "Atlyn Pareto.SemanticModel/definition.pbism",
        "Atlyn Pareto.SemanticModel/definition/database.tmdl",
        "Atlyn Pareto.SemanticModel/definition/model.tmdl",
        "Atlyn Pareto.SemanticModel/definition/tables/Defects.tmdl",
        "Atlyn Pareto.SemanticModel/definition/tables/Complaints.tmdl",
        "Atlyn Pareto.SemanticModel/definition/tables/CustomerRevenue.tmdl"
    ];
    for (const relative of required) {
        assert.ok(fs.existsSync(path.join(root, relative)), `Required sample file missing: ${relative}`);
        assert.ok(fs.statSync(path.join(root, relative)).isFile(), `Required sample file is not a file: ${relative}`);
    }
    const artifact = JSON.parse(fs.readFileSync(path.join(root, "Atlyn Pareto.Report/definition.pbir"), "utf8"));
    assert.equal(artifact.version, PBIR_ARTIFACT_VERSION, `Expected PBIR artifact version ${PBIR_ARTIFACT_VERSION}`);
    const version = JSON.parse(fs.readFileSync(path.join(root, "Atlyn Pareto.Report/definition/version.json"), "utf8"));
    assert.equal(version.version, PBIR_DEFINITION_VERSION, `Expected PBIR definition version ${PBIR_DEFINITION_VERSION}`);
    assert.equal(version.$schema, "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/versionMetadata/1.0.0/schema.json");
    const model = readSampleModel(root);
    assert.deepEqual(model.tables.map(table => table.name).sort(), ["Complaints", "CustomerRevenue", "Defects"]);
    return { required, modelFormat: "TMDL", reportArtifactVersion: artifact.version, reportDefinitionVersion: version.version };
}
