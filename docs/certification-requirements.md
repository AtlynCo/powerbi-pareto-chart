# Power BI certification and listing requirements (current public docs)

**Checked:** 2026-09-09
**Purpose:** actionable checklist for this worktree based on current public Microsoft documentation.
**Boundary:** this document is a research digest, **not** a certification approval, listing submission, or host-validation record.

**Owner decision added 2026-09-10 (not a new Microsoft-policy review):** acquisition uses existing Atlyn storefront subscriptions; the runtime remains ungated, with free shared viewing and no paid-author identity checks, license keys, signer, AAD/API integration, feature gates or runtime licensing calls. No licensing-driven repackage/version bump is required. First-party metadata remains `UNLICENSED`; this does not invent public license terms. The owner explicitly requires the additional **Microsoft Power BI certified badge**, which is not yet granted. Native/PBIX evidence and authorized Microsoft review remain required, and the coordinator holds certification-ref changes, `main`, merges and submission until the final gate.

## 1. Quick conclusions

### Most important mandatory findings

1. **Certification source branch:** Microsoft says the repository must expose a lowercase **`certification`** branch whose source matches the submitted package.
   Source: [Get your Power BI visuals certified](https://learn.microsoft.com/en-us/power-bi/developer/visuals/power-bi-custom-visuals-certified)
2. **Package icon vs Marketplace logo are different assets:**
   - visual/package icon = **20 x 20 PNG** in `pbiviz.json` assets,
   - Marketplace listing logo = **300 x 300 PNG**.
   Sources: [Package a Power BI visual](https://learn.microsoft.com/en-us/power-bi/developer/visuals/package-visual), [Publish Power BI visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/office-store), [Offer listing details](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-offer-listing)
3. **Listing screenshots:** Microsoft Power BI-specific Partner Center docs say **1 to 5 PNG screenshots**, exactly **1366 x 768**, each **<= 1024 KB**.
   Sources: [Publish Power BI visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/office-store), [Offer listing details](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-offer-listing)
4. **Sample upload artifact:** the submission docs require a **sample PBIX** that works offline and uses the same visual version as the PBIVIZ. A PBIP starter is useful locally but is **not** documented as an accepted submission substitute.
   Sources: [Publish Power BI visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/office-store), [Technical configuration](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-technical-configuration)
5. **Core public links are required:** support URL, privacy policy URL, and EULA/terms are required for listing/submission.
   Sources: [Publish Power BI visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/office-store), [Offer properties](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-properties)

### Most important local-vs-owner split

- **Local worktree can prepare:** source branch, package metadata, icons, repository structure, authentic packaged-browser screenshot candidates, test evidence, public-doc drafts, and owner-ready checklists.
- **Parent/owner must do manually in Power BI Desktop / service / Partner Center:** produce the final sample **PBIX**, capture/approve native-host listing evidence, create or confirm public privacy/help/EULA pages, operate the publisher account, complete Partner Center forms, and request certification. Local screenshot candidates are not Desktop captures or proof of listing acceptance.

## 2. Source register

All pages below were checked on **2026-09-09**.

| Area | Public source | Microsoft doc date shown on page |
| --- | --- | --- |
| Certification overview | [Get your Power BI visuals certified](https://learn.microsoft.com/en-us/power-bi/developer/visuals/power-bi-custom-visuals-certified) | 2025-12-15 |
| Submission tests | [Testing submissions of Power BI custom visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/submission-testing) | 2025-12-15 |
| Power BI publish checklist | [Publish Power BI visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/office-store) | 2025-12-15 |
| Visual guidelines | [Guidelines for publishing Power BI custom visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/guidelines-powerbi-visuals) | 2025-12-15 |
| Offer planning | [Planning a Power BI visual offer](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/marketplace-power-bi-visual) | 2025-07-28 |
| Offer properties | [Configure Power BI visual offer properties](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-properties) | 2025-01-15 |
| Offer listing | [Configure Power BI visual offer listing details](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-offer-listing) | 2025-01-15 |
| Technical configuration | [Set up Power BI visual offer technical configuration](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-technical-configuration) | 2025-01-15 |
| Store images | [Craft effective Microsoft Marketplace store images](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/craft-effective-appsource-store-images) | 2025-01-30 |
| Package icon | [Package a Power BI visual](https://learn.microsoft.com/en-us/power-bi/developer/visuals/package-visual) | 2025-12-15 |
| Capabilities / privileges | [Capabilities and properties of Power BI visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/capabilities) | 2025-12-15 |
| Tooltips support | [Add tooltips to Power BI custom visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/add-tooltips) | 2025-12-15 |
| Filter API | [The Visual Filters API](https://learn.microsoft.com/en-us/power-bi/developer/visuals/filter-api) | 2025-12-15 |
| Bookmark support | [Add bookmark support for Power BI custom visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/bookmarks-support) | 2025-12-15 |
| High contrast | [High-contrast mode support in Power BI visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/high-contrast-support) | 2025-12-15 |
| Multi-visual selection | [Apply selection to multiple visuals feature](https://learn.microsoft.com/en-us/power-bi/developer/visuals/supportsmultivisualselection-feature) | 2025-12-15 |
| Accessibility overview | [Overview of accessibility in Power BI](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-accessibility-overview) | 2026-02-17 |
| Report bookmarks | [Create report bookmarks in Power BI](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-bookmarks) | 2025-12-01 |
| Report tooltips | [Create report tooltips in Power BI](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-tooltips) | 2026-03-03 |
| Visual interactions | [Change how visuals interact in a report](https://learn.microsoft.com/en-us/power-bi/create-reports/service-reports-visual-interactions) | 2026-04-21 |
| PowerPoint export behavior | [Export entire reports to PowerPoint](https://learn.microsoft.com/en-us/power-bi/collaborate-share/end-user-powerpoint) | 2025-12-01 |
| Marketplace policy | [Microsoft Marketplace certification policies](https://learn.microsoft.com/en-us/legal/marketplace/certification-policies#1180-power-bi-visuals) | page metadata 2025-08-06; in-body policy document version 1.67 dated 2024-08-26 |

## 3. Mandatory requirements from current public docs

### A. Repository and certification-review requirements

Microsoft's certification page says the reviewable repository must:

- contain code for **only one** Power BI visual,
- expose a branch named **`certification`** (**lowercase required**),
- ensure the code in that branch **matches the submitted package source**,
- and, if private packages or submodules are used, provide access to those repositories too.

For private repository review, Microsoft also documents a process that includes creating a dedicated validation-team account, enabling 2FA, generating recovery codes, and providing repository link, credentials, recovery codes, and read-only permissions to GitHub user `pbicvsupport`.
Source: [Get your Power BI visuals certified](https://learn.microsoft.com/en-us/power-bi/developer/visuals/power-bi-custom-visuals-certified)

### B. Required repository files

Microsoft says the repository must include:

- `.gitignore`
- `capabilities.json`
- `pbiviz.json`
- `package.json`
- `package-lock.json`
- `tsconfig.json`

It also says `.gitignore` should include `node_modules`, `.tmp`, and `dist`, and that the repository code reviewed for certification must not include those folders.
Source: [Get your Power BI visuals certified](https://learn.microsoft.com/en-us/power-bi/developer/visuals/power-bi-custom-visuals-certified)

### C. Required package/tooling checks

Microsoft's current certification page says the following commands must not return errors:

- `npm install`
- `pbiviz package`
- `npm audit` with **no moderate or high warnings**
- ESLint with the Power BI visuals plugin and no lint errors

The same page also says `package.json` must include:

- `typescript`
- `eslint`
- `eslint-plugin-powerbi-visuals`
- and an ESLint command such as `"eslint": "npx eslint . --ext .js,.jsx,.ts,.tsx"`

Source: [Get your Power BI visuals certified](https://learn.microsoft.com/en-us/power-bi/developer/visuals/power-bi-custom-visuals-certified)

### D. Required code/security constraints for certification

The current certification docs explicitly require or prohibit the following:

**Required**

- use only public reviewable OSS components,
- support the **Rendering Events API**,
- sanitize user input or user data before adding it to the DOM,
- use the Microsoft sample report dataset for testing.

**Not allowed**

- external HTTP/S or WebSocket access from the visual,
- `WebAccess` privileges populated with external resources,
- `fetch` or `XMLHttpRequest`,
- `innerHTML` or `D3.html(user data or user input)`,
- browser-console JavaScript errors or exceptions for any input data,
- `eval`, `Function`, unsafe timer/code execution patterns,
- minified JavaScript files or projects.

Source: [Get your Power BI visuals certified](https://learn.microsoft.com/en-us/power-bi/developer/visuals/power-bi-custom-visuals-certified)

### E. Required submission artifacts

The current Power BI submission docs require:

- a **PBIVIZ package** with required metadata,
- a **sample PBIX report file**,
- a **300 x 300 PNG logo**,
- **at least one** screenshot and **up to five**,
- a **support URL**,
- a **privacy policy URL**,
- an **EULA** (standard contract, Power BI visual contract, or your own terms),
- and a Partner Center publisher account.

The sample **PBIX** must work **offline** and, in the technical configuration page, must use the **same visual version** as the PBIVIZ.
Sources: [Publish Power BI visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/office-store), [Technical configuration](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-technical-configuration)

### F. Required asset dimensions that are consistently documented in Power BI-specific pages

- **Package icon inside the visual package:** **20 x 20 PNG**
  Source: [Package a Power BI visual](https://learn.microsoft.com/en-us/power-bi/developer/visuals/package-visual)
- **Marketplace logo:** **300 x 300 PNG**
  Sources: [Publish Power BI visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/office-store), [Offer listing details](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-offer-listing)
- **Listing screenshots:** **1 to 5 PNG files**, exactly **1366 x 768**, each **<= 1024 KB**
  Sources: [Publish Power BI visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/office-store), [Offer listing details](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-offer-listing), [Store images guide](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/craft-effective-appsource-store-images)

### G. Required package metadata

Public docs say the PBIVIZ / `pbiviz.json` metadata must include:

- visual name
- display name
- GUID
- four-part version number `x.x.x.x`
- description
- support URL
- author name
- author email

If updating an existing published visual, Microsoft says **do not change the GUID** and increase the version number.
Sources: [Publish Power BI visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/office-store), [Technical configuration](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-technical-configuration), [Testing submissions](https://learn.microsoft.com/en-us/power-bi/developer/visuals/submission-testing)

### H. Required manual submission tests

Microsoft's current test page expects manual validation for:

- visual conversion to/from other native visuals without errors,
- cross-selection behavior with other visuals,
- min/max `dataViewMapping` behavior,
- removal of fields in arbitrary order,
- format pane opening across bucket configurations,
- tooltip correctness after filter pane, slicer, and published-visual filtering,
- resize/minimum-size/scroll behavior,
- dashboard pinning,
- multiple visual instances across pages,
- view/edit mode behavior,
- property changes and bad data handling,
- persistence after save/reopen/page switching,
- numeric/date/character formatting,
- data labels using the format string,
- large/small data volumes and bad data inputs,
- current Power BI Desktop behavior,
- publish from Desktop to the web service,
- and acceptable performance.

Source: [Testing submissions of Power BI custom visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/submission-testing)

## 4. Recommended requirements from current public docs

These are not always phrased as hard submission blockers, but Microsoft explicitly recommends them or treats them as quality-significant.

### A. Publish before requesting certification

Microsoft recommends publishing the visual to AppSource before requesting certification because certification can take time.
Source: [Get your Power BI visuals certified](https://learn.microsoft.com/en-us/power-bi/developer/visuals/power-bi-custom-visuals-certified)

### B. Use latest API and latest visual tools

- use the latest Power BI visuals API,
- use the latest `powerbi-visuals-tools`.

Sources: [Get your Power BI visuals certified](https://learn.microsoft.com/en-us/power-bi/developer/visuals/power-bi-custom-visuals-certified), [Guidelines for publishing Power BI custom visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/guidelines-powerbi-visuals)

### C. Run local certification audit helpers

Microsoft documents:

- `pbiviz package --certification-audit`
- `pbiviz package --certification-fix`

These are local helpers, not Microsoft certification.
Source: [Get your Power BI visuals certified](https://learn.microsoft.com/en-us/power-bi/developer/visuals/power-bi-custom-visuals-certified)

### D. Provide better listing collateral

Microsoft recommends:

- adding text bubbles/callouts to screenshots,
- providing a short video link,
- writing a detailed description that mentions supported features,
- creating a helpful landing/help page,
- and keeping listing images accessible and legible.

Sources: [Publish Power BI visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/office-store), [Guidelines for publishing Power BI custom visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/guidelines-powerbi-visuals), [Store images guide](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/craft-effective-appsource-store-images)

### E. Support high contrast, bookmarks, tooltips, and multi-visual selection when your product claims them

These are not blanket listing prerequisites on their own, but Microsoft publishes explicit implementation guidance for them and the submission tests cover related behavior:

- **High contrast:** [High-contrast mode support in Power BI visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/high-contrast-support)
- **Tooltips / report page tooltips:** [Add tooltips to Power BI custom visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/add-tooltips)
- **Bookmarks:** [Add bookmark support for Power BI custom visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/bookmarks-support)
- **Filters:** [The Visual Filters API](https://learn.microsoft.com/en-us/power-bi/developer/visuals/filter-api)
- **Multi-visual selection:** [Apply selection to multiple visuals feature](https://learn.microsoft.com/en-us/power-bi/developer/visuals/supportsmultivisualselection-feature)

If the listing or README claims these behaviors, the coordinator should treat them as **real-host manual validation requirements** before submission.

## 5. Manual / owner prerequisites that cannot be completed from this worktree alone

The following items require manual action, live host access, or publisher authority.

### A. Partner Center and Marketplace

- Enroll / maintain the authorized publisher account in Partner Center.
- Create or update the Marketplace offer.
- Enter categories, industries, summary, description, keywords, media, legal, and support details.
- Upload the final PBIVIZ, sample PBIX, screenshots, and logo.
- Request certification and respond to validation findings.

Sources: [Publish Power BI visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/office-store), [Planning a Power BI visual offer](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/marketplace-power-bi-visual), [Offer properties](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-properties), [Offer listing details](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-offer-listing)

### B. Public legal/support endpoints

Owner-approved public URLs are required for:

- privacy policy,
- support/help,
- EULA / terms.

If different Microsoft pages allow `http://` in some Partner Center UI text, the stricter Power BI submission page still says the support/privacy URLs should start with **`https://`**. For safety, use **HTTPS everywhere**.
Sources: [Publish Power BI visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/office-store), [Offer properties](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-properties)

### C. Sample PBIX production

The required sample artifact is a **PBIX** that works offline. An authored/assembled PBIP is useful preparation but does not replace it. A parent/owner must open Power BI Desktop, verify the final artifact and bindings, refresh, and save a submission-ready PBIX manually.
Sources: [Publish Power BI visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/office-store), [Technical configuration](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-technical-configuration), [Power BI Desktop projects (PBIP)](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-overview)

### D. Real-host validation

The worktree can document expected behavior, but only a person with authorized Power BI Desktop / service access can:

- verify import/publish/save/reopen behavior,
- verify bookmark and tooltip behavior in the real host,
- verify accessibility with real screen reader / high-contrast runs,
- verify export behavior,
- capture listing screenshots from the actual host,
- and confirm tenant/policy behavior.

Relevant sources: [Testing submissions](https://learn.microsoft.com/en-us/power-bi/developer/visuals/submission-testing), [Overview of accessibility in Power BI](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-accessibility-overview), [Export entire reports to PowerPoint](https://learn.microsoft.com/en-us/power-bi/collaborate-share/end-user-powerpoint)

## 6. Tooltips, filters, bookmarks, accessibility, and export: what is actually required

### Tooltips

- Submission tests explicitly require tooltips to remain correct after filter-pane, slicer, and cross-filter scenarios.
- If report-page tooltips are supported, Microsoft documents the `tooltips` object in `capabilities.json`.

Sources: [Testing submissions](https://learn.microsoft.com/en-us/power-bi/developer/visuals/submission-testing), [Add tooltips to Power BI custom visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/add-tooltips)

### Filters and filter settings

- Submission tests require correct behavior with filters at visual/page/report level and with slicers.
- If the visual actively filters other visuals, Microsoft documents the filter object/API and bookmark restoration through `jsonFilters`.

Sources: [Testing submissions](https://learn.microsoft.com/en-us/power-bi/developer/visuals/submission-testing), [The Visual Filters API](https://learn.microsoft.com/en-us/power-bi/developer/visuals/filter-api)

### Bookmarks

- Bookmarks are not listed as a universal precondition for all submissions, but Microsoft documents how custom visuals must save/restore selection or filter state if they support bookmarks or filtering behavior.
- The current repository already notes that bookmark claims still need real-host verification.

Sources: [Add bookmark support for Power BI custom visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/bookmarks-support), [Create report bookmarks in Power BI](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-bookmarks)

### Accessibility

- Microsoft strongly emphasizes accessible reports and publishes explicit high-contrast implementation guidance.
- Marketplace media must also be accessible/legible.
- This is best treated as a **manual owner validation requirement** for any claimed accessible release.

Sources: [Overview of accessibility in Power BI](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-accessibility-overview), [High-contrast mode support in Power BI visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/high-contrast-support), [Store images guide](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/craft-effective-appsource-store-images)

### Export

- Microsoft's certification overview says certified visuals can be used in export-to-PowerPoint and subscription-email scenarios.
- The PowerPoint export doc separately says **custom visuals must be certified** to be supported in that export path.
- Therefore export support is a **benefit of certification**, but it still needs real-host verification and should not be promised before approval.

Sources: [Get your Power BI visuals certified](https://learn.microsoft.com/en-us/power-bi/developer/visuals/power-bi-custom-visuals-certified), [Export entire reports to PowerPoint](https://learn.microsoft.com/en-us/power-bi/collaborate-share/end-user-powerpoint)

## 7. Current-doc contradictions or moving-target notes

### A. Screenshot dimensions conflict

Current public docs conflict:

- Power BI submission and Power BI offer-listing pages say screenshots must be **1366 x 768** and up to five.
- The newer planning page says screenshots must be **1280 x 720** and include a caption.

Because the **Power BI-specific submission pages** are more specific and consistent with each other, the safest current interpretation is:

- prepare **1366 x 768 PNG** screenshots for the actual listing upload,
- keep captions/callouts in mind because the planning/store-image guidance still recommends them,
- and re-check the live Partner Center uploader before final submission.

Sources: [Publish Power BI visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/office-store), [Offer listing details](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-offer-listing), [Planning a Power BI visual offer](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/marketplace-power-bi-visual)

### B. Support URL scheme language is inconsistent

- The Power BI publish page says support/privacy URLs should start with **`https://`**.
- The generic Partner Center properties page says the support document link should include **`http://` or `https://`**.

Safest interpretation: use **HTTPS only**.
Sources: [Publish Power BI visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/office-store), [Offer properties](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-properties)

### C. Marketplace policy page shows two different dates

The Marketplace certification-policies page currently shows page metadata dated **2025-08-06**, while the body says **Document version 1.67** and **Document date: August 26, 2024**. Treat it as a living policy page and recheck before submission.
Source: [Microsoft Marketplace certification policies](https://learn.microsoft.com/en-us/legal/marketplace/certification-policies#1180-power-bi-visuals)

### D. PBIP is still preview and not documented as a submission artifact

Microsoft documents PBIP as a **preview** authoring format. Power BI visual submission pages still require a **PBIX** sample. Do not assume a PBIP starter satisfies the listing requirement.
Sources: [Power BI Desktop projects (PBIP)](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-overview), [Publish Power BI visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/office-store)

## 8. Actionable gap assessment for this repository

### Local gaps or checks this worktree can support

- Confirm the repository keeps a single-visual scope for certification review.
- Maintain or create the lowercase **`certification`** branch before submission.
- Keep required files present and package metadata complete.
- Keep the package icon at **20 x 20 PNG** and keep editable source for the listing logo.
- Preserve evidence for `npm install`, `pbiviz package`, `npm audit`, and ESLint.
- Keep documentation precise about:
  - offline runtime,
  - no external services,
  - bookmark/export claims needing real-host validation,
  - authored PBIP not being the required sample PBIX.
- Preserve the documented supported `--all-locales --no-stats` packaging path and certificate-file-only wrapper. The plain default locale-loader path has a tools/formattingutils compatibility failure; do not claim the unqualified default command was validated successfully.

### Gaps requiring parent/owner/manual completion

- Submission-ready **PBIX** sample file
- owner approval of the locally prepared **300 x 300** Marketplace logo
- owner approval/native-host corroboration of the **1366 x 768** listing screenshot candidates (1-5)
- public **privacy**, **help/support**, and **EULA** URLs
- Partner Center offer creation/maintenance
- real Power BI Desktop/service validation
- certification request and correspondence

## 9. Relationship to existing repo docs

This repository already contains useful owner-facing cautions in:

- [release-checklist.md](release-checklist.md)
- [host-validation.md](host-validation.md)
- [privacy-support-licensing.md](privacy-support-licensing.md)

Those local docs already align with several Microsoft requirements:

- 20 x 20 packaged icon retention,
- manual host validation,
- public privacy/support/licensing gaps,
- PBIP preparation not being proof of native-host validation or an accepted PBIX submission.

This new document should be read as the **current public-source evidence layer** that explains *why* those repo cautions exist and which items remain parent-only.

## 10. Submission-safe bottom line

As of **2026-09-09**, the public Microsoft docs support the following minimum interpretation:

- ship a reviewable single-visual repository,
- expose a lowercase **`certification`** branch matching the submitted source,
- provide the required repo files and clean local package/test results,
- supply a **PBIVIZ**, an offline **sample PBIX**, a **300 x 300** logo, and **1-5 screenshots** (safest current size: **1366 x 768**),
- publish/own valid **HTTPS** support and privacy links plus an **EULA**,
- and complete manual Power BI Desktop/service/Partner Center validation before submission.

Nothing in this document should be read as permission to skip real-host checks or as evidence that the current worktree is already certified, listed, or submission-ready.
