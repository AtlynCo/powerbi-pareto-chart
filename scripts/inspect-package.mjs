import fs from "node:fs";
import path from "node:path";
import { readPackage, validatePackage } from "./package-utils.mjs";

const result = validatePackage(readPackage());
fs.mkdirSync("artifacts", { recursive: true });
const report = {
    filename: result.filename,
    sha256: result.sha256,
    bytes: result.bytes.length,
    visual: result.payload.visual,
    apiVersion: result.payload.apiVersion,
    archiveEntries: Object.keys(result.entries),
    locales: Object.keys(result.payload.stringResources),
    privileges: result.payload.capabilities.privileges
};
fs.writeFileSync(path.join("artifacts", "package-report.json"), JSON.stringify(report, null, 2) + "\n");
fs.writeFileSync(path.join("artifacts", "SHA256SUMS.txt"), `${result.sha256}  ${path.basename(result.filename)}\n`);
console.log(JSON.stringify(report, null, 2));
