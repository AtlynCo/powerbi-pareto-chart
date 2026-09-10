import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PBIR_ARTIFACT_VERSION, PBIR_DEFINITION_VERSION } from "./sample-versions.mjs";

export function inspectSampleLayout(root) {
    const required = [
        "Atlyn Pareto.pbip",
        "Atlyn Pareto.Report/definition.pbir",
        "Atlyn Pareto.Report/definition/report.json",
        "Atlyn Pareto.Report/definition/version.json",
        "Atlyn Pareto.Report/definition/pages/pages.json",
        "Atlyn Pareto.SemanticModel/definition.pbism",
        "Atlyn Pareto.SemanticModel/model.bim"
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
    const modelRoot = path.join(root, "Atlyn Pareto.SemanticModel");
    assert.ok(!fs.readdirSync(modelRoot, { recursive: true }).some(file => file.endsWith(".tmdl")),
        "This sample uses model.bim (TMSL); do not mix a TMDL definition into the same semantic model");
    return { required, modelFormat: "TMSL", reportArtifactVersion: artifact.version, reportDefinitionVersion: version.version };
}
