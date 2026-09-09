# Data contract and interpretation

## Supported binding

| Role | Cardinality | Meaning |
| --- | --- | --- |
| Category | Exactly 1 grouping field | A host-grouped category and its Power BI identity |
| Contribution | Exactly 1 numeric measure | Nonnegative, additive quantity for that category |
| Tooltips | 0–5 measures | Context only; never added to the contribution denominator |

Use disjoint category contributions in a consistent unit: defect counts, complaint handling costs, or additive sales amounts are examples. The report author is responsible for valid measure semantics. Numeric type metadata does not prove additivity. The visual cannot infer whether a rate, average, ratio, percentage, overlapping distinct count, or model calculation can be summed meaningfully. Do not bind such a measure and interpret its sum as a population contribution.

The visual does not implement multiple category levels, drill-down, decomposition, time-series analysis, model-level aggregation repair, Top N, or an Other bucket.

## Validation states

- Null or missing category values remain categories and display as `(Blank)` in English. A missing label does not authorize dropping its contribution.
- Null/missing, nonnumeric, nonfinite (`NaN` or infinity), and negative contribution values are invalid. Any such row rejects the **whole analysis**, with diagnostic counts. Negative rows are never silently removed or clamped to zero.
- Valid individual zeros remain in the ranked rows and category count.
- An all-zero total is a separate state: neither shares nor a meaningful threshold crossing can be calculated.
- Compensated summation reduces floating-point accumulation error. Nonfinite totals/overflow are detected rather than displayed as plausible percentages. This does not provide arbitrary precision or recover precision already lost in the model or JavaScript numeric representation.
- Tooltip measures are descriptive, not validation substitutes or alternative denominators.

“Analyze received subset” relaxes the completeness requirement only. It does **not** allow an invalid contribution to be silently omitted.

The ranking/identity safety bound does not hide known invalid values in a larger received view: all received contribution values are checked, including the tail beyond 100,000 categories. Any known invalid tail rejects the analysis. Categories not delivered by the host cannot be inspected; their validity and total remain unknown.

## Ranking and threshold

Rows sort by:

1. Contribution descending.
2. Typed category key, compared by code unit rather than locale collation.
3. Host identity key.
4. Original source index as a final fallback.

Formatting and display labels do not become identity keys. Equal formatted labels can still represent different typed values or host identities. A locale change does not reorder contribution ties.

For a valid, positive-total analysis, each category's share is its contribution divided by the analyzed total. Cumulative share is the running total in that deterministic order divided by the same total. The default threshold is 80%, configurable from 1% to 100%.

The first row whose cumulative share reaches the threshold is the **first crossing**. The **contributor set** includes that row, every preceding row, and every category with exactly the same contribution as the crossing row—even if a tied category occurs later. Therefore the contributor set can exceed the requested percentage. Display rounding does not create ties.

Boundary comparisons allow four relative machine epsilons to absorb numeric roundoff, not a material shortfall. At a 100% threshold, every positive contribution is included, even when a tiny contribution is below display precision; trailing zeros are excluded from the contributor set.

For example, the defect sample totals 200. Its 80% first crossing is rank 4 at 160; all three categories contributing 20 are included, bringing the contributor set to 180 (90%), five of nine categories. This is a property of these invented data, not evidence for a universal 80/20 relationship.

## Universe, host filters, and incomplete data

“Complete” means complete **for the received Power BI query according to host signals**. Report/page/visual filters, slicers, model security, and cross-filtering can change that query. It does not mean all rows in an unfiltered model. The visual cannot detect an opaque upstream model defect, deliberate upstream Top N, or an unreported host reduction.

The categorical mapping requests a `WINDOW` of 10,000 categories. If the host marks the data as segmented, the visual requests `fetchMoreData(true)`. In this aggregated mode, a later data view includes already received rows and replaces the earlier view; it must not be appended again.

