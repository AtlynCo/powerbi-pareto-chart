import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { readPackage, validatePackage } from "./package-utils.mjs";

const { payload, metadata, sha256 } = validatePackage(readPackage());
assert.equal(metadata.externalJS, null);
assert.equal(metadata.dependencies, null);
assert.equal(metadata.author.name, "Atlyn");
assert.equal(metadata.visual.supportUrl, "https://www.atlynco.com/docs/faq");
for (const key of ["supportsHighlight", "supportsKeyboardFocus", "supportsLandingPage", "supportsEmptyDataView"]) {
    assert.equal(payload.capabilities[key], true, key);
}
assert.equal(payload.capabilities.dataViewMappings[0].categorical.categories.dataReductionAlgorithm.window.count, 10000);
const files = fs.readdirSync("src", { recursive: true }).filter(name => name.endsWith(".ts"));
const forbidden = [
    /\beval\s*\(/, /\bnew\s+Function\s*\(/, /\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\b/,
    /\.innerHTML\b/, /\.outerHTML\b/, /\binsertAdjacentHTML\b/, /document\.write\b/,
    /\b(?:localStorage|sessionStorage)\b/, /host\.(?:telemetry|launchUrl|authenticationService|licenseManager|webAccessService|downloadService|storageV2Service)\b/
];
for (const file of files) {
    const source = fs.readFileSync(path.join("src", file), "utf8");
    for (const pattern of forbidden) assert.ok(!pattern.test(source), `${file}: forbidden runtime construct ${pattern}`);
    for (const [, key] of source.matchAll(/(?:this\.t\(|displayNameKey:\s*)"([^"]+)"/g)) {
        assert.ok(payload.stringResources["en-US"][key], `${file}: missing localization ${key}`);
    }
}
for (const pattern of [/\beval\s*\(/, /\bnew\s+Function\s*\(/, /\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\b/]) {
    assert.ok(!pattern.test(payload.content.js), `Packaged runtime contains ${pattern}`);
}
assert.ok(!/@import\b|url\s*\(/i.test(payload.content.css), "CSS must not load external resources");
const en = payload.stringResources["en-US"];
const fr = payload.stringResources["fr-FR"];
assert.deepEqual(Object.keys(fr).sort(), Object.keys(en).sort(), "Localization key parity");
console.log(`Local certification-readiness static audit passed for ${sha256}. This is NOT Microsoft certification or host validation.`);
