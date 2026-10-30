# Releasing Nova Fox Companion

## Current status

No GitHub release or downloadable Nova installer has been published. The package's 0.7.2 identity is inherited from Codex Avatars; Nova-specific work remains Unreleased. Local versions such as 0.7.2-handoff.3 identify reviewed development bundles, not public releases. The known movement/scaling issues in [known issues](known-issues.md) remain release-review concerns.

A source commit/push, a local runnable handoff, a release tag, an installer and owner activation are separate decisions. Documentation or branch pushes do not authorize a release, registration or live-profile migration.

## Review before publication

- Confirm the intended repository, source branch/commit and scope. Preserve upstream license, authorship and third-party asset terms.
- Review README claims, known issues, changelog, screenshot provenance and verification limits against that exact source. Do not describe local fixture success as physical monitor, gaming or authenticated voice acceptance.
- Deliberately choose the release version and reconcile package.json, package-lock.json and plugins/nova-fox-companion/.codex-plugin/plugin.json. Do not reuse an upstream tag or infer a release number from a local handoff suffix.
- Review dependencies and installer behavior. Prior audit counts are historical; perform the applicable current checks rather than asserting they remain clean.
- Keep profiles, settings, encrypted keys/memory, chats, logs and personal captures out of source archives and packages. Use synthetic data and temporary CODEX_HOME/profile directories for verification.
- Review signing and update behavior before broad Windows distribution. Never commit certificates or passwords. Do not present an unsigned local preview as a signed installer.

## Local verification

Use the locked dependencies and installed toolchain; obtain approval before any new dependency/tool download in a managed workspace. Relevant commands, when authorized, include:

```powershell
npm ci
npm test
npm audit --omit=dev
npm run preview:nova -- --scene=chat
powershell -ExecutionPolicy Bypass -File .\install.ps1 -WhatIf
npm run dist
```

The preview must use the fixture's synthetic content. Native/app qualification uses explicit disposable profiles and a synthetic CODEX_HOME, remote-call/registration guards, known-owned process cleanup and bounded timeouts. Test hook changes only against disposable homes; never target the maintainer's real hook configuration as a fixture. Packaging alone must not opt users into hooks, URI handlers or cloud calls.

Inspect the actual unpacked executable and resources/integration layout. Test the final installer/contained launcher separately from the mutable source checkout. Preserve a prior working app; check profile occupancy, settings preservation and rollback. Record what is not tested.

## Immutable handoffs

An application handoff records product/version, exact Git source or explicit snapshot, SHA-256 and byte counts for every artifact, runtime/dependency identities, checks/evidence, included/excluded work, settings policy, launch instructions, rollback and remaining limits. Source-only or integrate-only components are not runnable deployments. A workspace may provide the common handoff schema/checker; public clones must not require a maintainer's folder layout or live state.

Keep bundles under ignored artifacts/handoffs, outside user profiles. Seal once; changed bytes need a new build identity. Validate again before owner selection. Integrity proves byte identity, not safety or complete runtime correctness. Record activation/acceptance separately from immutable manifests.

## GitHub release workflow

The inherited .github/workflows/release.yml listens for v* tag pushes and manual dispatch and has release-write permissions. It runs tests, builds the NSIS installer, packages a Git source/plugin archive, generates checksums and publishes release assets. Treat triggering it as publication, not a harmless build check. No tag/push/dispatch is part of this docs pass.

Only after explicit approval: tag the exact reviewed source with the chosen new version, verify the tag target and intended remote, and follow the reviewed release workflow. Confirm the resulting checksums/assets, update endpoint, signing status and fresh-machine behavior before recommending a download. A source push alone must not be described as an installer release.

The marketplace/plugin directory remains .agents/plugins/marketplace.json and plugins/nova-fox-companion. A plugin iframe cannot render an operating-system overlay; the local companion requirement and hook trust prompts must remain explicit. Existing user integration and encrypted profiles require their own reviewed migration policy, never an implicit packaging side effect.
