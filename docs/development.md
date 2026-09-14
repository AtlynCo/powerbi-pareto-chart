# Build and artifact evidence

## Local-only validation policy

Run all commands below on an authorized local machine. GitHub Actions and other hosted CI/CD are disabled and no workflow is shipped. GitHub is used for source control and review only. Retain local command output, screenshots and measurements with the exact package; no hosted status badge is release evidence.

The approved commercial model uses external Atlyn storefront subscriptions with an ungated runtime and free shared viewing. It requires no runtime licensing work, new keys/signer/AAD/API integration, feature gates or `WebAccess`. Documentation of this decision alone does not require repackaging or a version bump. Preserve sealed artifacts and their historical evidence; keep current business decisions in live documentation. Native assets, the required Microsoft Power BI certified badge and the coordinator's final release gate remain separate.

## Prerequisites

- Owner-authorized access to this private repository.
- Node.js **22.13.0+**. The visual tools support Node 20.19+, but this repository's tests require the newer project baseline.
- npm and the checked-in `package-lock.json`.
- On Windows, PowerShell 7 (`pwsh`) for the build certificate helper. On other supported build environments, the build wrapper uses `openssl`.
- For browser tests, the Chromium revision matching the locked Playwright package.
- For manual import, a current Windows Power BI Desktop installation and tenant policy permitting private custom visuals.

Do not globally install `pbiviz`; use the locked local tools. Do not change dependency versions during a release just to obtain a passing check.

The visual includes an offline third-party notices panel. After deliberate dependency changes, run `node scripts\generate-notices.mjs` and review the generated `src\third-party-notices.json`; the package build checks it against installed license texts. Package inspection checks that permission text and the vendored Globalize attribution survive bundling.

The lockfile includes dependency overrides for `qs` **6.16.0** and `sockjs`'s `uuid` **11.1.1** to address development-tooling advisories. The coordinator inspected the latter's CommonJS `require` / v4 API compatibility. Preserve the locked graph and rerun the advisory audit for the release: an override or a previously clean advisory result is not proof of continued security or runtime/host compatibility.

```powershell
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run package
```

`build` invokes the official packager through `scripts\build.mjs`. `package` builds again and inspects the actual output archive. The wrapper uses the locally installed official `pbiviz package --all-locales --no-stats` command; it does not start a development server.

### Packaging without certificate-store changes

Power BI visual tools resolve development certificates even during package-only builds. The coordinator-approved wrapper provisions disposable file-only material so that packaging does **not** install or trust a certificate in the user or machine certificate store:

- It redirects child-process `USERPROFILE`, `HOME`, `APPDATA`, and `LOCALAPPDATA` into the checkout's `.build-home`, rather than the developer's real profile.
- On Windows, `scripts\build-certificate.ps1` uses .NET to create an untrusted, self-signed localhost certificate and write a password-protected PFX under `.build-home\pbiviz-certs`. The password is generated locally and stored only in that build directory.
- On Linux, the supported `openssl` path writes a local certificate/private-key pair in the same isolated directory. It does not install them into a trust store.
- Neither path starts a server, requires trusting localhost, or installs a certificate into a certificate store. Do not substitute a certificate-install/trust command for this package-only workflow.
- `.build-home` is ignored and excluded from the release artifact. Do not distribute its PFX, private key, password, or profile files.

This makes the packaging workflow certificate-store-safe; it does not make the resulting visual trusted, code-signed, Microsoft-certified, or approved for distribution. The localhost material satisfies tooling initialization only.

### Offline locale packaging

The official tools' locale-loader path can fail with `Unexpected token export` when used with the 7.x formatting utilities. The coordinator confirmed that the supported `pbiviz package --all-locales --no-stats` invocation resolves this packaging failure. Keep `--all-locales` in the wrapper; this workaround does not edit or downgrade dependencies.

All available project locales—**en-US and fr-FR**—are bundled in the visual for offline use, without fetching translations at runtime. “All locales” means all locale resources supplied by this project, not translations for every Power BI language. Confirm both locale payloads in the inspected archive.

The `.pbiviz` is written to ignored `dist`. Inspection selects the current GUID/version filename, never an arbitrary old file in that directory. The stable GUID is `atlynPareto18722664651549C392ABF6B1EBA46945` and the visual manifest version is `1.1.1.0`.

