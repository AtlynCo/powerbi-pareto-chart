import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readPackage, validatePackage } from "./package-utils.mjs";

const result = validatePackage(readPackage());
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const sources = ["pbiviz.json", "capabilities.json", "package.json", "package-lock.json", "tsconfig.json", "eslint.config.mjs", "assets/icon.png",
    "scripts/build.mjs", "scripts/build-certificate.ps1", "scripts/generate-notices.mjs"];
for (const directory of ["src", "style", "stringResources"]) {
    for (const file of fs.readdirSync(directory, { recursive: true })) {
        const full = path.join(directory, file);
        if (fs.statSync(full).isFile()) sources.push(full);
    }
}
const sourceInputs = Object.fromEntries(sources.sort().map(file => [file.replaceAll("\\", "/"), hash(fs.readFileSync(file))]));
const gitAvailable = fs.existsSync(".git");
if (!gitAvailable) console.warn("Source archive has no Git metadata; release provenance must be supplied separately.");
const sourceCommit = gitAvailable ? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() : null;
const sourceDirty = gitAvailable ? execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0 : null;
const assets = Object.fromEntries(["assets/icon.png", "assets/icon-300.png", "assets/icon.svg"].filter(file => fs.existsSync(file))
    .map(file => [file, { bytes: fs.statSync(file).size, sha256: hash(fs.readFileSync(file)) }]));
const build = JSON.parse(fs.readFileSync(path.join("artifacts", "build-report.json"), "utf8"));
if (build.packageSha256 !== result.sha256) throw new Error("The package does not match the most recent recorded local build.");
fs.mkdirSync("artifacts", { recursive: true });
const report = {
    filename: result.filename,
    sha256: result.sha256,
    bytes: result.bytes.length,
    sourceCommit,
    sourceDirty,
    sourceInputs,
    sourceInputSha256: hash(JSON.stringify(sourceInputs)),
    node: process.version,
    packageManager: process.env.npm_config_user_agent ?? "Not recorded; run inspection through npm",
    platform: `${process.platform}-${process.arch}`,
    tools: JSON.parse(fs.readFileSync("node_modules/powerbi-visuals-tools/package.json", "utf8")).version,
    sdk: JSON.parse(fs.readFileSync("node_modules/powerbi-visuals-api/package.json", "utf8")).version,
    assets,
    build,
    payloadHashes: {
        javascript: hash(result.payload.content.js),
        css: hash(result.payload.content.css),
        capabilities: hash(JSON.stringify(result.payload.capabilities)),
        locales: hash(JSON.stringify(result.payload.stringResources))
    },
    visual: result.payload.visual,
    apiVersion: result.payload.apiVersion,
    archiveEntries: Object.keys(result.entries),
    locales: Object.keys(result.payload.stringResources),
    privileges: result.payload.capabilities.privileges
};
fs.writeFileSync(path.join("artifacts", "package-report.json"), JSON.stringify(report, null, 2) + "\n");
fs.writeFileSync(path.join("artifacts", "SHA256SUMS.txt"), `${result.sha256}  ${path.basename(result.filename)}\n`);
console.log(JSON.stringify(report, null, 2));
