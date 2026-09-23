# Offline authored PBIP sample

All names, counts, minutes, and amounts here are **invented**, sanitized examples. They contain no customer records or observed business outcomes. Each scenario contributes a disjoint, nonnegative additive quantity. Currency examples use one illustrative USD unit with no exchange-rate inference.

## What is included

- `defect-count.csv`: nine defect categories totaling **200** defects, including a blank category and a zero-contribution category.
- `complaint-cost.csv`: eight complaint categories totaling **$10,000.00**, including a zero-contribution category.
- `customer-revenue.csv`: 25 synthetic concentration buckets totaling **$1,000,000.00**, with long labels, an 80% boundary tie, and two zero rows.
- `Atlyn Pareto.pbip`: project entry point referencing the report and semantic model folders.
- `Atlyn Pareto.SemanticModel`: TMSL `model.bim` with three Import tables, embedded Power Query `#table` rows, and additive measures.
- `Atlyn Pareto.Report`: PBIR source with three authored pages and local custom-visual resource references.
- `scripts\assemble-sample.mjs`: copies the authored source into ignored `artifacts\sample` and embeds the checked build output there using the real `.pbiviz` archive.

Run the assembly command before opening the project: the resulting `artifacts\sample` is the complete **offline PBIP**, including the final visual. Generated runtime resources are not committed with the reviewable source. The pages and bindings were authored against public PBIR schemas but were **not** opened in Power BI Desktop here. A maintainer must perform the final Desktop refresh/open/save-as-PBIX step before claiming native-host validation.

## Embedded visual resources

The report expects extracted resources for the stable custom visual GUID `atlynPareto18722664651549C392ABF6B1EBA46945`. Refresh them from the current built package:

```powershell
node scripts\assemble-sample.mjs
```

The script:

- reads the actual built package via `scripts/package-utils.mjs`
- validates the package GUID/version/API payload
- extracts the exact package manifest and resource payload (which contains the JS, CSS, icon, and notices)
- writes them to `artifacts\sample\Atlyn Pareto.Report\CustomVisuals\atlynPareto18722664651549C392ABF6B1EBA46945\`, preserving the official `resources` subfolder
- records the exact package SHA-256 in `embedded-package.manifest.json`
- creates `artifacts\sample\sample-manifest.json`, a machine-readable summary parent tests/docs can consume

Do not hand-edit those extracted files. Regenerate them from the actual package instead.

For machine-readable integration, the assembly script accepts an optional package path and optional `--json` flag:

```powershell
node scripts\assemble-sample.mjs
node scripts\assemble-sample.mjs dist\atlynPareto18722664651549C392ABF6B1EBA46945.1.1.1.0.pbiviz --json
```

`artifacts\sample\sample-manifest.json` records the exact package path, SHA-256, report entry points relative to the assembled folder, embedded resource directory, page bindings, and the manual-native-validation requirement. The assembly replaces only the generated `artifacts\sample` folder, not the authored source or source commit.

When present in the worktree, the same manifest also points parent automation at `docs\certification-requirements.md` and `docs\competitive-workflow.md` so submission planning and competitive-positioning notes stay linked to the sample source without this sample owning those docs.

## Authored report pages

The report includes three PBIR pages, each already bound to the Atlyn Pareto visual:

| Page | Category role | Contribution role | Tooltip role |
| --- | --- | --- | --- |
| Defect count Pareto | `Defects[Category]` | `[Total defects]` | `[Total rework minutes]` |
| Complaint cost Pareto | `Complaints[Category]` | `[Total complaint cost]` | `[Total complaints]` |
| Customer revenue concentration | `CustomerRevenue[Category]` | `[Total customer revenue]` | `[Total invoices]` |

Each page uses threshold **80%**, incomplete-data policy **withhold**, saved rank **1**, page size **30**, and the visual's own built-in table.

Each page also carries a small, no-chrome **textbox visual** directly above the chart with concise, real usage hints (policy 1180.2.3.1): the page's required field roles (`Category` (1), `Contribution` (1 measure), optional `Tooltips` up to 5), how to select/cross-filter and open the context menu, how to change the 80% cutoff via the Analysis pane's **Threshold %** and **Incomplete data** properties, and how to page through more than the visual's 100,000-category limit using **Maximum categories per page** and the chart's own Next/Previous controls. `scripts/inspect-sample.mjs` and `tests/samples.test.ts` both assert every page has exactly one Pareto visual and one usage-hint textbox, and that the hint text mentions each of those points.

## Open and verify in Desktop

1. Use a current **Power BI Desktop for Windows** with project support. Microsoft's documentation currently marks PBIP and PBIR as preview features.
2. Under **File → Options and settings → Options → Preview features**, enable **Power BI Project (.pbip) save option** and **Store reports using enhanced metadata format (PBIR)** if your Desktop build exposes them. Restart if required.
3. Build the current visual package with the repository's normal release flow, then run:

   ```powershell
   node scripts\assemble-sample.mjs
   ```

4. Keep the whole generated `artifacts\sample` folder together and open its `Atlyn Pareto.pbip` or `Atlyn Pareto.Report\definition.pbir`. Do not open the unassembled source expecting embedded resources.
5. Select **Home → Refresh** to materialize the embedded `#table` data. No external source, gateway, or credentials are required.
6. Confirm the three report pages render the embedded Atlyn Pareto visual and match the expected scenario results below.
7. If a PBIX is required for an owner-approved review or submission, use Desktop **Save As** after refresh/open succeeds. This repository does not provide or attest to that manual PBIX output.