The visual limits analysis to a 100,000-category safety bound. If a segment marker remains, fetching is refused, or the bound prevents receiving the complete query, the state remains explicitly incomplete. Hitting a safety bound is not proof that all query categories were received.

A stalled aggregated append (no additional rows) stops retrieval and remains incomplete. An unexpected incremental segment is not treated as an aggregated complete query. Missing host fetch support follows the explicitly disclosed refused/unsupported path. Resizing or changing formatting does not request the same segment again.

| Incomplete-data policy | Denominator and interpretation |
| --- | --- |
| Withhold shares (default) | No cumulative-share or threshold conclusion is offered for an incomplete universe. |
| Analyze received subset (opt-in) | Uses only the **received valid subset** as denominator and retains a warning. This is not a full-query or full-population conclusion. |

When comparing reports, record the filters, received category count, completeness state, and policy along with the threshold.

## Pagination and highlights

The **maximum** page size is 10-100 categories, default 30. Actual pages adapt to tile width, font size, and long category labels; wide charts reserve more space for long labels. All ranks remain available through Previous/Next, **Go to rank**, and **Show threshold**. All analyzed rows contribute to the denominator, cumulative totals, first crossing, and boundary ties, including rows on other pages. A page is not a separate Pareto analysis and does not restart cumulative share at zero.

Wide tiles with more than one page show a small all-analyzed-ranks cumulative overview. It samples at most one point per horizontal pixel for presentation; it neither changes the underlying arithmetic nor introduces Other buckets. The threshold marker uses the exact first-crossing rank. Read the ranked table for exact values.

The rank position is persisted through Power BI's formatting-object API as `analysis.startRank`; replayed settings/bookmark metadata restores it, clamped to the current filtered universe. This is locally tested using host mocks, not proof of native bookmark behavior. Resizing and formatting-only updates reuse cached data and identities, without refetching or reranking unless the threshold changes.

Incoming highlights are overlays on the original contributions. They do not change the original ranking, denominator, or threshold membership. Host **cross-filtering** is different: it can send a new query universe, which must be analyzed anew. Host selection state is reflected in the chart/table without locally recomputing a selected-only denominator.

Null highlights mean no highlight, not a zero base contribution. A highlight must be finite, nonnegative, and no greater than its base contribution. Unsupported highlight values are not drawn and their count is disclosed; valid base contributions remain unchanged.

The visual declares `supportsMultiVisualSelection: true` and uses the host selection manager. Cross-visual selection behavior also depends on the report and host. When the host explicitly sets `allowInteractions: false`, the visual does not request selection changes, clearing, or context menus; reading, focus navigation, and presentation paging remain separate from those host mutations.

## Presentation and accessibility

The chart and table communicate rank, value, share, cumulative share, and threshold membership when those quantities are defined. Retain the data table for a non-chart reading path. Full category names remain in the table, native tooltips and accessible labels; chart labels use up to two shortened lines without splitting Unicode graphemes. Essential totals/universe state and the chart precede optional explanatory details. Tiles below 160 px wide or 140 px high show a compact state/total rather than an illegible chart.

Tooltips and table values retain model formats and locale. Axes use compact/scientific numeric labels when the full model-formatted label cannot fit or would incorrectly round a nonzero tick to zero; consult the bound measure name and model-formatted tooltip for units. Compact tiles use 10-pixel chart labels; the full chart and data table use the text-size setting. Large text increases label spacing and reduces tick/page density rather than overlapping ranks and labels. Zero in persisted threshold metadata is normalized to the supported 1% minimum and the format pane reflects that normalization. Invalid/out-of-range numeric settings use documented defaults/bounds; unsupported completeness-policy values revert to withholding. Localized visual strings are supplied for en-US and fr-FR. RTL layout and high contrast are presentation paths, not evidence that every language or assistive technology has been validated.

See [manual host validation](host-validation.md) for keyboard actions and the checks still required in real Power BI.
