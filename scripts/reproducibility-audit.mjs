import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(path.join(root, "pbiviz.json"), "utf8"));
const packageName = `${manifest.visual.guid}.${manifest.visual.version}.pbiviz`;
const packagePath = path.join(root, "dist", packageName);
const npmCommand = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "npm";
const npmArguments = process.platform === "win32"
    ? ["/d", "/s", "/c", "npm run package"]
    : ["run", "package"];
const runTimezones = ["Etc/GMT+12", "Etc/GMT-14"];

const EXPECTED_MANIFEST_BYTES = 763;
const EXPECTED_MANIFEST_SHA256 = "d675f6ed2f35b305805396ce0894887c6299e548e435c781c25a7ea7c4a82046";
const EXPECTED_RESOURCE_BYTES = 729125;
const EXPECTED_RESOURCE_SHA256 = "3c440d1d7526fd0fc743a8ac4a8402409d4517e86c25a792623614f7d61c06af";

function sha256(bytes) {
    return createHash("sha256").update(bytes).digest("hex");
}

function runPackage(timezone) {
    console.log(`Running package under TZ=${timezone}...`);
    const result = spawnSync(npmCommand, npmArguments, {
        cwd: root,
        env: { ...process.env, TZ: timezone },
        stdio: "inherit"
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Packaging under TZ=${timezone} failed with code ${result.status}`);
    if (!existsSync(packagePath) || statSync(packagePath).size === 0) {
        throw new Error(`Package missing or empty at ${packagePath}`);
    }
    const bytes = readFileSync(packagePath);
    return { bytes, hash: sha256(bytes), size: bytes.length };
}

console.log("=== Deterministic PBIVIZ Reproducibility Audit ===");
const first = runPackage(runTimezones[0]);
const second = runPackage(runTimezones[1]);

console.log(`Run 1 (TZ=${runTimezones[0]}): ${first.size} bytes, SHA-256 ${first.hash}`);
console.log(`Run 2 (TZ=${runTimezones[1]}): ${second.size} bytes, SHA-256 ${second.hash}`);

if (!first.bytes.equals(second.bytes) || first.hash !== second.hash) {
    throw new Error(`Archive bytes differ across timezones! ${first.hash} !== ${second.hash}`);
}
console.log("PASS: Whole-file archive is 100% byte-for-byte deterministic across opposite timezones.");

// Inspect inner members of the normalized archive
const entries = unzipSync(first.bytes);
const manifestEntry = entries["package.json"];
if (!manifestEntry) throw new Error("package.json entry missing from archive");
const manifestHash = sha256(manifestEntry);
console.log(`package.json: ${manifestEntry.length} bytes, SHA-256 ${manifestHash}`);
if (manifestEntry.length !== EXPECTED_MANIFEST_BYTES || manifestHash !== EXPECTED_MANIFEST_SHA256) {
    throw new Error(`package.json member mismatch! Expected ${EXPECTED_MANIFEST_BYTES} B (${EXPECTED_MANIFEST_SHA256}), got ${manifestEntry.length} B (${manifestHash})`);
}

const resourceKey = `resources/${manifest.visual.guid}.pbiviz.json`;
const resourceEntry = entries[resourceKey];
if (!resourceEntry) throw new Error(`${resourceKey} entry missing from archive`);
const resourceHash = sha256(resourceEntry);
console.log(`visual resource: ${resourceEntry.length} bytes, SHA-256 ${resourceHash}`);
if (resourceEntry.length !== EXPECTED_RESOURCE_BYTES || resourceHash !== EXPECTED_RESOURCE_SHA256) {
    throw new Error(`Visual resource member mismatch! Expected ${EXPECTED_RESOURCE_BYTES} B (${EXPECTED_RESOURCE_SHA256}), got ${resourceEntry.length} B (${resourceHash})`);
}
console.log("PASS: Inner member uncompressed bytes and SHA-256 hashes match accepted production baseline.");

// Check against Native PBIX if present
const pbixCandidate = "C:\\pbicert\\output\\AtlynPareto-1.1.2.0-native.pbix";
if (existsSync(pbixCandidate)) {
    const pbixBytes = readFileSync(pbixCandidate);
    const pbixEntries = unzipSync(pbixBytes);
    const pbixPkg = pbixEntries[`Report/CustomVisuals/${manifest.visual.guid}/package.json`];
    const pbixRes = pbixEntries[`Report/CustomVisuals/${manifest.visual.guid}/resources/${manifest.visual.guid}.pbiviz.json`];
    if (pbixPkg && pbixRes) {
        const pkgMatch = Buffer.from(manifestEntry).equals(Buffer.from(pbixPkg));
        const resMatch = Buffer.from(resourceEntry).equals(Buffer.from(pbixRes));
        console.log(`Native PBIX raw package.json byte parity: ${pkgMatch}`);
        console.log(`Native PBIX raw resource byte parity:     ${resMatch}`);
        if (!pkgMatch || !resMatch) throw new Error("Native PBIX byte parity check failed!");
        console.log("PASS: 100% byte-exact parity with accepted native PBIX.");
    }
}

// Check against C:\pbicert\pareto-aligned-pr6 stage
const stageDir = "C:\\pbicert\\pareto-aligned-pr6";
if (existsSync(stageDir)) {
    const stagePkgPath = path.join(stageDir, "Atlyn Pareto.Report", "CustomVisuals", manifest.visual.guid, "package.json");
    const stageResPath = path.join(stageDir, "Atlyn Pareto.Report", "CustomVisuals", manifest.visual.guid, "resources", `${manifest.visual.guid}.pbiviz.json`);
    if (existsSync(stagePkgPath) && existsSync(stageResPath)) {
        const stagePkgBytes = readFileSync(stagePkgPath);
        const stageResBytes = readFileSync(stageResPath);
        const stagePkgHash = sha256(stagePkgBytes);
        const stageResHash = sha256(stageResBytes);
        console.log(`Stage pareto-aligned-pr6 package.json: ${stagePkgBytes.length} bytes, SHA-256 ${stagePkgHash}`);
        console.log(`Stage pareto-aligned-pr6 resource:     ${stageResBytes.length} bytes, SHA-256 ${stageResHash}`);
        if (stagePkgHash !== EXPECTED_MANIFEST_SHA256 || stageResHash !== EXPECTED_RESOURCE_SHA256) {
            throw new Error("Stage pareto-aligned-pr6 does not match production members!");
        }
        console.log("PASS: Stage pareto-aligned-pr6 verified matching production members.");
    }
}