The **SDK dependency** is `powerbi-visuals-api@5.11.1`; its exposed **host API** is 5.11, normalized as `5.11.0` in `pbiviz.json`, the generated plugin, and packaged payload. These version numbers serve different purposes. Keep the SDK package pinned at `5.11.1` while checking the artifact's API field against `5.11.0`; normalization is not a dependency downgrade.

## Browser checks

Install the browser locally to this checkout:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) ".playwright"
npm exec playwright install chromium
npm run audit:certification
npm run test:browser
```

`npm run test:browser` invokes `scripts\browser-tests.mjs`, which launches Playwright and sets `PLAYWRIGHT_BROWSERS_PATH` to this checkout's `.playwright` directory. Installing the browser can require network access and disk space; it does not add a runtime network dependency to the visual.

One browser fixture uses the workbook linked by Microsoft's visual-testing guidance. Its first run downloads and SHA-256-checks that workbook into ignored `artifacts\microsoft-sample`; subsequent runs use the checked cache. Parsing reads cell values without executing workbook formulas/macros. The shipped visual makes no request. The release retains the source URL, workbook hash and expected-value results, **not the third-party workbook**, because dataset-specific redistribution permission has not been established.

These tests execute real JavaScript and CSS extracted from the built `.pbiviz`, with a **mocked Power BI host**. They are stronger evidence than testing a separate demo renderer, but do not validate Desktop/service integration, tenant policies, actual host segmentation, export, assistive technology, or Microsoft acceptance. Record the artifact hash alongside the browser result. Rebuild/retest after changing packaged source, capabilities, strings, styles, or icons.

## Audits and combined verification

```powershell
npm run audit:certification
npm run test:browser
npm run audit:licenses
npm run audit:dependencies
npm run verify
```

| Command | What it is for | What it does not establish |
| --- | --- | --- |
| `typecheck` / `lint` / `test` | Runtime and test/evidence-harness types, runtime lint, unit/sample tests and independent BigInt binary64/prefix and integer-threshold oracles | Real Power BI host compatibility |
| `package` | Build and archive/metadata inspection | Distribution authorization |
| `test:browser` | Packaged runtime tests against a mock host | Real Desktop/service acceptance |
| `audit:certification` | Official `pbiviz package --certification-audit` through the safe wrapper, then archive inspection and project static checks | **Microsoft certification**, submission approval, or a complete security review |
| `audit:licenses` | Installed dependency license inventory and an allowlist check | Legal approval or complete redistribution-notice compliance |
| `audit:dependencies` | npm advisory audit at moderate severity and above | Absence of all vulnerabilities; this check depends on current registry/advisory access |
| `verify` | Typecheck → lint → unit tests → certification-readiness build/audits → packaged browser tests → licenses → dependency advisories | Replacement for the manual release gates |

`audit:certification` **rebuilds the package**, passing `--certification-audit` through `scripts\build.mjs` alongside `--all-locales --no-stats`. It then runs `scripts\inspect-package.mjs` and `scripts\certification-audit.mjs`. The official audit is a local tooling check; no Microsoft submission or approval occurs.

Run browser tests **after** that command. `verify` deliberately uses this order so the browser tests exercise the exact last-built artifact whose metadata and SHA-256 were inspected. Rebuilding after browser tests creates a new artifact requiring another inspection/browser run.

Network requests made by npm installation/advisory lookup or browser provisioning belong to the developer environment. The shipped visual is offline and has no requested capabilities privileges, remote scripts, runtime telemetry, or licensing service.

## Record the artifact, not just the commit

The inspector writes ignored local evidence:

- `artifacts\package-report.json`: actual filename, SHA-256, size, archive entries, visual metadata, API, locales, privileges, source commit/dirty state, build-input fingerprints, payload/asset hashes and tool versions.
- `artifacts\build-report.json`: exact official packager arguments, completion time, matching package hash, and certificate-handling boundary.
- `artifacts\SHA256SUMS.txt`: package hash and basename.
- `artifacts\dependency-licenses.json`: generated by `audit:licenses`, not by package inspection.

For each authorized release, retain these reports together with command output, source commit/ref, Node/npm versions, lockfile, build OS, browser version, and manual host results in an approved release-evidence location. Inspect the archive that will actually be shared; hashes from earlier builds are not transferable.

No checked-in checksum or passing test result is asserted by these instructions. `dist` and local evidence directories are ignored; do not commit private keys, build-local certificates, caches, or personal Desktop state.

To regenerate the original raster icon without dependencies:

```powershell
node assets\generate-icons.mjs
```

See [assets](../assets/README.md) and the [release checklist](release-checklist.md).

## Sample, performance and immutable release

```powershell
npm run sample
npm run evidence:quality -- --label final --samples 20 --warmups 3
```

`sample` validates the source layout before assembly, copies all three authored pages and exact package resources into `artifacts\sample`, then checks required entry points, resource bytes, model/role bindings, formatting literals, page bounds and public JSON schemas. The separately named constants in `scripts\sample-versions.mjs` enforce artifact version **4.0** in `definition.pbir` and report-definition version **2.0.0** in `definition\version.json`; generation and inspection record/check both. A schema-valid definition value of 4.0.0 can still prevent native pages from loading and is rejected.

The first schema inspection downloads public Microsoft schemas into `artifacts\schemas`; cached schema hashes are recorded. `npm run sample:tom` additionally uses already installed Desktop TOM assemblies to deserialize this sample's TMSL `model.bim`, without launching Desktop or installing anything. See [native-preflight safeguards](../samples/README.md#native-preflight-safeguards) for separately identified retry folders. Neither schema nor TOM parsing establishes native open/refresh/render behavior or replaces the required PBIX.

Quality evidence loads the actual archive in local Chromium with network requests blocked. It captures the five required viewport sizes plus dense/long labels, multiple instances, RTL/high contrast, scrolling, loading/empty/invalid/zero/subset/highlight and interaction states. Three unchanged 1366x768 listing candidates come from invented defect/cost/customer scenarios. The report distinguishes synthetic pointer-event coverage from the separate Playwright touchscreen regression.

Benchmarks use deterministic 1,000 and 100,000-row fixtures and report per-operation raw samples, p50/p95/max, seeds, expected totals, machine/browser versions and timing boundaries. Create includes mock setup, construction and synchronous update; updates/resizes time the synchronous call, not completed paint or native host overhead. The next-animation-frame metric is separate. Do not run our own builds/tests concurrently with measurements; shared-machine contention may still affect outliers. `--label baseline` accepts the separately retained original package at `artifacts\quality\baseline\baseline.pbiviz`; it is not reconstructed or downloaded implicitly.

For the final handoff, commit the source first, then run:

```powershell
npm run release:verify
# Inspect actual generated PNGs and record the review described below.
npm run release:freeze
```

`release:verify` requires clean committed source. It runs `verify`, `sample`, an optional available historical baseline, and final captures/benchmarks sequentially, retaining stdout/stderr and exit status in `artifacts\validation`. Any failure stops the sequence. It never runs hosted CI, creates a server or submits anything.

After visually inspecting the exact final images, create ignored `artifacts\visual-review.json` with `packageSha256`, a truthful `reviewer`/observations, and `reviewedScreenshots` entries containing `file` and `sha256`. Record the requested sizes and meaningful special states, not merely five copies of one layout. Inspection-driven improvements in this revision include measured grapheme-safe labels, wider bands for long names, visible cumulative/threshold halos, a non-overlaid threshold legend and horizontally readable category-table cells. Labels can still be shortened in small tiles; full identifiers remain in the table, accessible names and native tooltips.

`release:freeze` cross-checks the clean source, build/package/sample/quality/validation reports, reviewed image hashes, measured sample counts and listing dimensions/bytes. It writes a new immutable `artifacts\releases\<version>-<hash-prefix>` directory and refuses to overwrite it. The handoff includes the package, authored assembled sample, source ZIP, notices/icons/docs, schemas, reports, genuine captures, logs and a file-byte/hash inventory plus `SHA256SUMS.txt`. It excludes dependencies/browser caches, build-local credentials and the raw third-party workbook. Copy this entire directory into an approved durable location; a source commit alone does not preserve the artifact. Native-host results and publisher approvals must be appended as separately identified evidence, never inferred from this local bundle.
