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

This is a private repository. The root npm metadata is `UNLICENSED`. That label is **not** an open-source license and does not grant permission to use, copy, redistribute, sublicense, sell, or publish Atlyn Pareto.

No product price, trial, commercial entitlement, license enforcement promise, or public EULA is defined by this source. Owner-approved licensing/distribution terms are a prerequisite to external release. The absence of a license backend does not grant usage or redistribution rights.

Third-party components keep their own licenses. [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md) retains those notices and identifies the declared runtime dependency set; it does **not** relicense the product as MIT. The original icon and invented sample sources are project assets, not a separate public asset license.

## Remaining owner approvals and operational checks

- Manual confirmation of support responsiveness and an operational product support process; recheck public FAQ access for the release.
- Public privacy notice accurately reflecting the approved release.
- Appropriate product licensing terms/EULA and distribution authorization.
- Attribution and redistribution review of the actual packaged dependency graph.
- Listing claims, branding, screenshots, accessibility claims, and export/support scope.

Do not treat local packaging, a permissive dependency-license inventory, or a static certification-readiness check as approval of any of these items.
