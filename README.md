# Nova Fox Companion

Nova is a little desktop spirit fox who follows Codex activity, naps between jobs, and occasionally has something to say. She is a standalone Windows companion built on [Codex Avatars](https://github.com/Kajdrak2/Codex-avatars), with original fox artwork and optional OpsWolf integration.

[Lire en français](https://github.com/ThornsOfire/nova-fox-companion/blob/ad1523b20f483d88055e7d6f263fdefeaf24bab9/README.fr.md)

## From a human to a human

**Looking for the code?** Use [the development source](https://github.com/ThornsOfire/nova-fox-companion/tree/feature/nova-desktop-play). This homepage branch carries the project overview.

This is still an early development project. Nova can wander, play with a pretend mouse cursor, float a chat bubble above her head, and react to agent activity. You can keep one resident fox or turn on separate companions for agents. A tiny desktop department is possible; a reliable office manager is still a future ambition.

**There is no published Nova installer yet.** This checkout requires development tools. The `0.7.2` package number comes from the upstream project; it does not mean these Nova features have had a public release. If you want something you can simply download and double-click, we're not there yet.

### Take a look

![Nova, her sun spirit and floating chat controls in a synthetic preview](https://raw.githubusercontent.com/ThornsOfire/nova-fox-companion/ad1523b20f483d88055e7d6f263fdefeaf24bab9/docs/images/nova-chat-preview.png)

*Synthetic renderer preview with sample chat text.*

![Nova napping beside her sun spirit](https://raw.githubusercontent.com/ThornsOfire/nova-fox-companion/ad1523b20f483d88055e7d6f263fdefeaf24bab9/docs/images/nova-sleep-preview.png)

*Sleep preview. These genuine captures show the current artwork and renderer; they do not certify native movement or gaming performance. [Capture details](https://github.com/ThornsOfire/nova-fox-companion/blob/ad1523b20f483d88055e7d6f263fdefeaf24bab9/docs/images/README.md).*

### Trying her out

You'll need Windows 10/11, Git, Node.js 22 or newer with npm, and a terminal for the source setup. Following real agents also requires a compatible Codex installation; OpsWolf is optional. Someone comfortable with development tools can prepare the source using the commands below. The isolated preview is the simplest first look: it uses sample activity and chat rather than connecting to your agents.

Once the normal app is running, click her sun spirit to open chat and controls, or use the Windows notification-area icon to open settings. You can drag her out of the way, mute her, or choose **Hide Nova**. The tray icon brings her back. Her first introduction asks what to call you rather than assuming a name.

In **Codex connection**, select the existing Codex home you want her to follow. Rendering a fox does not require installing hooks. Following live agent events does require the Nova plugin's reviewed lifecycle hooks or an explicitly installed standalone hook integration. Review Codex's trust prompts; installing from source is not permission to silently enable every integration. See the [connection and compatibility notes](https://github.com/ThornsOfire/nova-fox-companion/blob/ad1523b20f483d88055e7d6f263fdefeaf24bab9/docs/nova-fox-companion.md#codex-connection-settings-and-compatibility-validation).

The optional OpsWolf fox button uses a Windows app link. New normal default profiles attempt to register it on first launch when no handler exists; existing profiles have a restore-link control in Nova settings. The OpsWolf button still has an open launch bug, so use the tray or normal app launch rather than relying on it.

### Voice, memory, and privacy

Nova works without an API key. Local spoken quips use your installed system voice; agent status updates stay visual. Mute stops the voice. Natural cloud speech and cloud-generated remarks are optional, use your own API key, and can incur separate API charges. A Codex login does not pay for those requests. Model selection applies to the optional cloud personality; a dedicated native Codex chat acting as Nova's brain is **not implemented yet**.

Settings stay in Nova's own app data, separate from Codex. Her API key and personal chat memory use OS encryption without a plaintext fallback; ordinary settings are not encrypted. Memory retains up to 100 chat entries/remarks and 1,000 characters of notes, with recent context sent when cloud personality is enabled. You can review and clear it in settings. Cloud window vision is a separate, disabled-by-default choice: it can send a bounded image of an eligible window to the provider. Don't enable it unless you want that behavior. Window and cursor geometry otherwise stays local; cursor play never moves your real pointer.

The app also has inherited community-pet browsing and GitHub submission features. It may fetch public catalog metadata; installing pets downloads their assets, and publishing a pet is a separate public action. Those pets have their own license terms. See the [data boundaries](https://github.com/ThornsOfire/nova-fox-companion/blob/ad1523b20f483d88055e7d6f263fdefeaf24bab9/docs/nova-fox-companion.md) and [architecture](https://github.com/ThornsOfire/nova-fox-companion/blob/ad1523b20f483d88055e7d6f263fdefeaf24bab9/docs/architecture.md) before enabling cloud, vision, hooks, startup, or publication features.

### What still needs work

- Nova can briefly glitch ahead while moving in the compact overlay; the cause is not confirmed.
- Chasing the cursor can change her size on a mixed-resolution monitor setup.
- The sun spirit could sit closer to her.
- The optional OpsWolf button can show a warning without launching her. Direct Windows-link launch has worked in a local trial, which does not establish that the button works.

These are [open issues](https://github.com/ThornsOfire/nova-fox-companion/blob/ad1523b20f483d88055e7d6f263fdefeaf24bab9/docs/known-issues.md), not promised fixes. Synthetic screenshots and automated tests do not prove smooth gaming performance, every physical monitor arrangement, or working authenticated cloud voice. Earlier local GPU measurements are encouraging, but visual stability and repeatable game tests are still pending. She's designed to stay out of the way of fullscreen apps, but we still need to try it with more games and monitor setups.

## For agents, from an agent

### Source identity and dependencies

- Implementation branch at this review: `feature/nova-desktop-play`; package `0.7.2`, plugin `0.7.2+codex.20260811191704`. Verify the checkout with `git status --short --branch` and `git rev-parse HEAD`; do not treat this README as a source fingerprint.
- Nova work is [Unreleased](https://github.com/ThornsOfire/nova-fox-companion/blob/ad1523b20f483d88055e7d6f263fdefeaf24bab9/CHANGELOG.md). Local `0.7.2-handoff.*` identities describe development payloads, not public installers, Git tags or acceptance. Source pushes, packaging, publication and activation are separate decisions.
- Electron is pinned to `43.3.0` in [package.json](https://github.com/ThornsOfire/nova-fox-companion/blob/ad1523b20f483d88055e7d6f263fdefeaf24bab9/package.json); [package-lock.json](https://github.com/ThornsOfire/nova-fox-companion/blob/ad1523b20f483d88055e7d6f263fdefeaf24bab9/package-lock.json) resolves `ws` and `adm-zip` alongside the full dependency tree. Use `npm ci` for lockfile installs. Do not infer current audit results from historical counts.
- Original fox assets live in `assets/avatars/nova-spirit-fox`; their frame map is not a native Codex Pet v2 export. Imported community V2 pets use their own manifests, provenance and license terms.

### Commands and side effects

From a fresh source checkout, with dependency downloads approved for the environment:

```powershell
git clone https://github.com/ThornsOfire/nova-fox-companion.git nova-fox-companion
cd nova-fox-companion
git switch feature/nova-desktop-play
npm ci
npm test
npm run preview:nova -- --scene=chat
```

The preview uses synthetic fixture state and its separate preview profile. Other scenes include `sleep`, `peek`, `play`, `escape`, `fullscreen`, `input`, `onboarding`, and `frames`. It does not qualify production native viewport movement.

```powershell
npm start -- --disable-gpu
npm run start:background
powershell -ExecutionPolicy Bypass -File .\install.ps1 -WhatIf
```

- `npm start` runs the actual app from the mutable checkout, normally opening settings. `--disable-gpu` is the local compatibility launch option, not a system graphics setting. `start:background` uses the normal profile and runs without the initial settings window. Neither is an immutable deployment.
- Explicit test profiles use `npm start -- --disable-gpu --profile=work/nova-test`; assign a disposable synthetic `CODEX_HOME` too for integration tests. Profile isolation alone does not block networking. Use the existing guarded fixtures for qualification, never live profiles/keys/chats.
- [install.ps1](https://github.com/ThornsOfire/nova-fox-companion/blob/ad1523b20f483d88055e7d6f263fdefeaf24bab9/install.ps1), when run without `-WhatIf`, can run `npm ci`, set the user-level `NOVA_FOX_COMPANION_DEV_ROOT`, attempt local marketplace/plugin installation via Codex CLI, and start the companion. Switches: `-SkipDependencies`, `-SkipPlugin`, `-NoStart`. Hook trust remains a separate Codex choice. Do not run setup as a harmless test.
- `npm run hooks:status`, `npm run hooks:install`, and `npm run hooks:uninstall` resolve `CODEX_HOME` or the standard fallback; they do not load the app's saved home override. Installation/removal are explicit mutations. Use one reviewed integration route, preserving unrelated hooks and upstream conflicts.
- `npm run preview:settings` captures actual app settings; it is not the isolated renderer fixture. Supply disposable profile/home and appropriate guards for tests. `npm run demo` sends synthetic bridge activity.
- `npm run dist` invokes Electron Builder's local Windows NSIS packaging with `--publish never`; it is not a verified installer or authorization to install. Follow [release preparation](https://github.com/ThornsOfire/nova-fox-companion/blob/ad1523b20f483d88055e7d6f263fdefeaf24bab9/docs/releasing.md).

### Integration and state boundaries

- Resolve one Codex home: saved explicit selection, then `CODEX_HOME`, then `~/.codex`. Nova app data uses Electron `userData`; `--profile=<path>` overrides it. Preserve existing settings, OS-encrypted key/memory and external profiles on activation/rollback.
- Distinct identifiers: `nova-fox-companion-v1` local named pipe, Nova plugin/hook marker/startup names, and `nova-fox-companion://show` restore scheme. Legacy host names such as Cursadex remain in technical interfaces; stock Codex must not depend on that host.
- Lifecycle bridge allows bounded metadata. Local index/rollout enrichment is best-effort for titles, agent paths, model and effort; do not claim rollout layouts or Codex's internal UI are supported contracts. No per-agent tool attribution is invented when hooks lack it.
- Cloud personality/vision default off; voice provider defaults to local. Only quips are spoken. Cloud speech is separately selected and billed; model identifiers and hard-coded local cost estimates require independent provider verification. Never expose keys to renderers or source.
- Fresh default-profile restore registration skips existing handlers, malformed/existing profiles, explicit `--profile` launches and capture/offline fixtures. Packaging alone does not register anything. The optional host button is independent of the standalone tray.
- Main process owns native windows, settings, IPC, hooks and provider access; preload exposes bounded methods; renderer owns actors and logical coordinates. The compact viewport and shared 30 FPS active / 12 FPS idle work clock are implemented, with NOVA-003 unresolved.

### Validation and workflow gates

- Local `.3` qualification recorded 196 Node tests plus offline startup, synthetic geometry/input and scaled tray fixtures. These are historical results, not tests rerun by this README edit. Physical mixed-monitor/hotplug, matched gaming impact, authenticated voice/model/vision and full stock-Codex/optional-host coexistence acceptance remain limited or pending.
- Current open issues: NOVA-001 scaling, NOVA-002 spirit spacing, NOVA-003 movement glitch, NOVA-004 optional host launch. No source correction is claimed here. See [development notes](https://github.com/ThornsOfire/nova-fox-companion/blob/ad1523b20f483d88055e7d6f263fdefeaf24bab9/docs/nova-fox-companion.md), [known issues](https://github.com/ThornsOfire/nova-fox-companion/blob/ad1523b20f483d88055e7d6f263fdefeaf24bab9/docs/known-issues.md), [architecture](https://github.com/ThornsOfire/nova-fox-companion/blob/ad1523b20f483d88055e7d6f263fdefeaf24bab9/docs/architecture.md), [CONTRIBUTING](https://github.com/ThornsOfire/nova-fox-companion/blob/ad1523b20f483d88055e7d6f263fdefeaf24bab9/CONTRIBUTING.md), and [SECURITY](https://github.com/ThornsOfire/nova-fox-companion/blob/ad1523b20f483d88055e7d6f263fdefeaf24bab9/SECURITY.md).
- Follow [AGENTS.md](https://github.com/ThornsOfire/nova-fox-companion/blob/ad1523b20f483d88055e7d6f263fdefeaf24bab9/AGENTS.md) and [release preparation](https://github.com/ThornsOfire/nova-fox-companion/blob/ad1523b20f483d88055e7d6f263fdefeaf24bab9/docs/releasing.md). Preserve unrelated work; stage only explicit task files. Handoffs need exact source identity, immutable hashes, runtime/dependency evidence and profile-preserving rollback. Keep live data and local bundles out of source. Never rewrite a sealed build or stop the owner's running app to validate docs.
- No automatic downloads/upgrades, hook installation, URI changes, cloud enablement, activation, restart, commit/push/tag or publication as a documentation side effect. Separate optional host components from standalone application handoffs.

### Credits and license

[MIT](https://github.com/ThornsOfire/nova-fox-companion/blob/ad1523b20f483d88055e7d6f263fdefeaf24bab9/LICENSE), retaining Codex Avatars contributors' copyright and upstream attribution. Nova's character is original; Mochi's described behavior was inspiration, with no Mochi source or artwork copied. Community catalogs ([Codex Avatars catalog](https://github.com/Kajdrak2/awesome-codex-pet), [Awesome Codex Pet](https://github.com/legeling/awesome-codex-pet)) and downloaded assets retain their own authorship and terms.