For certification/sample submission planning, current public Microsoft guidance documents the uploadable sample as an **offline PBIX** that uses the same visual version as the submitted `.pbiviz`. This PBIP is therefore best treated as the reproducible source-authoring input for that manual Desktop step, not as a documented replacement for the final sample PBIX.

## CSV-only alternative

In a blank Desktop report, use **Get data → Text/CSV** and browse to the desired local CSV. Use UTF-8 and a comma delimiter. Rename the queries `Defects`, `Complaints`, and `CustomerRevenue`, as appropriate. In **Transform data**, use Text for `Category`, Whole Number for counts/minutes/invoices, and Fixed Decimal Number for `ComplaintCostUSD` and `RevenueUSD`. In the defect query, ensure the empty category remains null/blank.

Create these measures in their corresponding tables:

```dax
Total defects = SUM(Defects[DefectCount])
Total rework minutes = SUM(Defects[ReworkMinutes])
Total complaint cost = SUM(Complaints[ComplaintCostUSD])
Total complaints = SUM(Complaints[ComplaintCount])
Total customer revenue = SUM(CustomerRevenue[RevenueUSD])
Total invoices = SUM(CustomerRevenue[InvoiceCount])
```

Format defect/count/minute/invoice measures as whole numbers and cost/revenue measures as USD currency. A manually imported CSV normally creates a machine-specific path in Power Query; that is why the supplied PBIP uses embedded data instead.

## Expected defect result: 80% threshold

Total contribution **200 defects**; nine categories. The first crossing is **Packaging, rank 4**, at **160 / 200 = 80%**. Labeling, Packaging, and Surface all contribute 20, so the full contributor set includes **five categories**, contributing **180 / 200 = 90%**. The blank category's four defects and the zero category are both retained.

| Rank | Category | Defects | Cumulative defects | Cumulative share | Threshold membership |
| --- | --- | ---: | ---: | ---: | --- |
| 1 | Design | 70 | 70 | 35% | Included |
| 2 | Assembly | 50 | 120 | 60% | Included |
| 3 | Labeling | 20 | 140 | 70% | Included boundary tie |
| 4 | Packaging | 20 | 160 | 80% | First crossing |
| 5 | Surface | 20 | 180 | 90% | Included boundary tie |
| 6 | Fastener | 10 | 190 | 95% | After |
| 7 | Calibration | 6 | 196 | 98% | After |
| 8 | (Blank) | 4 | 200 | 100% | After |
| 9 | Documentation | 0 | 200 | 100% | After |

Optional rework tooltip total: **576 minutes**.

## Expected complaint result: 80% threshold

Total contribution **$10,000.00**; eight categories. The first crossing is **Returns, rank 4**, at **$8,100 / $10,000 = 81%**. Returns and Support tie at $900, so the full contributor set includes **five categories**, contributing **$9,000 / $10,000 = 90%**.

| Rank | Category | Cost (USD) | Cumulative cost (USD) | Cumulative share | Threshold membership |
| --- | --- | ---: | ---: | ---: | --- |
| 1 | Billing | 3,200 | 3,200 | 32% | Included |
| 2 | Delivery | 2,500 | 5,700 | 57% | Included |
| 3 | Product quality | 1,500 | 7,200 | 72% | Included |
| 4 | Returns | 900 | 8,100 | 81% | First crossing |
| 5 | Support | 900 | 9,000 | 90% | Included boundary tie |
| 6 | Checkout | 600 | 9,600 | 96% | After |
| 7 | Account | 400 | 10,000 | 100% | After |
| 8 | Warranty | 0 | 10,000 | 100% | After |

