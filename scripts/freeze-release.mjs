import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readPackage, validatePackage } from "./package-utils.mjs";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const packaged = validatePackage(readPackage());
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
assert.equal(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(), "", "Source must be committed and clean");
const inspection = read("artifacts/package-report.json");
const validation = read("artifacts/validation/report.json");
const quality = read("artifacts/quality/final/report.json");
const sample = read("artifacts/sample-validation.json");
const visualReview = read("artifacts/visual-review.json");
assert.equal(inspection.sourceCommit, commit);
assert.equal(inspection.sourceDirty, false);
assert.equal(validation.sourceCommit, commit);
assert.equal(validation.status, "passed");
assert.deepEqual(read("artifacts/build-report.json"), inspection.build);
for (const [file, expected] of Object.entries(inspection.sourceInputs)) assert.equal(hash(fs.readFileSync(file)), expected);
for (const value of [inspection.sha256, validation.packageSha256, quality.package.sha256, sample.packageSha256, visualReview.packageSha256]) {
    assert.equal(value, packaged.sha256, "All evidence must identify the exact final package");
}
assert.ok(visualReview.reviewedScreenshots.length >= 5, "Record visual inspection of the requested sizes/states");
for (const item of visualReview.reviewedScreenshots) assert.equal(hash(fs.readFileSync(item.file)), item.sha256);
for (const rows of [1000, 100000]) {
    const benchmark = quality.benchmarks.find(item => item.rows === rows);
    assert.ok(benchmark && benchmark.measuredSamples >= 20 && benchmark.warmupSamples >= 3);
    assert.equal(benchmark.operations.length, 3);
    for (const operation of benchmark.operations) {
        assert.equal(operation.syncMs.raw.length, benchmark.measuredSamples);
        assert.ok(operation.syncMs.raw.every(value => Number.isFinite(value) && value >= 0));
    }
}
assert.ok(quality.captures.every(item => item.renderFailedCount === 0));
for (const [width, height] of [[80, 80], [258, 198], [398, 298], [1280, 620], [1366, 768]]) {
    assert.ok(quality.captures.some(item => item.viewport.width === width && item.viewport.height === height));
}
assert.ok(quality.listingCandidates.length >= 1 && quality.listingCandidates.length <= 5);
for (const item of quality.listingCandidates) {
    const png = fs.readFileSync(item.file);
    assert.deepEqual(png, fs.readFileSync(item.sourceFile), "Listing image must be an unchanged package capture");
    assert.equal(png.readUInt32BE(16), 1366);
    assert.equal(png.readUInt32BE(20), 768);
    assert.ok(png.length <= 1024 * 1024);
}
const destination = path.resolve("artifacts", "releases", `${packaged.payload.visual.version}-${packaged.sha256.slice(0, 12)}`);
assert.ok(!fs.existsSync(destination), "Frozen releases are immutable; do not overwrite one");
fs.mkdirSync(destination, { recursive: true });
const copy = (source, target) => fs.cpSync(source, path.join(destination, target), { recursive: true });
copy(packaged.filename, path.basename(packaged.filename));
for (const [source, target] of [
    ["artifacts/package-report.json", "package-report.json"], ["artifacts/build-report.json", "build-report.json"],
    ["artifacts/validation", "validation"], ["artifacts/quality/final", "quality"], ["artifacts/sample", "sample"],
    ["artifacts/sample-validation.json", "sample-validation.json"], ["artifacts/schemas", "schemas"],
    ["artifacts/visual-review.json", "visual-review.json"], ["artifacts/dependency-licenses.json", "dependency-licenses.json"],
    ["artifacts/microsoft-sample/evidence.json", "microsoft-sample-evidence.json"],
    ["docs", "docs"], ["assets", "assets"], ["THIRD-PARTY-NOTICES.md", "THIRD-PARTY-NOTICES.md"]
]) copy(source, target);
if (fs.existsSync("artifacts/quality/baseline/report.json")) {
    copy("artifacts/quality/baseline/report.json", "baseline/report.json");
    copy("artifacts/quality/baseline/summary.txt", "baseline/summary.txt");
    copy("artifacts/quality/baseline/screenshots", "baseline/screenshots");
}
execFileSync("git", ["archive", "--format=zip", `--output=${path.join(destination, "source.zip")}`, "HEAD"]);
const files = {};
for (const relative of fs.readdirSync(destination, { recursive: true }).sort()) {
    const file = path.join(destination, relative);
    if (!fs.statSync(file).isFile()) continue;
    assert.ok(!/\.(pfx|pem|key|env)$/i.test(relative), "Private build material must not enter a release");
    const bytes = fs.readFileSync(file);
    files[relative.replaceAll("\\", "/")] = { bytes: bytes.length, sha256: hash(bytes) };
}
const manifest = {
    visual: packaged.payload.visual, sourceCommit: commit,
    sourceBranch: execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(),
    package: { filename: path.basename(packaged.filename), sha256: packaged.sha256, bytes: packaged.bytes.length },
    tools: { node: inspection.node, npm: inspection.packageManager, visualTools: inspection.tools, sdk: inspection.sdk, api: inspection.apiVersion },
    build: inspection.build, sourceInputs: inspection.sourceInputs, sourceInputSha256: inspection.sourceInputSha256,
    nativeValidation: "Not performed by this workstream; coordinator must validate Desktop/service, bookmarks, segmentation, exports and save the required PBIX.",
    publication: "Not submitted. Owner legal/pricing/privacy/support approval and authorized Partner Center actions remain outstanding.",
    files
};
fs.writeFileSync(path.join(destination, "release-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
const manifestHash = hash(fs.readFileSync(path.join(destination, "release-manifest.json")));
fs.writeFileSync(path.join(destination, "SHA256SUMS.txt"),
    [...Object.entries(files).map(([file, metadata]) => `${metadata.sha256}  ${file}`), `${manifestHash}  release-manifest.json`].join("\n") + "\n");
console.log(`Immutable release: ${destination}\nPackage SHA-256: ${packaged.sha256}\nSource: ${commit}`);
