# Competitive workflow comparison (documentation-derived)

**Checked:** 2026-09-09
**Scope:** authoring and analysis workflow comparison for **Atlyn Pareto** versus (1) native Power BI combo chart + DAX, (2) the public SQLBI dynamic Pareto pattern, and (3) publicly verifiable Inforiver material.
**Evidence boundary:** this document is intentionally limited to public documentation plus this repository's product contract. It does **not** claim hands-on validation of Power BI Desktop, Power BI service, SQLBI sample files, or Inforiver products. It includes **no fabricated timings, performance rankings, or unsupported competitor feature claims**.

## 1. What Atlyn Pareto is explicitly designed to do

From this repository's contract, Atlyn Pareto is a **standalone offline Power BI custom visual** for ranking **nonnegative, additive contributions** by exactly one category field and one numeric contribution measure, with optional tooltip measures. It rejects null/missing/nonnumeric/nonfinite/negative contribution values for the **whole analysis**, keeps zeros, identifies the **first cumulative threshold crossing**, and includes **every equal-contribution boundary tie** even if that causes the contributor set to exceed the chosen threshold. It also treats the current query universe as the analysis universe, requests aggregated host segments in 10,000-category windows up to a **100,000-category safety bound**, withholds shares and threshold conclusions by default when data is incomplete, and offers an explicit opt-in **received-subset** interpretation instead. It does **not** implement Top N or an Other bucket; pagination is presentation-only and does not change the denominator. See [README](../README.md), [data-contract](data-contract.md), and [host-validation](host-validation.md).

## 2. Source set used for the comparison

### Repository contract

- [README](../README.md)
- [Data contract and interpretation](data-contract.md)
- [Host validation procedure](host-validation.md)

### Microsoft public documentation

