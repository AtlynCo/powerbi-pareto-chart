# Privacy, support, and licensing boundaries

## Technical runtime facts

Atlyn Pareto analyzes categorical data supplied by the Power BI host. The packaged runtime is designed to operate offline:

- No requested capabilities privileges.
- No external JavaScript, remote service calls, or embedded remote resources.
- No runtime telemetry, authentication service, license backend, or application-managed browser storage.
- Selection, tooltips, context menus, and additional data windows use Power BI host APIs.
- No custom export/download service.

The host, semantic model, organizational environment, and Power BI service have their own processing and network behavior. These statements concern the visual's code, not every component in a Power BI deployment. Build tooling, package registries, browser installation, advisory checks, and optional publishing are separate from the visual runtime.

This document is a **technical description for owner review**, not an approved public privacy policy, data processing agreement, retention commitment, service-level promise, or jurisdiction-specific legal advice.

## Support

The repository at `https://github.com/AtlynCo/powerbi-pareto-chart` is **private**. Repository issues are a maintainer-only workflow for authorized collaborators, not a public support channel accessible to all potential users.

The coordinator approved the package metadata: author **Atlyn**, contact **`atlyn.help@gmail.com`**, support URL **`https://www.atlynco.com/docs/faq`**, and the private GitHub URL above. The coordinator also verified the FAQ content. This records metadata approval and content review, not Microsoft/AppSource acceptance or broader legal approval.

Support responsiveness remains a manual release check: confirm that the published contact route is monitored and can handle product questions. Recheck public unauthenticated FAQ access when preparing the release. No response-time or availability commitment is made here.

When reporting an authorized internal issue, include package version/hash, host version, binding/format settings, completeness state, reproduction steps, and sanitized invented data. Do not post customer data, credentials, tenant identifiers, or proprietary models. Agree with the owner on a suitable private channel before sharing sensitive diagnostic material.

## Licensing and distribution

### Approved commercial operation

On 2026-09-10, the owner approved **existing Atlyn storefront subscriptions with ungated visuals and free shared viewing**. Subscription acquisition is external to the visual. Recipients can view shared reports without an additional visual subscription purchase or an in-visual license check. This does not remove Power BI's own licensing, access controls or tenant policies.

The visual intentionally does not distinguish paid authors from other users. Do not add license keys, a signer, AAD/sign-in integration, entitlement APIs, feature gates, runtime requests or `WebAccess` for licensing. The existing offline renderer already matches the approved architecture; runtime licensing is not an outstanding implementation dependency.

### Preserved first-party status

This is a private repository. The first-party identifier in `package.json` remains **`UNLICENSED`**, and there is **no root first-party `LICENSE` file**. That metadata is not an open-source license and does not itself grant permission to use, copy, redistribute, sublicense, sell, or publish Atlyn Pareto. No relicensing or replacement legal terms are introduced by this business-model clarification.

The approved acquisition/viewing model is not a price list, trial policy, EULA, redistribution license or promise of paid-author identity enforcement. Storefront/customer terms and public legal materials remain owner-managed. Free shared viewing does not mean free acquisition, open-source rights or unrestricted redistribution.

Third-party components keep their own licenses. [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md) retains those notices and identifies the declared runtime dependency set; it does **not** relicense the product as MIT. The original icon and invented sample sources are project assets, not a separate public asset license.

## Remaining owner approvals and operational checks

- Manual confirmation of support responsiveness and an operational product support process; recheck public FAQ access for the release.
- Public privacy notice accurately reflecting the approved release.
- Appropriate product licensing terms/EULA and distribution authorization.
- Attribution and redistribution review of the actual packaged dependency graph.
- Listing claims, branding, screenshots, accessibility claims, and export/support scope.
- Actual Microsoft approval for the additionally required Power BI certified badge; do not display or claim it in advance.

Do not treat local packaging, a permissive dependency-license inventory, or a static certification-readiness check as approval of any of these items.
