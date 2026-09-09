# First-release / submission checklist

**Status: automated local source/package gates passed on 2026-09-09; native host, operational, legal, and submission gates remain open.** `npm run verify` passed with 34 unit/data/sample tests, 25 real-Chromium packaged-runtime tests against a mocked host, and zero reported npm vulnerabilities. The inspected artifact is 128,209 bytes with SHA-256 `2ce6454a78ebc115126b92733d06bbc005205d5f861e28719be66032589b44d3`. These results apply to that artifact, not future rebuilds. The private source and local package are not evidence of a public listing, Microsoft certification, or broader owner/legal approval.

## Identity and build

- [ ] Owner approves the intended audience, distribution route, and product terms.
- [x] Confirm display name Atlyn Pareto, stable GUID `atlynPareto18722664651549C392ABF6B1EBA46945`, visual package version `1.0.0.0`, host API 5.11 normalized as `5.11.0` in manifest/plugin/payload, SDK dependency `powerbi-visuals-api@5.11.1`, and tools `7.2.1`.
- [ ] Record source ref/commit, lockfile, Node/npm versions, OS, and exact build commands.
- [x] Run typecheck, lint, unit tests, build/package inspection, packaged browser tests, dependency audit, license inventory, and static certification-readiness audit; retain output including failures/exceptions.
- [x] Record the inspector's SHA-256, filename, size, privileges, locales, and archive contents for the artifact actually being distributed.
- [x] Recheck absence of privileges, external resources, network/telemetry/license backend, secrets, and development-only artifacts in the shipped runtime.
- [x] Use the package-only wrapper without certificate-store installation/trust or a development server; confirm `.build-home` certificates, private keys, and passwords are absent from the release archive.
- [x] Verify the original 20×20 icon in the actual packaged archive; retain its editable SVG source.
- [x] Preserve runtime permission notices and the vendored Globalize attribution inside the actual visual, not only in an omitted webpack license sidecar.

## Functional and host evidence

- [ ] Perform [manual Desktop and service validation](host-validation.md) with versioned evidence and explicit untested paths.
- [ ] Open and refresh the [PBIP starter](../samples/README.md) in the target Desktop build; import and bind the package. Do not call the starter a finished sample dashboard.
- [ ] Compare both invented samples to their expected totals, first crossings, full boundary ties, blanks, and zeros.
- [ ] Verify incomplete-data default withholding and opt-in received-subset warnings in actual host segmentation where feasible.
- [ ] Verify invalid inputs reject the whole analysis, zero total stays distinct, and overflow does not fabricate percentages.
- [ ] Verify all analyzed ranks remain available through pagination with unchanged totals.
- [ ] Test selection, Ctrl/Meta and multi-visual selection, context menus, keyboard, incoming state/highlights, and format strings; confirm host `allowInteractions: false` suppresses selection changes, clearing, and context-menu requests.
- [ ] Test high contrast, screen reader, narrow/wide layouts, en-US/fr-FR, and RTL. Record known limitations.
- [ ] Record Desktop/service save/reopen, refresh, tenant policy, export, mobile, embedding, and subscription support or exclusions; never infer them from a mock-host pass.

## Owner-approved public materials

- [x] Coordinator approved author name `Atlyn`, email `atlyn.help@gmail.com`, support URL `https://www.atlynco.com/docs/faq`, and private source URL `https://github.com/AtlynCo/powerbi-pareto-chart`.
- [x] Coordinator verified the FAQ content. This is not an AppSource/Microsoft approval.
- [ ] Manually verify support responsiveness and the operational product support process; recheck FAQ access without repository membership/sign-in at release time.
- [ ] Publish/approve an accurate public privacy notice and appropriate licensing terms/EULA. The repository's `UNLICENSED` metadata is not an end-user agreement.
- [ ] Review actual bundled third-party licenses, copyright notices, and redistribution obligations; preserve required notices with any distributed material.
- [ ] Approve product description, category, audience, branding, claims, and listing assets.
- [ ] Produce real screenshots and, if requested, a completed PBIX/sample report from the tested artifact; ensure no customer data or misleading “80/20” claims.
- [ ] Confirm the private GitHub issue URL is not presented as public AppSource-ready support.

## Microsoft submission, if the owner chooses it

- [ ] Check current Microsoft Partner Center/AppSource and Power BI visual certification requirements at submission time; requirements can change.
- [ ] Supply the required artifact, sample/report, public support/privacy/licensing materials, and listing information through the authorized publisher account.
- [ ] Resolve Microsoft validation findings; preserve correspondence and final outcome.
- [ ] Use certification/approval language or badges only after the corresponding Microsoft approval applies to the submitted release.

`npm run audit:certification` runs the official tools' **local** `--certification-audit` package build through the certificate-store-safe wrapper, followed by archive inspection and project static checks. It is not a Microsoft submission. Its name and successful exit do not constitute certification, security clearance, or manual host approval. Run packaged browser checks afterward; `npm run verify` preserves that order.

References:

- [Power BI visual certification](https://learn.microsoft.com/en-us/power-bi/developer/visuals/power-bi-custom-visuals-certified)
- [Publish Power BI visuals to AppSource](https://learn.microsoft.com/en-us/power-bi/developer/visuals/office-store)
- [Power BI Desktop projects](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-overview)
