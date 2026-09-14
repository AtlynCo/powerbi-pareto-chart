import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { unzipSync, strFromU8 } from "fflate";
import assert from "node:assert/strict";

export function readPackage(packagePath) {
    const metadata = JSON.parse(fs.readFileSync("pbiviz.json", "utf8"));
    const filename = path.resolve(packagePath ?? path.join("dist", `${metadata.visual.guid}.${metadata.visual.version}.pbiviz`));
    assert.ok(fs.existsSync(filename), `Build the current package first: ${filename}`);
    const bytes = fs.readFileSync(filename);
    const entries = unzipSync(bytes);
    const resourceFiles = Object.keys(entries).filter(name => name.endsWith(".pbiviz.json"));
    assert.equal(resourceFiles.length, 1, "Expected one visual resource payload");
    const payload = JSON.parse(strFromU8(entries[resourceFiles[0]]));
    const manifest = JSON.parse(strFromU8(entries["package.json"]));
    return { metadata, filename, bytes, entries, manifest, payload, sha256: createHash("sha256").update(bytes).digest("hex") };
}

export function validatePackage(result) {
    const { metadata, payload, entries, manifest } = result;
    assert.equal(payload.visual.guid, "atlynPareto18722664651549C392ABF6B1EBA46945");
    assert.equal(payload.visual.version, "1.1.1.0");
    assert.equal(payload.visual.version, metadata.visual.version);
    assert.equal(payload.visual.displayName, "Atlyn Pareto");
    assert.equal(payload.apiVersion, "5.11.0");
    assert.equal(payload.apiVersion, metadata.apiVersion);
    assert.equal(payload.visual.guid, metadata.visual.guid);
    assert.deepEqual(payload.capabilities.privileges, []);
    assert.deepEqual(payload.capabilities, JSON.parse(fs.readFileSync("capabilities.json", "utf8")));
    assert.ok(payload.content.js.length > 1000, "A real compiled visual must be included");
    assert.ok(payload.content.js.includes("Permission is hereby granted"), "Runtime permission notices must be embedded");
    assert.ok(payload.content.js.includes("Copyright Software Freedom Conservancy, Inc."), "Vendored Globalize attribution missing");
    assert.ok(payload.content.css.includes("atlyn-pareto"), "Compiled visual styles missing");
    assert.ok(payload.content.iconBase64.length > 50, "Icon payload missing");
    const icon = Buffer.from(payload.content.iconBase64.replace(/^data:image\/png;base64,/, ""), "base64");
    assert.deepEqual(icon, fs.readFileSync("assets/icon.png"), "Packaged icon must match the original source asset");
    assert.equal(icon.readUInt32BE(16), 20);
    assert.equal(icon.readUInt32BE(20), 20);
    assert.ok(payload.stringResources["en-US"].Title === "Atlyn Pareto");
    assert.ok(payload.stringResources["fr-FR"].Role_Category.length > 0);
    assert.deepEqual(manifest.visual, payload.visual);
    assert.equal(manifest.version, payload.visual.version);
    assert.equal(manifest.resources.length, 1);
    assert.ok(entries[manifest.resources[0].file], "Manifest must reference an actual archive resource");
    assert.equal(manifest.metadata.pbivizjson.resourceId, manifest.resources[0].resourceId);
    assert.ok(Object.keys(entries).every(name => !name.includes("..") && !name.startsWith("/")));
    assert.ok(!Object.keys(entries).some(name => /\.(map|ts|env|pem|key|pfx)$/.test(name)), "Source maps or private files included");
    return result;
}
