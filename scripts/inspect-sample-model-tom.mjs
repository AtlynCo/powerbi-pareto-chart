// Real Microsoft TOM (Tabular Object Model) preflight for the Pareto sample's
// TMDL semantic model. Unlike scripts/inspect-sample-model-structural.ps1 (which
// only does regex/text checks), this wraps tools/tmdl-preflight, a small .NET
// console app that calls the actual
// Microsoft.AnalysisServices.Tabular.TmdlSerializer.DeserializeDatabaseFromFolder
// API (public "Microsoft.AnalysisServices.retail.amd64" NuGet package) to
// genuinely parse the TMDL definition folder into a real TOM Database object,
// then inspects that object's tables/columns/measures/partitions.
//
// This requires the .NET SDK. If it is not installed, or the TOM package
// cannot be restored, this script fails explicitly rather than silently
// falling back to the structural-only check.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const toolProject = path.join(repoRoot, "tools", "tmdl-preflight");
const sampleDirectory = process.argv[2] ?? path.join(repoRoot, "artifacts", "sample");
const evidencePath = process.argv[3] ?? path.join(repoRoot, "artifacts", "sample-tmdl-tom-preflight.json");

function run(command, args) {
    return execFileSync(command, args, { stdio: "inherit" });
}

try {
    execFileSync("dotnet", ["--version"], { stdio: "pipe" });
} catch {
    throw new Error(
        "Real TOM preflight requires the .NET SDK (dotnet on PATH), which was not found. " +
        "Install the .NET SDK, or run \"npm run sample:structural\" for a structural-only check " +
        "(explicitly not a substitute for a real TOM parse)."
    );
}

run("dotnet", ["run", "--project", toolProject, "-c", "Release", "--", sampleDirectory, evidencePath]);