Optional complaint-count tooltip total: **100 complaints**.

## Expected customer concentration result: 80% threshold

Total contribution **$1,000,000.00**; 25 synthetic concentration buckets. The first crossing is **Customer portfolio 06 - national distributor umbrella, rank 6**, at **$800,000 / $1,000,000 = 80%**. Portfolio 07 ties with portfolio 06 at $60,000, so the full contributor set includes **seven categories**, contributing **$860,000 / $1,000,000 = 86%**. Two zero rows remain visible at the tail.

| Rank | Category | Revenue (USD) | Cumulative revenue (USD) | Cumulative share | Threshold membership |
| --- | --- | ---: | ---: | ---: | --- |
| 1 | Customer portfolio 01 - enterprise field retrofit program | 250,000 | 250,000 | 25% | Included |
| 2 | Customer portfolio 02 - OEM replenishment umbrella | 180,000 | 430,000 | 43% | Included |
| 3 | Customer portfolio 03 - direct digital migration subscriptions | 140,000 | 570,000 | 57% | Included |
| 4 | Customer portfolio 04 - regulated maintenance consortium | 90,000 | 660,000 | 66% | Included |
| 5 | Customer portfolio 05 - multi-site service renewal | 80,000 | 740,000 | 74% | Included |
| 6 | Customer portfolio 06 - national distributor umbrella | 60,000 | 800,000 | 80% | First crossing |
| 7 | Customer portfolio 07 - national distributor umbrella backup | 60,000 | 860,000 | 86% | Included boundary tie |
| 8 | Customer portfolio 08 - public sector onboarding pool | 30,000 | 890,000 | 89% | After |
| 9 | Customer portfolio 09 - partner marketplace rollup | 25,000 | 915,000 | 91.5% | After |
| 10 | Customer portfolio 10 - direct ecommerce expansion | 20,000 | 935,000 | 93.5% | After |
| 11 | Customer portfolio 11 - warranty conversions archive | 15,000 | 950,000 | 95% | After |
| 12 | Customer portfolio 12 - seasonal training allocations | 10,000 | 960,000 | 96% | After |
| 13 | Customer portfolio 13 - long tail reseller cluster alpha | 8,000 | 968,000 | 96.8% | After |
| 14 | Customer portfolio 14 - long tail reseller cluster beta | 7,000 | 975,000 | 97.5% | After |
| 15 | Customer portfolio 15 - long tail reseller cluster gamma | 6,000 | 981,000 | 98.1% | After |
| 16 | Customer portfolio 16 - long tail reseller cluster delta | 5,000 | 986,000 | 98.6% | After |
| 17 | Customer portfolio 17 - long tail reseller cluster epsilon | 4,000 | 990,000 | 99% | After |
| 18 | Customer portfolio 18 - pilot installations retained | 3,000 | 993,000 | 99.3% | After |
| 19 | Customer portfolio 19 - archived upsell experiments | 2,500 | 995,500 | 99.55% | After |
| 20 | Customer portfolio 20 - procurement bridge accounts | 2,000 | 997,500 | 99.75% | After |
| 21 | Customer portfolio 21 - internal chargeback recoveries | 1,000 | 998,500 | 99.85% | After |
| 22 | Customer portfolio 22 - legacy portal migrations | 800 | 999,300 | 99.93% | After |
| 23 | Customer portfolio 23 - sandbox evaluation credits | 700 | 1,000,000 | 100% | After |
| 24 | Customer portfolio 24 - dormant framework placeholders | 0 | 1,000,000 | 100% | After |
| 25 | Customer portfolio 25 - zero revenue closed records | 0 | 1,000,000 | 100% | After |

Optional invoice tooltip total: **640 invoices**.

These results demonstrate concentration and boundary ties, not a universal 80/20 law. Filtering changes the query universe and therefore the expected totals. The customer scenario exercises adaptive pagination at ordinary tile sizes; it does not establish host segmentation or the 100,000-category bound. Use the [manual validation matrix](../docs/host-validation.md) and automated fixtures for those paths.

## Certification and listing asset notes

These notes are documentation-derived planning aids only; they are not native-host validation evidence:

- The **packaged visual icon** is the embedded `assets\icon.png` **20×20 PNG** used by `pbiviz.json`.
- The **listing/logo asset** can use `assets\icon-300.png`, generated from the same SVG, as the **300×300 PNG** marketplace-style logo source.
- Public Microsoft documentation currently appears to conflict on screenshot sizing. A newer planning page mentions **1280×720** screenshots with captions, while the more specific Power BI offer-listing / Office Store guidance documents **1366×768 PNG**, **1–5 screenshots**, each **≤1024 KB**. Treat the latter as the operative listing target unless Microsoft clarifies otherwise.
- Public certification guidance also documents a lowercase **`certification`** branch whose contents must match the submitted package source.
- See `..\docs\certification-requirements.md` for the current mandatory/recommended/manual split and `..\docs\competitive-workflow.md` for the documentation-derived comparison/protocol referenced by parent coordination.

## Format references

The source layout follows Microsoft's public documentation and current public schema identifiers:

- [PBIP projects and preview prerequisite](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-overview)
- [Report folders, PBIR layout, and relative `byPath` references](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report)
- [Semantic model `definition.pbism`, TMSL/TMDL, and refresh without cache](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-dataset)
- [TMSL model object](https://learn.microsoft.com/en-us/analysis-services/tmsl/model-object-tmsl)
- [Public PBIR resource-layout example, pinned commit](https://github.com/ProdataSQL/FinancialModelling/blob/ec738ceb6a801f416b88b93c1dcfddbbe89426b7/Workspace/Finance-GL.Report/definition/report.json): confirms the private `CustomVisuals/<guid>/package.json` + `resources/<guid>.pbiviz.json` layout and filename-relative resource entry. No third-party visual code is copied into this sample.

`$schema` URLs identify file formats for editors and validation; the sample has no web query. Do not check generated `.pbi` caches, local Desktop settings, credentials, or private report data into source control.

## Native-preflight safeguards

This sample uses **TMSL `model.bim`**, not TMDL; there is no `model.tmdl` or indented `ref table` directive. The report has two independent format versions: **`definition.pbir` uses artifact version `4.0`**, while **`definition\version.json` uses report-definition version `2.0.0`**. Do not copy the artifact version into the report-definition file. `scripts\sample-versions.mjs` names the constants separately; generation validates both before copying source files and records both in `sample-manifest.json`. The inspector verifies the source/output pair and manifest agree.

The previous definition value `4.0.0` passed JSON schema validation. On 2026-09-10, the coordinator reported a single-variable native Desktop 2.157 A/B on another catalog visual: only changing that definition value to `2.0.0` restored pages, rendering and refresh. Pareto's sample is corrected on that evidence, but **its own native acceptance remains with the coordinator**. Schema acceptance and TOM model parsing do not establish that the report pages load.

The layout validator explicitly requires both version files and other entry points before schema validation, since validating only existing files cannot detect omissions. Regressions reject a missing version file, definition versions `4.0.0`/`4.0`, mistakenly swapped artifact versions, and mixed TMSL/TMDL definitions.

On a machine with Power BI Desktop already installed, its official TOM assemblies can deserialize the model without launching Desktop, connecting to a server, installing dependencies or executing the embedded M/DAX:

```powershell
npm run sample
npm run sample:tom
```

The parser command writes `artifacts\sample-tom-preflight.json` with input/package hashes, exact installed assembly hashes/versions and deserialized table/member counts. It fails explicitly if the required installed assemblies are absent. `-DesktopBin` can identify another authorized Desktop installation. **TOM parsing is not native report opening, refresh, rendering, export or acceptance evidence.**

For a provisional native retry, copy the assembled sample into a new, separately named directory under `artifacts` without overwriting any sealed release. Inspect that directory with `node scripts\inspect-sample.mjs <retry-directory>`, then `npm run sample:tom -- -SampleDirectory <retry-directory> -EvidencePath <retry-directory>\tom-preflight.json`. This records layout/schema/resource and TOM evidence alongside the retry. Keep the existing package hash explicit, preserve the original sealed bundle and certification ref, and let the coordinator operate the Desktop UI. A retry sample is not a new paid/submission package.

The owner has approved external storefront subscriptions with the existing ungated renderer and free shared viewing. No separate runtime entitlement integration or licensing-driven package rebuild is pending. The provisional/native evidence boundary above remains: the coordinator must still supply real-host/PBIX assets and obtain the additionally required Microsoft Power BI certified badge before claiming certification.
