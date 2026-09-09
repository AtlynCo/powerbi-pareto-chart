# Install, use, export, and validate in the real host

This is a manual procedure, **not a record of completed validation**. Automated browser tests use a mocked host. Record the exact `.pbiviz` SHA-256, Desktop version, service/browser environment, policy settings, and pass/fail evidence when performing these steps.

## Import and bind

1. Build and inspect the package using [development instructions](development.md), or obtain an owner-authorized artifact.
2. Use a disposable report containing only the [invented sample data](../samples/README.md). For PBIP, follow its preview prerequisites and refresh instructions first.
3. In Power BI Desktop, use **Visualizations → … → Import a visual from a file** and choose the inspected `.pbiviz`.
4. Accept the custom-visual warning only under your organization's policy. If private visuals are blocked, ask the administrator to review deployment; do not bypass the restriction.
5. Add the visual and bind one grouping to **Category**, one additive numeric measure to **Contribution**, and optionally up to five measures to **Tooltip**.
6. Keep threshold at 80%, incomplete policy at its default, page size at 30, and the data table visible initially.
7. Verify against the sample's expected totals/ranking. Save, close, reopen, and check that bindings and format settings persist.

Importing a `.pbiviz` makes a private visual available to that report; it does not publish it to AppSource. Organization-store deployment and service sharing require separate administrative and owner authorization.

## Keyboard and selection

| Action | Expected behavior |
| --- | --- |
| Tab / Shift+Tab | Move between interactive visual controls and table category buttons |
| Arrow keys on a chart category | Move focus among the current page's chart categories |
| Home / End on chart | First / last chart category on the current page |
| Enter / Space | Select the focused category |
| Ctrl-click or Meta-click | Host multiselect |
| Ctrl/Meta + Enter/Space on a chart category | Host keyboard multiselect |
| Escape | Clear selection |
| Right-click, Context Menu key, or Shift+F10 | Request the host context menu for the category |
| Previous / Next controls | Change the displayed ranks, not the analysis denominator |

Verify focus visibility, keyboard tooltips, table reading order, incoming selections, and selection persistence across redraws/pages. Test interactions with another native visual twice: once configured to cross-highlight and once to cross-filter. Highlights should overlay original bars without reranking; filters should recompute against the new query.

Also test multi-visual selection in a supporting host/report. Where the host sets `allowInteractions: false`, selection, clear-selection, and context-menu requests must be suppressed; confirm the chart/table can still be read and paged. Record whether this gating scenario was observed in the real host or only exercised in the mock-host harness.

## Numerical and completeness matrix

Use a duplicate disposable model/report for deliberately invalid inputs. Do not alter the release sample just to record a test.

- Defect and cost samples: compare total, first crossing, all boundary ties, and zero-valued categories to the sample tables.
- Null category with a positive contribution: retain `(Blank)`.
- Null/missing contribution, nonnumeric/nonfinite value, and negative contribution: reject the whole analysis with diagnostics where the host can deliver the case. Some malformed values are only constructible in a harness; do not claim Desktop delivered them unless observed.
- All-zero contributions: show the zero-total state, with no invented percentages.
- Very large finite positive numbers whose sum overflows: refuse an invalid total.
- Thresholds 1%, 80%, and 100%; a single category; exact boundary ties; repeated display labels with distinct identities.
- More than one page: ensure cumulative share on page 2 includes all earlier ranks and boundary ties can span pages.
- More than 10,000 categories: inspect actual host segmentation and successive aggregated fetches; no double-counting of earlier windows.
- Refused fetch, retained segment marker, and 100,000-category bound: preserve incomplete status. Verify default shares withheld and explicitly warned received-subset behavior.
- Active slicers and report/page/visual filters: label/interpret results as the current query, not the unfiltered model. Also test your model's row-level security where applicable.

A small sample cannot establish large-data host behavior. Record which large-data/refusal scenarios were observed in a real host and which remain harness-only.

## Presentation and assistive technology

- Resize from a small tile to a wide canvas; verify chart/table scrolling and usable controls.
- Inspect long labels, very large formatted numbers, blanks, and host measure format strings.
- Switch host locale between en-US and fr-FR; check strings, formatted numeric values, and no locale-driven tie reorder.
- Test RTL host layout separately; only en-US/fr-FR visual translations are supplied.
- Test supported high-contrast themes, keyboard-only operation, and at least one screen reader. Check focused category descriptions, status/error announcements, table headers, and threshold meaning without relying only on color.
- Verify no animations and no application-origin runtime network, storage, telemetry, or licensing calls. Distinguish Power BI's own host traffic from visual code.

## Save, publish, and export

For an owner-approved manual test, save the completed report as PBIX or PBIP in Desktop. A PBIX export/save is a **manual output**; no PBIX is supplied by this repository. Before sharing, confirm the file contains no private model data or credentials.

Publishing to a test workspace is optional and requires authorization and appropriate Power BI access. Recheck loading, settings, tooltips, interactions, refresh, and tenant restrictions in the service.

The visual has **no custom CSV/download/export backend or download privilege**. Its in-visual data table is an accessible reading path, not an exported file. Power BI's **… → Export data** availability and content depend on host version, permissions, tenant/report settings, and custom-visual support. When available, compare the host export to the bound measure and record whether it includes raw/summarized fields; do not assume it contains visual-computed cumulative columns or only the visible page.

PDF, PowerPoint, subscription images, mobile, embedding, and other host rendering paths need separate verification. Noncertified custom visuals can be unsupported or blocked in these paths. If an export is unavailable or omits the visual, record that limitation rather than implying certification or promising a workaround.

Attach results to the [release checklist](release-checklist.md). Screenshots must come from the actual tested host/artifact; do not use fabricated screenshots or approval badges.
