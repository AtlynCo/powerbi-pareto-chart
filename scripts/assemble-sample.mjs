import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readPackage, validatePackage } from "./package-utils.mjs";
import { inspectSampleLayout } from "./sample-layout.mjs";

const scriptFile = fileURLToPath(import.meta.url);
const scriptDirectory = path.dirname(scriptFile);
const repositoryRoot = path.resolve(scriptDirectory, "..");
const argumentsList = process.argv.slice(2);
const jsonOutput = argumentsList.includes("--json");
const packagePath = argumentsList.find(argument => !argument.startsWith("--"));
const layout = inspectSampleLayout(path.join(repositoryRoot, "samples"));
const result = validatePackage(readPackage(packagePath));
const visualGuid = result.payload.visual.guid;
const sampleDirectory = path.join(repositoryRoot, "artifacts", "sample");
fs.rmSync(sampleDirectory, { recursive: true, force: true });
fs.cpSync(path.join(repositoryRoot, "samples"), sampleDirectory, {
    recursive: true,
    filter: source => !source.split(path.sep).includes(".pbi")
});
const reportDefinitionPath = path.join(sampleDirectory, "Atlyn Pareto.Report", "definition", "report.json");
const sampleManifestPath = path.join(sampleDirectory, "sample-manifest.json");
const resourceDirectory = path.join(
    sampleDirectory,
    "Atlyn Pareto.Report",
    "CustomVisuals",
    visualGuid
);
const resourceFilename = path.basename(result.manifest.resources[0].file);
const relativeResourceDirectory = path.relative(sampleDirectory, resourceDirectory).replace(/\\/g, "/");
const relativeReportResourceDirectory = `CustomVisuals/${visualGuid}`;
const icon300Path = fs.existsSync(path.join(repositoryRoot, "assets", "icon-300.png")) ? "assets/icon-300.png" : undefined;

fs.mkdirSync(path.join(resourceDirectory, "resources"), { recursive: true });

const files = [
    {
        filename: path.join("resources", resourceFilename),
        data: result.entries[result.manifest.resources[0].file]
    },
    {
        filename: "package.json",
        data: result.entries["package.json"]
    },
    {
        filename: "embedded-package.manifest.json",
        data: `${JSON.stringify({
            generatedBy: "node scripts/assemble-sample.mjs",
            sourcePackage: {
                filename: path.relative(repositoryRoot, result.filename).replace(/\\/g, "/"),
                sha256: result.sha256
            },
            visual: result.payload.visual,
            apiVersion: result.payload.apiVersion,
            extractedResources: [
                `resources/${resourceFilename}`,
                "package.json"
            ],
            resourceDirectory: relativeResourceDirectory
        }, null, 2)}\n`
    }
];

for (const { filename, data } of files) {
    const outputPath = path.join(resourceDirectory, filename);
    fs.writeFileSync(outputPath, data);
    console.log(`Wrote ${path.relative(repositoryRoot, outputPath).replace(/\\/g, "/")}`);
}

const report = JSON.parse(fs.readFileSync(reportDefinitionPath, "utf8"));
report.resourcePackages = [{
    name: visualGuid,
    type: "CustomVisual",
    items: [
        {
            name: resourceFilename,
            path: resourceFilename,
            type: "CustomVisualMetadata"
        }
    ],
    disabled: false
}];

const annotations = new Map((report.annotations ?? []).map(({ name, value }) => [name, value]));
annotations.set("atlynParetoPackageSha256", result.sha256);
annotations.set("atlynParetoPackageVersion", result.payload.visual.version);
annotations.set("atlynParetoApiVersion", result.payload.apiVersion);
annotations.set("atlynParetoAssemblyScript", "node scripts/assemble-sample.mjs");
annotations.set("atlynParetoResourceDirectory", relativeReportResourceDirectory);
annotations.set("atlynParetoSampleManifest", "sample-manifest.json");
report.annotations = [...annotations.entries()].map(([name, value]) => ({ name, value }));
fs.writeFileSync(reportDefinitionPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Updated ${path.relative(repositoryRoot, reportDefinitionPath).replace(/\\/g, "/")}`);

const summary = {
    generatedBy: "node scripts/assemble-sample.mjs",
    package: {
        relativePath: path.relative(repositoryRoot, result.filename).replace(/\\/g, "/"),
        sha256: result.sha256,
        version: result.payload.visual.version,
        apiVersion: result.payload.apiVersion,
        guid: visualGuid,
        displayName: result.payload.visual.displayName
    },
    assets: {
        iconSvg: "assets/icon.svg",
        icon20: "assets/icon.png",
        icon300: icon300Path
    },
    report: {
        artifactVersion: layout.reportArtifactVersion,
        definitionVersion: layout.reportDefinitionVersion,
        pbipPath: "Atlyn Pareto.pbip",
        pbirPath: "Atlyn Pareto.Report/definition.pbir",
        reportJsonPath: "Atlyn Pareto.Report/definition/report.json",
        resourceDirectory: relativeResourceDirectory,
        pages: [
            {
                name: "DefectCountPareto",
                displayName: "Defect count Pareto",
                categoryField: "Defects[Category]",
                contributionMeasure: "[Total defects]",
                tooltipMeasure: "[Total rework minutes]"
            },
            {
                name: "ComplaintCostPareto",
                displayName: "Complaint cost Pareto",
                categoryField: "Complaints[Category]",
                contributionMeasure: "[Total complaint cost]",
                tooltipMeasure: "[Total complaints]"
            },
            {
                name: "CustomerRevenuePareto",
                displayName: "Customer revenue concentration",
                categoryField: "CustomerRevenue[Category]",
                contributionMeasure: "[Total customer revenue]",
                tooltipMeasure: "[Total invoices]"
            }
        ]
    },
    documentation: {
        certificationRequirements: fs.existsSync(path.join(repositoryRoot, "docs", "certification-requirements.md"))
            ? "docs/certification-requirements.md"
            : undefined,
        competitiveWorkflow: fs.existsSync(path.join(repositoryRoot, "docs", "competitive-workflow.md"))
            ? "docs/competitive-workflow.md"
            : undefined
    },
    manualValidation: {
        required: true,
        status: "manual",
        reason: "Native Power BI Desktop open/refresh/save validation is unavailable in this environment."
    },
    submissionGuidance: {
        pbixSampleRequired: true,
        pbixSampleReason: "Current public Microsoft certification guidance documents sample upload as an offline PBIX using the same visual version as the submitted PBIVIZ; PBIP is source authoring input, not a documented submission substitute.",
        packageIcon: {
            path: "assets/icon.png",
            size: "20x20"
        },
        listingLogo: {
            path: icon300Path ?? "assets/icon-300.png",
            size: "300x300"
        },
        certificationBranch: {
            requiredName: "certification",
            note: "Current public Microsoft certification guidance expects the submitted source to come from a lowercase certification branch matching the submitted package."
        },
        screenshots: {
            preferredRequirement: "1366x768 PNG, 1-5 images, each <=1024 KB",
            note: "Public Microsoft docs conflict with a 1280x720 planning-page statement; follow the more specific Power BI offer-listing and Office Store requirement and recheck the uploader."
        }
    }
};
fs.writeFileSync(sampleManifestPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(`Updated ${path.relative(repositoryRoot, sampleManifestPath).replace(/\\/g, "/")}`);

console.log(`Embedded ${result.payload.visual.displayName} ${result.payload.visual.version} from ${summary.package.relativePath}`);
console.log(`SHA-256 ${result.sha256}`);
if (jsonOutput) console.log(JSON.stringify(summary, null, 2));
