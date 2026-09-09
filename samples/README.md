# Offline invented samples and PBIP starter

All names, counts, minutes, and amounts here are **invented**, sanitized examples. They contain no customer records or observed business outcomes. Each category contributes a disjoint, nonnegative additive quantity; costs are in one illustrative USD unit with no exchange-rate inference.

## What is included

- `defect-count.csv`: nine categories, including a blank category and a zero-contribution category.
- `complaint-cost.csv`: eight categories, including a zero-contribution category.
- `Atlyn Pareto.pbip`: a real project entry point referencing the report and semantic model folders.
- `Atlyn Pareto.Report`: enhanced PBIR definitions for one **blank page**.
- `Atlyn Pareto.SemanticModel`: TMSL `model.bim`, with two Import tables, embedded Power Query `#table` data, and additive DAX measures.

The PBIP is an editable **source starter**, not a prebuilt PBIX or completed sample dashboard. It does not include a packaged visual, visual bindings, screenshots, or approval evidence. Import the separately built `.pbiviz` and bind it using the steps below.

The model embeds the same rows as the CSVs. It has no `File.Contents`, absolute user path, remote connection, gateway, or credentials. The CSVs are inspectable alternatives, not runtime dependencies of the PBIP. Changes to a CSV do not automatically change the model: edit both sources deliberately if adapting the example.

## Open and build a report in Desktop

1. Use a current **Power BI Desktop for Windows** with project support. Microsoft's documentation currently marks PBIP and enhanced PBIR as preview features. Under **File → Options and settings → Options → Preview features**, enable **Power BI Project (.pbip) save option** and **Store reports using enhanced metadata format (PBIR)** when your Desktop version exposes these switches. Restart as requested.
2. This starter uses the supported **TMSL `model.bim`** model format, not TMDL. It does not require the separate **Store semantic model using TMDL format** preview. If you choose to convert/save it as TMDL, enable that feature in versions that require it; Desktop can change the model folder structure when saving.
3. Keep the entire `samples` folder structure together. Open `Atlyn Pareto.pbip` (or the report's `definition.pbir`). Its report/model references are relative; the forward slash inside `byPath` is the Power BI file-format requirement, not an absolute file location.
4. Select **Home → Refresh** to materialize the embedded tables. No cached `.pbi\cache.abf` is supplied, so the model may initially contain its definitions without loaded data. Refreshing these `#table` expressions needs no external data source.
5. Build the package using the [development guide](../docs/development.md), then **Visualizations → … → Import a visual from a file**. Select the inspected package, not an unrelated stale artifact.
6. Add Atlyn Pareto and bind the defect example:

   | Visual role | Model field |
   | --- | --- |
   | Category | `Defects[Category]` |
   | Contribution | `[Total defects]` |
   | Tooltip (optional) | `[Total rework minutes]` |

7. Add a second visual or duplicate the page for the complaint example:

   | Visual role | Model field |
   | --- | --- |
   | Category | `Complaints[Category]` |
   | Contribution | `[Total complaint cost]` |
   | Tooltip (optional) | `[Total complaints]` |

8. Leave threshold at 80%, default incomplete withholding, default page size, and no filters. Compare the tables below. Do not mix category fields from one table with measures from the other; these independent scenario tables intentionally have no relationship.
9. Save your completed report separately. If a PBIX is required for an owner-approved review/submission, use Desktop's **Save As** to produce it after refreshing/importing/binding. The repository does not provide or attest to that manual output.

Schema-oriented source inspection is not the same as opening/refreshing in Desktop. A maintainer must record the actual Desktop version and result before claiming the starter is host-validated or distributing a finished sample report.

## CSV-only alternative

In a blank Desktop report, use **Get data → Text/CSV** and browse to the desired local CSV. Use UTF-8 and a comma delimiter. Rename the queries `Defects` and `Complaints`, as appropriate. In **Transform data**, use Text for `Category`, Whole Number for counts/minutes, and Fixed Decimal Number for `ComplaintCostUSD`. In the defect query, ensure the empty category is null/blank, not a dropped row.

Create these measures in their corresponding tables:

```dax
Total defects = SUM(Defects[DefectCount])
Total rework minutes = SUM(Defects[ReworkMinutes])
Total complaint cost = SUM(Complaints[ComplaintCostUSD])
Total complaints = SUM(Complaints[ComplaintCount])
```

Format defect/count/minute measures as whole numbers and complaint cost as USD currency. A manually imported CSV normally creates a machine-specific path in Power Query; that is why the supplied PBIP uses embedded data instead.

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

Optional rework tooltip total: **576 minutes**. It does not change the 200-defect denominator.

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

Optional complaint-count tooltip total: **100 complaints**. It does not change the cost denominator.

These results demonstrate concentration and boundary ties, not a universal 80/20 law. Filtering changes the query universe and therefore the expected totals. Neither small scenario exercises pagination (minimum page size is 10), host segmentation, or the 100,000-category bound; use the [manual validation matrix](../docs/host-validation.md) and automated fixtures for those paths.

## Format references

The source layout follows Microsoft's public documentation and schema identifiers:

- [PBIP projects and preview prerequisite](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-overview)
- [Report definitions, PBIR, and relative `byPath` references](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report)
- [Semantic model `definition.pbism`, TMSL/TMDL, and refresh without cache](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-dataset)
- [TMSL model object](https://learn.microsoft.com/en-us/analysis-services/tmsl/model-object-tmsl)

`$schema` URLs identify file formats for editors/validation; the sample has no web query. Do not check generated `.pbi` caches, local Desktop settings, credentials, or private report data into source control.
