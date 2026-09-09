import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const names = [
    "powerbi-visuals-api", "powerbi-visuals-utils-formattingmodel", "powerbi-visuals-utils-formattingutils",
    "powerbi-visuals-utils-dataviewutils", "powerbi-visuals-utils-typeutils", "semver"
];
const components = names.map(name => {
    const directory = path.join("node_modules", name);
    const pkg = JSON.parse(fs.readFileSync(path.join(directory, "package.json"), "utf8"));
    return { name, version: pkg.version, license: fs.readFileSync(path.join(directory, "LICENSE"), "utf8").replace(/\r\n/g, "\n").trim() };
});
const vendorSource = fs.readFileSync("node_modules/powerbi-visuals-utils-formattingutils/lib/globalize/globalize.js", "utf8");
assert.ok(vendorSource.includes("Copyright Software Freedom Conservancy, Inc."));
assert.ok(vendorSource.includes("Dual licensed under the MIT or GPL Version 2 licenses."));
components.push({
    name: "Globalize (vendored in formattingutils; MIT option)",
    version: "",
    license: fs.readFileSync("licenses/globalize-MIT.txt", "utf8").trim()
});
const contents = JSON.stringify({ components }, null, 2) + "\n";
const filename = "src/third-party-notices.json";
if (process.argv.includes("--check")) {
    assert.equal(fs.readFileSync(filename, "utf8").replace(/\r\n/g, "\n"), contents, "Regenerate notices after dependency changes");
} else {
    fs.writeFileSync(filename, contents);
}
