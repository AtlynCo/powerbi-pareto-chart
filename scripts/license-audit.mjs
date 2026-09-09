import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const allowed = new Set([
    "MIT", "ISC", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "0BSD", "CC0-1.0",
    "CC-BY-4.0", "Python-2.0", "BlueOak-1.0.0", "(MIT OR CC0-1.0)",
    "(WTFPL OR MIT)", "(MIT OR GPL-3.0-or-later)", "(MIT AND Zlib)"
]);
const rows = [];
for (const [location, entry] of Object.entries(lock.packages)) {
    if (!location) continue;
    const localPackage = path.join(location, "package.json");
    if (!fs.existsSync(localPackage)) {
        assert.ok(entry.optional, `Required locked dependency missing: ${location}`);
        continue;
    }
    const pkg = JSON.parse(fs.readFileSync(localPackage, "utf8"));
    assert.ok(allowed.has(pkg.license), `Review unknown license ${pkg.license} for ${pkg.name}@${pkg.version}`);
    rows.push({ name: pkg.name, version: pkg.version, license: pkg.license,
        selectedLicense: pkg.license.includes(" OR ") ? "MIT" : pkg.license, dev: !!entry.dev, location });
}
fs.mkdirSync("artifacts", { recursive: true });
fs.writeFileSync("artifacts/dependency-licenses.json", JSON.stringify(rows, null, 2) + "\n");
console.log(`License inventory: ${rows.length} installed packages with reviewed permissive licenses. See artifacts/dependency-licenses.json and THIRD-PARTY-NOTICES.md.`);
