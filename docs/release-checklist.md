# Release and submission checklist

**Reusable release checklist, not a passing-results attestation.** Record completed local gates in the immutable release's `validation/report.json`, command logs, package/quality/sample reports and `release-manifest.json`. Prior 1.0.0.0 results do not validate 1.1.0.0. Hosted CI/CD is disabled and not used. Native host, operational, legal, and submission gates remain separate; a private repository or local certification audit is not Microsoft approval.

## Identity and build

- [x] Owner approved existing Atlyn storefront subscriptions with intentionally ungated runtime and free shared viewing. Runtime licensing implementation is not pending.
- [ ] Preserve `UNLICENSED` first-party npm metadata and existing legal status; do not invent a `LICENSE`, public EULA or paid-author enforcement guarantee.
- [ ] Keep license keys, signer/AAD/API integration, feature gates and runtime licensing requests out of the visual. Do not rebuild or bump the package solely for the commercial-model documentation change.
- [ ] Owner approves the intended audience, distribution route, and product terms.
- [ ] Confirm display name Atlyn Pareto, stable GUID `atlynPareto18722664651549C392ABF6B1EBA46945`, visual package version `1.1.2.0`, host API 5.11 normalized as `5.11.0` in manifest/plugin/payload, SDK dependency `powerbi-visuals-api@5.11.1`, and tools `7.2.1`.
- [ ] Record source ref/commit, lockfile, Node/npm versions, OS, and exact build commands.
- [ ] Run `npm run release:verify` from committed, clean source; retain static checks, independent unit/oracle tests, official package audit, actual-package browser tests, license/advisory checks, sample inspection and performance/capture logs.
- [ ] Record the exact SHA-256, filename, bytes, privileges, locales, archive entries, tools and source provenance; do not rebuild afterward without repeating package-dependent evidence.
- [ ] Confirm zero runtime browser requests/errors, empty privileges, embedded notices and no telemetry, license backend or development-only payload.
- [ ] Inspect real package captures at 80x80, 258x198, 398x298, 1280x620 and 1366x768, including long/dense labels, multiple instances, RTL/high contrast, scroll and state transitions. Record findings and image hashes in `artifacts/visual-review.json`.
- [ ] Retain 20 measured samples plus 3 warmups for each 1,000/100,000-row create/update/resize operation, machine details, raw samples, p50/p95/max and shared-machine caveats.
- [ ] Verify original 20x20 packaged and 300x300 listing icons, and 1-5 unchanged 1366x768 package screenshots no larger than 1024 KB each.
- [ ] Run `npm run release:freeze`; preserve its immutable output and SHA256SUMS outside ephemeral build output. Exclude build certificates/keys/passwords and the third-party Microsoft test workbook.
- [ ] After the coordinator's final gate, align the lowercase `certification` ref with the approved source/package baseline. Until then, hold that ref, changes to `main`, PR merges and submission. Do not overwrite an existing ref without authorization or run hosted CI.

## Functional and host evidence

- [ ] Perform [manual Desktop and service validation](host-validation.md) with versioned evidence and explicit untested paths.
- [ ] Open and refresh the [assembled offline PBIP](../samples/README.md) in the target Desktop build; verify all three authored pages and exact embedded visual, then save the required real PBIX.
- [ ] Compare defect, complaint-cost and customer scenarios to their expected totals, first crossings, full boundary ties, blanks and zeros.
- [ ] Verify incomplete-data default withholding and opt-in received-subset warnings in actual host segmentation where feasible.
- [ ] Verify invalid inputs reject the whole analysis, zero total stays distinct, and overflow does not fabricate percentages.
- [ ] Verify all analyzed ranks remain available through pagination with unchanged totals.
- [ ] Test selection, Ctrl/Meta and multi-visual selection, context menus, keyboard, incoming state/highlights, and format strings; confirm host `allowInteractions: false` suppresses selection changes, clearing, and context-menu requests.
- [ ] Test high contrast, screen reader, narrow/wide layouts, en-US/fr-FR, and RTL. Record known limitations.
- [ ] Record Desktop/service save/reopen, refresh, tenant policy, export, mobile, embedding, and subscription support or exclusions; never infer them from a mock-host pass.

## Owner-approved public materials

- [x] Coordinator approved author name `Atlyn`, email `atlyn.help@gmail.com`, support URL `https://atlynco.github.io/atlyn-powerbi-support/docs/faq/`, and private source URL `https://github.com/AtlynCo/powerbi-pareto-chart`.
- [x] Coordinator verified the FAQ content. This is not an AppSource/Microsoft approval.
- [ ] Manually verify support responsiveness and the operational product support process; recheck FAQ access without repository membership/sign-in at release time.
- [ ] Publish/approve an accurate public privacy notice and appropriate licensing terms/EULA. The repository's `UNLICENSED` metadata is not an end-user agreement.
- [ ] Review actual bundled third-party licenses, copyright notices, and redistribution obligations; preserve required notices with any distributed material.
- [ ] Approve product description, category, audience, branding, claims, and listing assets.
- [ ] Approve the three authentic package-browser screenshot candidates and captions. They are not Desktop captures. Produce the required completed offline PBIX through Desktop using the same version; ensure no customer data or misleading "80/20" claims.
- [ ] Confirm the private GitHub issue URL is not presented as public AppSource-ready support.

## Required Microsoft Power BI certification

- [x] Owner explicitly requires the additional Microsoft Power BI certified badge, not merely an AppSource listing.
- [ ] Check current Microsoft Partner Center/AppSource and Power BI visual certification requirements at submission time; requirements can change.
- [ ] Supply the required artifact, sample/report, public support/privacy/licensing materials, and listing information through the authorized publisher account.
- [ ] Resolve Microsoft validation findings; preserve correspondence and final outcome.
- [ ] Obtain actual Microsoft certification approval for the submitted visual/version; an offline runtime or local audit does not earn the badge.
- [ ] Use certification/approval language or badges only after the corresponding Microsoft approval applies to the submitted release.

`npm run audit:certification` runs the official tools' **local** `--certification-audit` package build through the certificate-store-safe wrapper, followed by archive inspection and project static checks. It is not a Microsoft submission. Its name and successful exit do not constitute certification, security clearance, or manual host approval. Run packaged browser checks afterward; `npm run verify` preserves that order.

References:

- [Power BI visual certification](https://learn.microsoft.com/en-us/power-bi/developer/visuals/power-bi-custom-visuals-certified)
- [Publish Power BI visuals to AppSource](https://learn.microsoft.com/en-us/power-bi/developer/visuals/office-store)
- [Power BI Desktop projects](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-overview)
