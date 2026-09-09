# Build and artifact evidence

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

The `.pbiviz` is written to ignored `dist`. Use the filename emitted by inspection; do not infer a release artifact from an old file remaining in that directory. The stable GUID is `atlynPareto18722664651549C392ABF6B1EBA46945` and the visual manifest version is `1.0.0.0`.

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
| `typecheck` / `lint` / `test` | Static checks and existing automated unit tests | Real Power BI host compatibility |
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

- `artifacts\package-report.json`: actual filename, SHA-256, size, archive entries, visual metadata, API, locales, and privileges.
- `artifacts\SHA256SUMS.txt`: package hash and basename.
- `artifacts\dependency-licenses.json`: generated by `audit:licenses`, not by package inspection.

For each authorized release, retain these reports together with command output, source commit/ref, Node/npm versions, lockfile, build OS, browser version, and manual host results in an approved release-evidence location. Inspect the archive that will actually be shared; hashes from earlier builds are not transferable.

No checked-in checksum or passing test result is asserted by these instructions. `dist` and local evidence directories are ignored; do not commit private keys, build-local certificates, caches, or personal Desktop state.

To regenerate the original raster icon without dependencies:

```powershell
node assets\generate-icons.mjs
```

See [assets](../assets/README.md) and the [release checklist](release-checklist.md).