- [Combo Chart in Power BI](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-combo-chart)
- [Create report bookmarks in Power BI](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-bookmarks)
- [Create report tooltips in Power BI](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-tooltips)
- [Change how visuals interact in a report](https://learn.microsoft.com/en-us/power-bi/create-reports/service-reports-visual-interactions)
- [RANKX function (DAX)](https://learn.microsoft.com/en-us/dax/rankx-function-dax)
- [ALLSELECTED function (DAX)](https://learn.microsoft.com/en-us/dax/allselected-function-dax)
- [WINDOW function (DAX)](https://learn.microsoft.com/en-us/dax/window-function-dax)

### SQLBI public documentation

- [Dynamic Pareto analysis in Power BI](https://www.sqlbi.com/articles/dynamic-pareto-analysis-in-power-bi/)

### Inforiver public material

- [Advanced histograms in Power BI](https://inforiver.com/blog/inforiver-analytics-plus/advanced-histograms-in-power-bi/)
- [Search & Filter](https://docs.inforiver.com/working-with-inforiver/3.-basic-interactions/explore-and-filter-data/search-and-filter.md)
- [Top N + others](https://docs.inforiver.com/working-with-inforiver/3.-basic-interactions/explore-and-filter-data/top-n.md)
- [Sort & reorder data](https://docs.inforiver.com/working-with-inforiver/3.-basic-interactions/sort-and-reorder-data.md)
- [Leveraging Power BI bookmarks](https://docs.inforiver.com/working-with-inforiver/19.-leveraging-power-bi-bookmarks.md)
- [Accessibility shortcut keys](https://docs.inforiver.com/accessibility-shortcut-keys.md)

## 3. High-level workflow comparison

| Topic | Atlyn Pareto | Native combo chart + DAX | SQLBI dynamic Pareto pattern | Verified Inforiver public evidence |
| --- | --- | --- | --- | --- |
| Initial authoring path | Import one custom visual, bind **Category** + **Contribution**, optionally tooltips, then use visual format settings. | Build measures and one or more native visuals; combo chart alone is only the display container. | Build a disconnected numeric axis table, a metric selection table, multiple measures, and one or more line/table visuals. | Public Inforiver docs show no-code search/filter/sort/bookmark workflows for Matrix and a public Analytics+ histogram article; no public standalone category Pareto workflow was verified. |
| Offline/standalone scope | Repository explicitly targets offline runtime and no external-service dependency. | Depends on the report model and author-authored DAX; not a single packaged analysis visual. | Same as native DAX: report-model pattern, not a packaged single visual. | Inforiver public material spans multiple products/features; public docs do not establish an offline standalone Pareto visual equivalent for this specific use case. |
| Denominator model | Always the analyzed query universe, or explicitly the **received valid subset** when the user opts into incomplete-subset analysis. | Author must define denominator in DAX. This is flexible, but easy to mis-specify. | SQLBI explicitly leans on DAX context management and `ALLSELECTED`/`WINDOW`; denominator logic is author-owned, not intrinsic to the chart type. | Public docs verify Top N, filters, sort, and bookmarking in Inforiver Matrix and Pareto-line overlay in an Analytics+ histogram article, but do not verify Atlyn-style full-universe denominator rules for category Pareto ranking. |
| Threshold workflow | Built-in cumulative threshold from 1% to 100%, default 80%, with deterministic inclusive tie handling. | No built-in Pareto threshold in combo charts; author must create threshold measures/lines/labels. | SQLBI article shows a dynamic cumulative pattern and an 80% reference line, but not an Atlyn-style boundary-tie contributor-set rule. | Public Analytics+ evidence verifies a **Pareto Line** overlay on histograms; it does not verify a documented category-ranked threshold set with full boundary-tie inclusion. |
| Tie handling | Explicit deterministic sort and threshold-boundary tie inclusion are part of the contract. | `RANKX` documents `Skip` and `Dense` ranking choices, but threshold semantics remain author-designed. | SQLBI article orders by value descending and key ascending, which gives deterministic order, but the public article does not document tie-inclusive threshold membership. | No public Inforiver documentation found that describes tie handling for a category Pareto threshold. |
| Top N / Other | Explicitly **not** implemented; all analyzed categories stay in the denominator and cumulative totals. | Authors often approximate focus by filtering or additional visuals; behavior depends on DAX design. | Not framed as Top N + Other; instead uses a continuous numeric axis and cumulative measures. | Inforiver Matrix publicly documents **Top N + Others**, including percentage-based Top N, nested rules, and manual inclusion/exclusion of the Others bucket. That is a different analytical contract from Atlyn's "no Top N / no Other bucket." |
| Selection / cross-filter / highlight | Contract includes host selection, incoming selection, and highlight overlays without changing the denominator or reranking. | Native visuals support cross-highlighting and cross-filtering; authors can edit visual interactions. | Inherits native report interaction model, but the DAX model still determines meaning after filters. | Public Inforiver docs verify filters, sorting, bookmarks, context menus, and keyboard shortcuts, but not an Analytics+ category Pareto selection model matching Atlyn's semantics. |
| Learnability | Purpose-built workflow for a single Pareto question. | Most flexible, but requires the most model/DAX/report-design knowledge. | Powerful and dynamic, but more advanced still because it adds disconnected tables and windowing logic. | Inforiver Matrix docs emphasize no-code operations once the visual is in place, but verified public material does not show an end-to-end Atlyn-equivalent Pareto authoring path. |

## 4. Evidence-driven tradeoffs

### Atlyn Pareto versus native combo chart + DAX

**Where Atlyn is simpler**

- A report author binds exactly one category and one additive contribution measure and gets ranking, cumulative percentage, thresholding, deterministic ordering, incomplete-data disclosures, and pagination behavior within one visual contract.
- The repository contract explicitly warns authors away from nonadditive inputs such as averages, rates, percentages, or overlapping distinct counts, instead of silently accepting them.
- The denominator/incompleteness story is predeclared: either the full received query universe or the warned received subset, never an implicit Top N or Other bucket.

**Where native combo + DAX is more flexible**

- Microsoft documents combo charts as a general line+column container with one or two Y axes, sorting, and native interaction behavior; the author can combine it with any DAX logic and any surrounding report UX.
- Native report bookmarks save filters, slicers, sort order, drill location, visibility, and selection state, so an author can build a storytelling flow around the measures.
- Native report tooltips and edited visual interactions can be combined with any report page design.

**Tradeoff**

Native Power BI gives more composition freedom, but the Pareto semantics become an authoring responsibility. The author must decide:

- what the denominator is,
- whether the denominator follows visible categories or all selected rows,
- whether ties are deterministic,
- how thresholds are represented,
- whether filtered/selected states rerank the data,
- and whether any Top N or Other logic changes the population silently.

### Atlyn Pareto versus SQLBI dynamic Pareto

The SQLBI article documents a sophisticated DAX pattern, not a packaged visual. Its core workflow is:

1. Create a disconnected numeric axis with `GENERATESERIES`.
2. Create a metric selector table.
3. Use `SWITCH` for a dynamic metric measure.
4. Use `WINDOW` and ordered points to accumulate the top N positions dynamically.
5. Use additional measures or visual calculations for details and tooltips.

That approach is powerful for advanced modelers because it can compare multiple groups on a continuous axis and change the analyzed metric through slicers. However, it is materially more complex than Atlyn Pareto's binding contract and puts more responsibility on the model author to validate denominator behavior, tooltip behavior, and tie/threshold semantics.

**Important caution from the public evidence:** the SQLBI article clearly shows `WINDOW`, `ORDERBY`, disconnected-axis, and `ALLSELECTED`-based context techniques. It does **not** publicly document an Atlyn-style rule that "all equal-contribution threshold ties must join the contributor set even if that exceeds the threshold." Therefore this behavior should be treated as a custom design choice, not assumed native equivalence.

### Atlyn Pareto versus verified Inforiver public material

The strongest public Analytics+ evidence found on 2026-09-09 is the Inforiver article that says Analytics+ histograms can add a **Pareto Line** overlay and also support cumulative histograms, stacked histograms, advanced binning, small multiples, annotations, and ranking. That is genuine public evidence, but it is evidence for a **histogram-oriented workflow**, not for a documented standalone category-ranked Pareto visual matching Atlyn's contract.

Separately, Inforiver Matrix public docs verify these no-code analytical workflows:

- search across report content,
- nested AND/OR filters,
- persisted filters,
- sorting and advanced sorting,
- drag-and-drop reorder,
- percentage-based **Top N + Others**,
- nested Top N rules,
- bookmarking of sorting/filtering/ranking/layout state,
- keyboard shortcuts and accessibility navigation.

Those are meaningful competitive workflow capabilities, but they are not the same as Atlyn's contract:

- **Top N + Others** changes the displayed population and explicitly groups the remainder.
- Atlyn explicitly says **no Top N** and **no synthetic Other bucket**.
- The Inforiver docs we verified do not publicly state Atlyn-style nonnegative-additive input validation, whole-analysis rejection on invalid contributions, aggregated 100,000-category fetch limits, or deterministic threshold-boundary tie inclusion.

Therefore the fair evidence-based position is:

- **Verified for Analytics+**: Pareto-line overlay on histograms.
- **Verified for broader Inforiver docs**: rich no-code filtering, sorting, Top N + Others, bookmarking, and keyboard workflows.
- **Not verified from public docs reviewed**: an Analytics+ or Inforiver category Pareto workflow that is equivalent to Atlyn's denominator, tie, and incomplete-data contract.

## 5. Denominator, filters, Top N, ties, selection, and learnability

### Denominator and filter semantics

- **Atlyn Pareto:** denominator is deliberately constrained and disclosed by the visual contract; incoming filters redefine the universe, but highlights do not redefine the denominator.
- **Native/SQLBI:** denominator is a DAX design problem. Microsoft documents `ALLSELECTED` as preserving external filters while removing row/column query filters, which is useful for visual totals, but still requires careful author intent.
- **Inforiver verified docs:** filtering and Top N are rich and interactive, but the docs do not establish an Atlyn-style denominator guarantee for Pareto ranking.

### Top N and "Other"

- **Atlyn Pareto:** no Top N or Other bucket, by design.
- **Native/SQLBI:** optional and author-designed.
- **Inforiver Matrix docs:** explicitly document **Top N + Others**, nested rules, and percentage-based selection. This is powerful, but analytically different.

### Ties

- **Atlyn Pareto:** threshold ties are explicitly inclusive and deterministic.
- **RANKX:** Microsoft documents dense/skip ranking choices, not Pareto-threshold contributor-set rules.
- **SQLBI:** deterministic ordering is visible in the article through secondary sort keys, but no inclusive threshold-boundary rule was verified.
- **Inforiver:** no public tie rule for Pareto thresholding was verified.

### Selection and bookmarks

- **Atlyn Pareto:** repository contract already distinguishes selection/highlight overlays from denominator changes, and documents formatting-object persistence for rank position with a warning that real bookmark validation must happen in the host.
- **Native Power BI:** Microsoft documents both edited visual interactions and bookmark state capture.
- **Inforiver:** public docs verify bookmarking of sorting/filtering/ranking/layout state and a large keyboard command surface.

### Learnability

- **Atlyn Pareto:** fewer explicit setup artifacts for the stated category-contribution contract: two required bindings, no additional Pareto-specific DAX. Learning time and user success rates have not been measured.
- **Native combo + DAX:** moderate to high difficulty; requires DAX, report-design, and interaction-design decisions.
- **SQLBI dynamic Pareto:** high difficulty; intended for advanced DAX modelers.
- **Inforiver verified public workflows:** potentially lower interaction complexity for end users after setup, but public material reviewed did not prove an Atlyn-equivalent Pareto configuration path.

## 6. Recommended phrasing for external comparisons

Safe, documentation-grounded statements:

- Atlyn Pareto is a **purpose-built custom visual** for category contribution ranking and cumulative-threshold inspection under an explicit denominator and incomplete-data contract.
- Native Power BI can reproduce Pareto-style analyses, but public Microsoft and SQLBI material show that doing so requires **report authoring plus DAX design**, not just dropping in a single built-in visual.
- Public SQLBI material demonstrates a **dynamic and flexible DAX pattern** using disconnected axes and `WINDOW`, suitable for advanced authors.
- Public Inforiver material verifies **Pareto-line overlay on Analytics+ histograms** and extensive no-code filtering/sorting/Top N/bookmarking workflows in Inforiver docs, but the reviewed public sources did **not** verify a standalone category Pareto workflow equivalent to Atlyn's tie-inclusive threshold and incomplete-data semantics.

Statements to avoid unless a coordinator later validates them hands-on:

- "Best-in-class performance"
- "Faster than native"
- "Competitor X cannot do this"
- "Equivalent to SQLBI/Inforiver/native"
- "Bookmarks/export/accessibility work exactly the same everywhere"

## 7. Reproducible comparison protocol for the coordinator

Because this repository should not manipulate live Desktop/service/Marketplace UI from the CLI, the coordinator should run the following comparison manually in authorized Power BI environments.

### Test dataset

Use one offline dataset with:

- clear additive measures,
- deliberate ties at the threshold boundary,
- zeros,
- blanks,
- enough categories to force pagination,
- and a second large dataset for segmentation/incomplete-data checks.

### A. Atlyn Pareto

1. Import the packaged visual.
2. Bind one **Category** and one additive **Contribution** measure.
3. Verify:
   - whole-analysis rejection for invalid contributions,
   - zero-total behavior,
   - threshold at 80% and 100%,
   - tie-inclusive contributor set,
   - default incomplete-data withholding,
   - opt-in received-subset mode,
   - pagination without denominator changes,
   - selection/highlight behavior,
   - save/reopen and bookmark behavior in the real host.

### B. Native combo chart + DAX

1. Create DAX measures for rank, running total, cumulative percentage, and threshold reference.
2. Use native line+column or supporting visuals to display value plus cumulative line.
3. Document exactly:
   - denominator formula,
   - filter context functions used (`ALL`, `ALLSELECTED`, etc.),
   - tie rule,
   - whether Top N or visual filtering truncates the universe,
   - selection/highlight behavior,
   - tooltip and bookmark behavior.

### C. SQLBI dynamic Pareto pattern

1. Reproduce the public SQLBI pattern with a disconnected numeric axis and `WINDOW`.
2. Test single-group and multi-group comparisons.
3. Record:
   - authoring effort,
   - denominator definition,
   - tie behavior,
   - threshold labeling behavior,
   - tooltip behavior,
   - bookmark/restoration behavior.

### D. Inforiver

1. If the authorized environment has current Inforiver products installed, validate only what the public docs suggest:
   - Analytics+ histogram with Pareto-line overlay,
   - any available category-ranking alternative,
   - Top N + Others,
   - filters/sorting/bookmarks,
   - keyboard navigation.
2. Explicitly separate:
   - **verified hands-on behavior**, and
   - **documentation-only inference**.
3. Do **not** claim Atlyn-equivalence unless the live behavior is actually observed.

### Comparison questions to answer for every approach

1. What exactly is the denominator?
2. Does filtering change the universe or only the view?
3. Are highlights separate from the denominator?
4. How are ties ordered?
5. Does threshold crossing include all equal-value boundary ties?
6. Is Top N/Other used, and does it change the analysis population?
7. Are bookmarks restoring filters, sort order, threshold state, and selections as expected?
8. What can a report author learn and reproduce without advanced DAX?

## 8. Bottom line

The public evidence supports positioning Atlyn Pareto as a **specialized, single-visual workflow** for nonnegative additive category-contribution analysis with explicit threshold, tie, and incomplete-data semantics. Native Power BI and the SQLBI pattern are more flexible but demand materially more DAX/report-design responsibility. Public Inforiver evidence confirms adjacent capabilities and a Pareto-line histogram overlay, but the reviewed sources do **not** yet justify claiming full workflow equivalence to Atlyn Pareto's documented category-ranking contract.
