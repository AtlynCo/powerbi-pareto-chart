# Atlyn Pareto

An offline Power BI custom visual for ranking **nonnegative, additive contributions** and inspecting cumulative concentration. Descending bars show contribution; the cumulative line and configurable threshold identify a contributor set, including every equally valued category at the threshold boundary.

**Release-quality source: 1.1.0.0.** This private repository is not an AppSource listing, a Microsoft-certified visual, or an open-source license grant. Automated checks and manual host validation must be recorded for the exact release artifact; this README does not attest that they passed.

## Acquisition and shared viewing

The owner-approved model is **acquisition through existing Atlyn storefront subscriptions, with an intentionally ungated visual runtime and free shared viewing**. Commercial acquisition is managed outside Power BI. The visual does not enforce paid-author identity or require viewer purchases, license keys, sign-in, entitlement APIs, feature gates, or runtime licensing requests.

The existing offline renderer is the intended implementation; no runtime licensing integration or licensing-driven package/version change is pending. First-party npm license metadata remains **`UNLICENSED`**, with no root first-party `LICENSE` file or new license grant. See [licensing boundaries](docs/privacy-support-licensing.md).

The owner additionally requires the **Microsoft Power BI certified badge**. It has not been granted: AppSource listing, local audits, and an offline runtime are not certification. Native evidence, real PBIX assets, public terms and Microsoft approval remain coordinator-owned gates. Certification-ref changes, changes to `main`, PR merges and submission require the coordinator's final release gate.

## Use the visual

1. Obtain an owner-authorized `.pbiviz`, or [build one from this repository](docs/development.md).
2. In Power BI Desktop, open the **Visualizations** pane's **… → Import a visual from a file**, select the package, and accept the import prompt only if your organization permits it.
3. Add Atlyn Pareto to a report page. Bind exactly one **Category** field and one numeric **Contribution** measure. Optionally bind up to five **Tooltip** measures.
4. Start with an additive measure such as `SUM(Defects[DefectCount])`, not a percentage, average, rate, or potentially overlapping distinct count.
5. In **Format visual → Analysis**, choose a threshold from 1–100% (default 80%), a maximum page size from 10–100 (default 30), and the incomplete-data policy. The actual page adapts to tile width. Use Go to rank or Show threshold for dense data; rank position is saved through native formatting metadata.

For offline invented defect, cost, and customer scenarios, see [samples](samples/README.md). `npm run sample` assembles three authored, bound PBIP pages with the exact built visual in `artifacts\sample`. Native Desktop open/refresh/save-as-PBIX remains a manual coordinator gate; no fake PBIX is supplied.

## Understand the result

- **Universe:** the categories delivered by Power BI for the current query, including active filters—not the entire unfiltered model.
- **Validity:** null, missing, nonnumeric, nonfinite, or negative contributions reject the whole analysis with counts. Individual zero contributions remain; a zero total has no defined shares. Blank categories remain as `(Blank)`.
- **Threshold:** the first cumulative crossing is identified; all equal-contribution boundary ties join the contributor set. That set can exceed the threshold. There is no universal “80/20 law.”
- **Completeness:** the visual requests categorical windows of 10,000, using aggregated host segments, up to a 100,000-category safety bound. A remaining segment marker, refused fetch, or bound is explicit. By default, incomplete data withholds shares and threshold conclusions. The opt-in received-subset policy warns that its denominator covers only the received valid subset.
- **Pagination:** all analyzed categories participate in the totals, including off-page ranks. Pages are presentation only; no Top N or synthetic Other grouping is implemented.
- **Interactions:** host selection, Ctrl/Meta and multi-visual selection support, context menus, keyboard navigation, incoming selection, and highlight overlays. Host `allowInteractions: false` disables selection changes and context-menu requests. Highlighting does not rerank the original contributions or change their denominator.
- **Presentation:** a responsive, scrollable chart with an accessible data table, host format strings, high-contrast handling, en-US/fr-FR strings, RTL layout, and no animations.

See the [complete data contract and limitations](docs/data-contract.md) before interpreting a report.

## Development

Validation is **local only**. This repository does not contain or depend on GitHub Actions, hosted CI/CD, cloud coding sessions, or Codespaces. Pushing code and opening a review PR do not replace the local release checks.

Use Node.js **22.13.0 or newer** and the locked dependency graph:

```powershell
npm ci
npm run typecheck
npm run lint
npm test
npm run package
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) ".playwright"
npm exec playwright install chromium
npm run audit:certification
npm run test:browser
npm run audit:licenses
npm run audit:dependencies
```

Developer installation/advisory checks, the first Microsoft-linked workbook fixture, and first sample-schema inspection may access the network. The **packaged visual runtime** does not request privileges or use network calls, telemetry, external services, or a license backend.

`npm run verify` runs typecheck, lint, unit tests, the certification-readiness package build/audits, browser tests, licenses, and dependency advisories in that order. Browser tests therefore load real JavaScript and CSS from the last-built `.pbiviz`, with a **mocked Power BI host**; they are not Desktop/service tests. `audit:certification` runs the official tools' local `--certification-audit`, package inspection, and project static checks—**not Microsoft certification**. See [development and artifact evidence](docs/development.md).

Packaging uses the official tools through a certificate-store-safe wrapper: isolated `.build-home` certificate files, no certificate installation/trust, and no development server. Build-local keys/passwords are excluded from the visual artifact.

For a committed final baseline, `npm run release:verify` collects sequential local checks, assembled-sample inspection, authentic package captures and 20-sample performance distributions. After recorded screenshot inspection, `npm run release:freeze` creates an immutable, byte/hash-inventoried package/source/sample/evidence bundle. See the exact [release procedure and evidence boundaries](docs/development.md#sample-performance-and-immutable-release).

## Release identity

| Item | Value |
| --- | --- |
| Display name | Atlyn Pareto |
| Package version | `1.1.0.0` |
| npm project version | `1.1.0` |
| Stable visual GUID | `atlynPareto18722664651549C392ABF6B1EBA46945` |
| Power BI host API | `5.11` (manifest/plugin/payload: `5.11.0`) |
| Power BI API SDK package | `powerbi-visuals-api@5.11.1` |
| Power BI visual tools | `7.2.1` |
| Formatting model utility | `7.1.0` |
| Formatting utility | `7.0.0` |
| Author | Atlyn (`atlyn.help@gmail.com`) |
| Support URL | `https://www.atlynco.com/docs/faq` |
| Source URL (private) | `https://github.com/AtlynCo/powerbi-pareto-chart` |

## Documentation and release gates

- [Install, interact, export, and manually validate in Power BI](docs/host-validation.md)
- [Submission and release checklist](docs/release-checklist.md)
- [Privacy, support, and licensing boundaries](docs/privacy-support-licensing.md)
- [Third-party notices](THIRD-PARTY-NOTICES.md)
- [Original icon source and reproducible raster assets](assets/README.md)
- [Documentation-derived workflow comparison](docs/competitive-workflow.md)
- [Current Microsoft requirements](docs/certification-requirements.md) and [owner-ready listing dossier](docs/listing-dossier.md)

The coordinator approved the author/contact and URL metadata above and verified the FAQ content. Support responsiveness still requires a manual check; this is not a response-time commitment. The GitHub repository and its issue tracker are private: their URLs are **maintainer-only**, not public AppSource-ready support. Public privacy, licensing, listing content, and any external distribution still require owner approval.
