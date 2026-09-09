import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { readPackage, validatePackage } from "./package-utils.mjs";

assert.ok(process.env.npm_execpath, "Run through npm run release:verify");
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
assert.equal(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(), "", "Commit source before collecting final evidence");
const directory = path.resolve("artifacts", "validation");
fs.mkdirSync(directory, { recursive: true });
const commands = [
    ["verify"],
    ["sample"],
    ...(fs.existsSync(path.join("artifacts", "quality", "baseline", "baseline.pbiviz"))
        ? [["evidence:quality", "--", "--label", "baseline", "--samples", "20", "--warmups", "3"]] : []),
    ["evidence:quality", "--", "--label", "final", "--samples", "20", "--warmups", "3"]
];
const results = [];
for (const [index, args] of commands.entries()) {
    const startedAt = new Date().toISOString();
    const start = performance.now();
    const result = spawnSync(process.execPath, [process.env.npm_execpath, "run", ...args], {
        encoding: "utf8", maxBuffer: 16 * 1024 * 1024, env: process.env
    });
    const log = `${index + 1}-${args[0].replaceAll(":", "-")}.log`;
    fs.writeFileSync(path.join(directory, log), `${result.stdout ?? ""}\n${result.stderr ?? ""}`);
    results.push({ command: ["npm", "run", ...args], startedAt, durationMs: performance.now() - start, exitCode: result.status, log });
    if (result.error) throw result.error;
    if (result.status !== 0) {
        fs.writeFileSync(path.join(directory, "report.json"), JSON.stringify({ sourceCommit, status: "failed", results }, null, 2) + "\n");
        throw new Error(`Local validation failed; inspect ${path.join(directory, log)}`);
    }
    console.log(`Passed ${args.join(" ")}; log: ${log}`);
}
const packaged = validatePackage(readPackage());
const inspected = JSON.parse(fs.readFileSync(path.join("artifacts", "package-report.json"), "utf8"));
assert.equal(inspected.sourceCommit, sourceCommit);
assert.equal(inspected.sourceDirty, false);
assert.equal(inspected.sha256, packaged.sha256);
assert.equal(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(), "");
fs.writeFileSync(path.join(directory, "report.json"), JSON.stringify({
    sourceCommit, status: "passed", packageSha256: packaged.sha256, results,
    hostBoundary: "Local source/package/browser/schema evidence only. Native Desktop/service/export/Marketplace remain manual."
}, null, 2) + "\n");
console.log("Final local evidence collected. Inspect the screenshots before freezing this package.");
