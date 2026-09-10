# Atlyn Pareto listing and certification dossier

**Draft for owner review. Not a submission, approval, license offer, or certification claim.** The coordinator owns all Desktop/service and Partner Center actions. No live upload, listing mutation, or submission is authorized by this document.

**Owner decision, 2026-09-10:** existing Atlyn storefront subscriptions fund acquisition; the runtime is intentionally ungated and shared viewing is free. No paid-author identity enforcement or runtime licensing integration is pending. Keep the existing offline package and version unless another actual runtime change requires a rebuild. The additional **Microsoft Power BI certified badge is required but has not been granted**. Native/PBIX assets and the coordinator's final release gate remain outstanding; do not move the certification ref, change `main`, merge or submit.

## Proposed listing copy

**Name:** Atlyn Pareto

**Short description:** Rank additive contributions and explore cumulative concentration with transparent data scope.

**Description:**

Atlyn Pareto helps report authors examine which categories contribute to an additive quantity, such as defect counts, complaint handling costs, or customer revenue. Bind a category and a nonnegative contribution measure to see descending bars alongside cumulative share on a separately labeled percentage axis.

Choose a threshold from 1% to 100%, with 80% as the starting convention rather than a universal rule. The visual identifies the first crossing and includes all equally valued contributors at that boundary. A ranked data table and model-formatted native tooltips provide exact values. Adaptive pages, a wide-tile concentration overview, Go to rank, and Show threshold make larger category sets navigable without changing the denominator.

Data scope is explicit. Report filters change the current query. Highlight overlays do not silently change its denominator. Segmented fetching is bounded at 100,000 categories; if completeness is not established, shares are withheld by default. Authors can deliberately analyze a clearly disclosed received subset instead. Invalid, missing, nonfinite, and negative contributions reject the analysis rather than disappearing from its total.

The visual provides native selection and context-menu integration, keyboard access, a readable table, high-contrast handling, English and French resources, and RTL presentation. Very small tiles show a compact state instead of an unreadable chart. The runtime is offline, with no telemetry, remote assets, external calculation service, or licensing backend.

Acquire Atlyn Pareto through the existing Atlyn storefront subscription offering. The visual itself is ungated, and recipients can view shared reports without purchasing an additional visual subscription or entering a license key. Power BI licensing, access permissions and tenant policies still apply. The runtime does not verify an author's subscription identity.

The report author must supply an additive measure with a consistent unit. Rates, averages, percentages, overlapping distinct counts, and other nonadditive measures are not repaired by the visual. It does not provide Top N/Other aggregation, ABC classes, forecasting, or a financial formula engine.

**Suggested search terms:** Pareto; concentration; cumulative contribution; defect analysis; complaint cost; customer concentration.

This copy is subject to final owner approval and the current Partner Center field constraints. The approved free-shared-viewing statement does not mean free acquisition or an open-source license. Do not add Microsoft-certified, IBCS-certified, "best-in-class," performance-superiority, specific price/trial, or support-response claims without the corresponding evidence and authorization.

## Publisher-owned fields and gates

| Field or decision | Current status |
| --- | --- |
| Product/contact metadata | Approved: Atlyn; `atlyn.help@gmail.com`; `https://www.atlynco.com/docs/faq` |
| Public support operations | Responsiveness and release-time anonymous access require owner/coordinator confirmation |
| Public privacy URL and notice | Owner approval/publication required; internal privacy notes are not a published notice |
| Acquisition and runtime architecture | Approved: existing Atlyn storefront subscriptions, ungated runtime, free shared viewing; no paid-author enforcement |
| First-party source license | Preserve `package.json` identifier `UNLICENSED`; no root first-party `LICENSE` file and no relicensing |
| Public EULA, price/trial details and distribution terms | Owner-managed legal/publication fields remain to be supplied or confirmed; not a runtime integration blocker |
| Publisher identity, account authority, business/legal acceptance | Owner/authorized publisher only |
| Listing categories and markets | Choose from the current portal with owner approval |
| Additional Power BI certified badge | Required by owner; Microsoft has not granted it, so omit the badge/claim until actual approval |
| Private source access for reviewers | Coordinator must arrange authorized access; never make the repository public by default |
| Real PBIX/sample acceptance | Desktop-generated output and coordinator validation required; never rename a PBIP/ZIP to PBIX |
| Actual Desktop/service/export evidence | Manual coordinator gate; packaged Chromium host-mock results do not establish it |

## Release materials

Use one immutable package and the matching release manifest throughout the handoff. The manifest records source commit, tool/SDK versions, package size and hashes, build-input fingerprints, and asset hashes. Do not substitute a later rebuild without repeating package-dependent evidence.

- Original 20x20 packaged icon and 300x300 listing icon, with editable/raster-generation sources.
- Three authentic, unchanged 1366x768 PNG candidates, each at most 1024 KB, in the frozen bundle's `quality/listing-candidates`: defect concentration with inclusive threshold ties; complaint cost with currency-formatted values; customer concentration with dense-rank navigation. Captures use invented data and the actual package in a local host-mock browser, not Desktop.
- Authored offline PBIP source and a complete assembled sample with the exact visual resources and useful bound scenarios. Native open/refresh/save-as-PBIX remains manual.
- Local validation logs, independent arithmetic-oracle results, package-only browser evidence, reproducible performance samples, dependency/license inventory, and certification-readiness audit output.
- [Data contract](data-contract.md), [host validation procedure](host-validation.md), [workflow comparison](competitive-workflow.md), and [current Microsoft requirement mapping](certification-requirements.md).

The final lowercase certification source branch must identify the reviewed final source baseline. Do not overwrite an existing certification branch or create one against an intermediate package. GitHub stores source and review only: GitHub Actions and other hosted CI/CD are not used.

## Native scenario handoff

The coordinator should record the exact package hash and Desktop/service versions, then open/refresh the assembled sample, compare the documented defect/cost/customer results, save/reopen, and validate settings/bookmarks and cross-visual filtering/highlighting. Exercise the documented viewport matrix, keyboard and touch, actual high contrast/assistive technology, and export render lifecycle. Record unsupported or blocked export paths rather than substituting mocked evidence.

Only the authorized coordinator may upload the approved materials, grant reviewer source access, accept legal terms, or submit for Marketplace/certification review. Preserve Microsoft's actual response and resolve findings before describing the release as certified.
