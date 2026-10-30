# Nova Fox Companion: development notes

This fork builds an original companion personality on the MIT-licensed Codex Avatars foundation. Mochi's publicly described behavior is inspiration only; no Mochi source or artwork has been copied.

## Current local status — 2026-10-29, Pacific

Nova-specific work is unreleased. The local standalone handoff `nova-fox-companion-0.7.2-handoff.3-s41478a3490b8` was validated (334 inventoried artifacts) and launched at the owner's request with the existing external profile. Its immutable payload includes the compact overlay, shared animation clock, running-pose correction, scaled tray menu and fresh-profile restore defaults. No public Nova installer or release is established by this handoff. Local `artifacts/` and `work/` evidence is ignored and is not included in a public clone.

The `.3` bundle passed 196 Node tests, bundled offline startup/clean exit, native synthetic input/geometry checks and tray checks at 100%/225%. Desktop measurements compared identical runtimes and synthetic state; these are separate from owner acceptance. The owner subsequently reported a brief movement glitch, [NOVA-003](known-issues.md#nova-003--brief-forward-jump-while-travelling-with-the-compact-overlay). Its mechanism is unconfirmed, no correction is staged, and `.3` must not be described as visually accepted. [Chase scaling and spirit spacing](known-issues.md) remain open too.

Earlier owner trials confirmed drag/control behavior and borderless-fullscreen avoidance on a prior build; they do not qualify every `.3` path. Physical cross-monitor travel/drag, monitor hotplug, repeatable game/GPU impact and authenticated cloud voice/model/vision checks remain pending for `.3`. Existing local `.2` bytes remain available for profile-preserving rollback after a normal quit. No live profile reset, public release, or publication is part of this documentation audit.

The owner enabled the restore link manually after `.3` launch. A live cold-start test from the Cursadex fox button has not been confirmed. Fresh normal default-profile startup registers the link when no handler exists; existing profiles and explicit test-profile launches retain the manual control. The optional Cursadex button's fresh-preference default is separate host integration, not a stock Codex requirement. The native Codex chat-brain connection remains planned.

Sections below retain implementation history and earlier validation checkpoints. Their test counts and pending checks describe those checkpoints; this status section records the latest local qualification and limitations.

## Available in this checkout

- Brief visual notices for agent state changes. “Turn finished” and “Agent stopped” describe lifecycle events, not a claim that a task succeeded.
- Original local quips with a shared 20-second cooldown. Input requests and terminal notices bypass the visual cooldown; they do not automatically produce a quip.
- Local speech uses Electron's Web Speech API; optional cloud speech is described below. Only the separate quip field is spoken. Status notices are never read aloud.
- Mute on each pet in interactive mode, in settings, and in the tray menu. The tray remains usable in passive mode. Mute cancels speech immediately; missed quips are not queued or replayed.
- Windows tray right-click controls scale using the monitor under the pointer, independently of the overlay's coordinate scaling. The menu stays within that monitor's work area, scrolls on small displays, supports arrow keys/Home/End, Enter/Space, and Escape, and closes on loss of focus. Other platforms retain their native tray menu. This is included in local `.2` and `.3` handoffs; older sealed builds remain unchanged.
- Settings persist the mute and remarks preferences. The cloud features below are optional and disabled by default.

The speech engine and installed voices vary by system and require a live Windows check. Automated tests verify the voice-routing and cancellation contract using a fake engine; they do not verify audible output.

## Development

Run `npm ci` then `npm test`. For an isolated preview, use `npm start -- --disable-gpu --profile=work/nova-preview --capture-settings=artifacts/nova-settings.png`. This gives the preview a separate settings directory and named pipe. Do not run the setup or hook installer until ready to enable live integration.

## Slice two: optional cloud personality and memory

- OpenAI Responses API, with GPT-6 Luna, GPT-6.1 Terra, and GPT-6.1 Sol selection; dry, playful, encouraging, and gremlin personalities.
- Strict structured reactions, 12-second timeouts, one request at a time, and rejection of replies made stale by agent or settings changes. The model can choose silence.
- Configurable spontaneous-remark cooldown and durable daily request/budget guards. Previews and failed attempts count. Direct chat bypasses the spontaneous cooldown but still obeys concurrency and daily limits. Counters reset at midnight Pacific time.
- Keys and companion memory use OS encryption via Electron safeStorage, with no plaintext fallback. Keys never return to the renderer. Memory contains the last 100 chat entries/remarks and 1000 characters of personal notes. The latest eight entries and notes accompany requests. Direct chat is capped at 500 characters. Review and clear memory in settings.
- Ordinary requests contain state cues, personality, language, and explicit companion memory/direct chat only. They do not read other agents' transcript files, labels, ids, paths, source, or tool outputs. Optional window vision is described below. Requests use `store: false`.
- Pickup tilt, drop bounce, and optional relocation remarks, respecting mute, cooldown, and reduced motion.

### Budget guard

The [local model-cost table](../src/core/companion-brain.cjs) hard-codes input/output estimates in dollars per million tokens: Luna 0.10/0.50, Terra 1/5, Sol 2/10. These are implementation constants, not a verified current provider-pricing quote. This docs audit did not perform a fresh pricing check. The guard estimates a reservation using a 30,000-byte input allowance plus 256 output tokens, rounded upward to $0.001. It is not actual billing or a provider-side spending cap; bytes are not a measured token count, and the constants may become stale. Review provider pricing and account limits independently before enabling cloud use.

Implementation references: [provider models](https://developers.openai.com/api/docs/models) and [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Links are provided for independent review, not as evidence of a fresh price check.

### Validation boundaries

At the slice-two checkpoint, provider tests used fakes and no real model request was made. Authenticated provider acceptance remains pending; enter a key only in the app, enable cloud remarks, and use Preview to verify account access. Never put keys in chat or source. Earlier audible local speech and desktop trials do not validate cloud voice. GPU acceleration failed in the restricted preview environment at that checkpoint; the isolated settings preview succeeded with `--disable-gpu`. Use `--settings-scroll=800` to inspect memory controls.

## Slice three: spirit controls and desktop play

- One resident Nova now follows all agents by default, remaining visible and napping when there is no active work. The settings retain an optional per-agent mode.
- A small ember-wisp floats above Nova. It is clickable even in passive mode. Clicking opens a floating bubble with a two-line scrollable history, direct chat input, full Nova chat, settings, and mute. Each history entry opens its source: a known Codex session or the full Nova conversation. Escape closes the bubble. Chat activates keyboard focus only after an explicit click.
- Direct conversations synchronize between the floating bubble and full chat. Clearing companion memory also clears the floating history. Status history is transient; companion conversation memory follows the slice-two policy.
- A hidden PowerShell helper reads visible window rectangles and bounded local process names for exclusions, excluding Nova's process, minimized/cloaked windows, wallpaper, taskbars, and tool windows. It does not read window titles or contents. Coordinates are converted from physical pixels to Electron DIP units for mixed-DPI displays. The helper is read-only, stops with the app, and retries after failure. Its execution-policy setting is process-scoped; no system policy is changed.
- Fullscreen/borderless windows exclude the affected display from roaming. The whole overlay, including bubbles, is clipped to the remaining allowed zones. Nova hides if all zones are occupied. Missing or stale geometry hides Nova while fullscreen protection is enabled, rather than assuming a display is safe. The setting can be disabled explicitly.
- Idle cursor behavior starts after six seconds: stalk, pounce, and bat at a visual cursor decoy. The app never moves the real cursor or injects input. Cursor movement cancels stalking, peeking, and pouncing immediately.
- Nova peeks at the right edge of a suitable floating window using sprite clipping; she does not alter the window's actual z-order. Geometry is never sent to the model. Late play remarks are discarded when the activity is over.
- Three pickups within twelve seconds trigger one 3.5-second escape on the current allowed display. The user can still grab Nova during the escape. Motion play, decorative floating, and glow animations respect reduced motion.
- The original fox image is now rendered from a validated bundled PNG frame map, without modifying or stretching the source artwork into an inaccurate native grid. Idle, running, waving, carried, waiting, working, reviewing, and napping sequences are mapped. The chest ember has a gentle CSS glow. This bundled format is not a native Codex Pet export; native gallery exports remain restricted.
- During travel, running frames take priority over status/reaction poses, including on vertical routes. Seated, grooming, and waving poses resume when stationary; dragging uses the carried pose. This correction is included in local `.2` and `.3` handoffs, without modifying earlier sealed builds.

### Validation

`npm test` covers geometry subtraction, fullscreen versus maximized work-area windows, negative display origins, idle-cursor cancellation, bounded escape, reduced motion, sensor metadata filtering, and atlas bounds. `npm run preview:nova -- --scene=chat` runs an isolated Electron renderer fixture with synthetic state, no hooks, no provider calls, and no real cursor changes. Other scenes: `sleep`, `peek`, `play`, `escape`, `fullscreen`. The chat scene verifies round-trip typing, scrollable history, and memory clearing. The play scene verifies that a real-cursor movement sample removes the decoy.

At the slice-three checkpoint, the read-only native sensor had been smoke-tested on Windows. Preview assertions used synthetic windows; physical fullscreen/multi-monitor, speech and authenticated cloud checks were then pending. No Codex restart or hook installation was performed by that fixture run. Subsequent owner observations and the remaining `.3` checks are recorded in the current status above.

### Optional window vision

Cloud window vision is separately opt-in and disabled by default. When enabled alongside cloud remarks, a peek can capture the particular window Nova is peeking behind. The explicit preview button uses the most recently focused external app. Direct chat and ordinary agent updates never capture images.

Before capture the app requires fresh geometry, a known window handle/process, and no matching process exclusion; fullscreen windows are skipped. Default exclusions include password managers, Codex, ChatGPT, Electron, and Nova. The capture helper rechecks process identity to guard against a recycled window handle. It renders just that window with PrintWindow, bounds the native allocation, resizes to a maximum 512-pixel edge, and sends the PNG through a pipe rather than writing it to disk. Unsupported, uniform/blank, timed-out, changed, or excluded windows are skipped. Some GPU-rendered windows may not support this capture method.

The image is sent to OpenAI only as part of that opted-in peek, with `store: false`, and is not kept in local companion memory. App names, handles, paths, and geometry are not added to model context. The prompt treats text inside screenshots as untrusted and forbids following instructions in it. The local budget guard reserves an additional conservative 32,768 image-input-token allowance for vision requests. Provider billing/retention rules still apply independently.

Capture code has been compiled in validation-only mode without taking a screenshot. Tests use synthetic PNG data; no real window image has been captured or uploaded during development.

## Character direction

Nova is an original charcoal spirit fox: soft smoky silhouette, expressive ears, teal eyes, teal accents on a comet tail, and an orange/amber chest ember. The napping pose curls Nova into the tail with closed eyes and sleepy ear changes. The bundled frame map preserves the existing drawing; further hand-tuned frames can improve animation continuity.

- Optional future improvements: preview captures locally before transmission and support additional capture backends for protected/GPU windows.
- Further art polish: smoother transitions, more directional poses, and manually refined expressions.

## Future ideas — explicitly deferred

Windows Bubbles and Pipes screensaver cameos. Do not change or integrate with the user's screensaver yet.

### Pet Office Work Mode

Idea recorded on 2026-10-30, Pacific time; not implemented. An optional little desktop office gives each agent a pet and desk: working agents type or study plans, agents needing input wave the user down, and actual agent-to-agent communication sends one pet walking over to the other's desk for a tiny meeting. Clicking a desk could open that agent's chat; finished agents celebrate or nap, while Nova roams as office manager. Drive interactions from real supported agent events rather than inventing collaboration. Keep this a future alternative to free roaming, with the existing attention, mute, reduced-motion and fullscreen preferences respected.

### Optional OpsWolf feedback attention hook

Requested on 2026-10-30, Pacific time; roadmap only, not implemented. When an agent explicitly requests user feedback or a decision, an optional OpsWolf integration should make Nova visibly excited and insistent to get the user's attention. Ordinary status updates should not trigger this behavior. Keep stock Codex support independent of OpsWolf/Cursadex.

Owner-selected Zelda reference for the attention line: “Hey, listen! {agent name} needs your input!” Use the requesting agent's display name. The line can appear visually; any spoken version must respect the user's voice choice and mute setting, with repetition limited to avoid nagging. This is proposed character dialogue, not a request to imitate a game's recorded voice or use its audio assets.

Before implementation, define a supported event carrying only the minimum request identity/state, deduplicate repeated notifications, and clear the attention state when the request is answered or dismissed. Respect reduced motion, mute, Hide and fullscreen avoidance; do not steal keyboard focus or turn every status update into speech. Exact animation, repetition limits and any optional spoken remark remain design choices for that future work. No hook installation or feature enablement is authorized by recording this idea.

The app, repository folder, plugin, hook marker, pipe, environment variables, startup registration, and renderer bridge use Nova Fox Companion identifiers. Upstream credits and catalog provenance remain intact. Update prompts remain disabled until the fork’s release pipeline is verified.

### First meeting

On a fresh profile, Nova introduces herself before asking what to call you. Reply through the floating chat without an API key or model connection. Your preferred name is saved with OS-encrypted conversation memory and included in future model context. Change it in settings; clearing memory resets it and repeats the introduction. No name is inferred from the Windows account or bundled as a default.

### Codex compatibility contract

Nova remains independent of Cursadex and must support stock Codex without a custom launcher, plugin, editor, or folder layout. Cursadex-specific hooks may be added later as optional integrations for concrete use cases.

“Universal” means compatible with different installations, not automatically modifying every profile. Resolve the selected Codex home explicitly, otherwise use CODEX_HOME, otherwise the standard ~/.codex fallback. A separately launched Nova needs a picker for an existing home. Settings, keys, and personal memory remain in Nova’s own app data.

Hook installation and removal must preserve unrelated handlers. Detect and report collisions with the original Codex Avatars bridge before changing its integration. Never depend on Cursadex UI internals. Codex being absent, closed, or restarting must leave Nova usable without automatic relaunch loops.

Current audit: CODEX_HOME and the standard fallback already work; personal data is separate; hook merging preserves unrelated command handlers and creates backups. Nova now owns a distinct hook marker and named pipe, so new installs do not replace or remove upstream hooks. Old installed plugin registrations are not automatically migrated; disable the old companion integration and explicitly install Nova's new plugin when upgrading. A Codex-home picker and integration diagnostics are now implemented (see below). Stock Codex and Cursadex coexistence have not been verified live. The native Codex chat brain connection is still planned, not implemented. Test each installation separately before claiming compatibility.

### Codex connection settings and compatibility validation

The Codex connection panel selects one existing home. Resolution order is Nova’s explicit selection, inherited CODEX_HOME, then ~/.codex. Selection is saved only in Nova’s settings; it does not modify or discover other profiles. Returning to environment/default clears the override. Folder validation checks for existing Codex markers without opening credentials. Nova’s keys, name, notes, and chat memory remain in Nova’s own app data.

The selected home is used consistently for hook installation/status/removal, local session readers, task titles, and the Pet library. Switching replaces the session readers, ignores stale in-flight enrichment, and clears the previous home’s transient agent state; personal chat memory is retained. Remove Nova’s standalone hooks from the previous home before switching. Selection alone does not install hooks. Installed plugin registrations are managed separately in Codex and are not silently migrated.

Diagnostics identify the effective path and its source, directory availability, standalone hook status, local bridge availability, and the last received hook event. No event means Codex may be idle or closed; it is not a process-presence claim. An unavailable Nova bridge is retried every five seconds without launching Codex. Disconnected clients and abandoned sockets cannot crash the listener or prevent shutdown.

The upstream conflict check inspects only the selected home’s hooks.json/config.toml and probes the original local codex-avatars-v1 bridge without sending data. It does not enumerate all plugin caches, project-local hook layers, or every Codex profile. A positive match blocks standalone installation; it never disables or deletes upstream hooks. Nova owns its own marker and pipe. Unknown hook groups and unrelated handlers survive installation/removal, malformed unsupported configurations are left intact, and writes use backups plus atomic replacement with a change check. Normal Codex hook review/trust still applies; Nova never changes trust state.

New bridge events carry a local codex_home routing tag. Events tagged for other homes are ignored; legacy untagged events remain accepted for compatibility. The path stays in the local bridge and is not included in model requests. Existing rollout metadata enrichment remains best-effort: transcript layouts are not a stable Codex integration contract. Lifecycle hooks are the supported integration boundary.

Validation on 2026-10-29:

- 174 automated tests pass, including home precedence, persistence failure, home validation, event routing, hook preservation/conflict handling, disconnect/restart recovery, and busy-endpoint retry.
- scripts/preview-compatibility.cjs exercises the actual Electron settings IPC and picker with disposable Codex homes: targeted installation/removal, guarded switching, invalid folder rejection, upstream conflict blocking, and missing-home recovery. It does not change real Codex profiles.
- scripts/verify-codex-runtime.cjs was run separately against stock Codex and the Cursadex-staged runtime (both reported codex-cli 0.165.0-alpha.1.2). Each loaded all seven Nova hooks and an unrelated hook through hooks/list across two isolated app-server launches. Trust was unchanged, no model calls were made, and unrelated hooks survived removal.
- Full desktop close/reopen coexistence remains unverified. Running chats were left untouched. Protocol checks establish runtime hook discovery and restart behavior, not a completed desktop end-to-end trial.

Reproduce the runtime check with `node scripts/verify-codex-runtime.cjs <absolute codex.exe path> <label>`; it uses a unique disposable home under work/ and writes a bounded report under artifacts/. The settings integration preview runs with `electron scripts/preview-compatibility.cjs`.

### Overlay performance follow-up (local development)

The transparent native window follows a padded union of visible pets, sun spirits, speech/chat bubbles and cursor decoys. The renderer retains the full logical roaming desktop, including negative display origins and mixed scales; native viewport moves do not reassign actors or reset routes. Padding avoids moving the native window on every walking frame. Chat expands the union, distant pets can require a larger window, and dragging temporarily restores the whole logical desktop. Mouse drag coordinates use screen positions relative to the logical desktop, while hit tests remain relative to the native client window. Fullscreen clipping remains in logical coordinates. A failed viewport update attempts a full-window fallback.

Renderer work runs at up to 30 FPS while active and 12 FPS while idle. Existing decorative CSS animations are paused and advanced with the same clock, preserving their artwork and timing instead of running a separate unrestricted compositor animation. Hover transitions remain native. Unchanged atlas frames skip redundant sprite writes; closed chat bubbles skip positioning. Hidden-window throttling is enabled. Neither the force-device-scale-factor compatibility setting nor the software-rendering launch flag is removed. Windows experimental setShape was measured but is not used.

The final matched desktop-only pair used a 3840×3200 logical world and synthetic 225%/100% monitor scales. Native area fell from 12,288,000 to 491,520 pixels (96%); actual DrawAndSwap counts were 172 over 6.591 seconds for `.2` and 79 over 6.555 seconds for `.3`. Renderer task time was 149.02/160.62 ms, so the comparison does not demonstrate a CPU reduction. Overlapping active DWM-engine means were 48.91%/26.15%; whole-device NVIDIA power means were 116.82/57.49 W, with different graphics clocks and P-states. These observations include other desktop work and are neither isolated Nova wattage nor gaming acceptance. Earlier exploratory viewport sizes are not the final matched pair.

Detailed raw evidence and limits are in the ignored local `.3` handoff; public clones do not contain those artifacts. The owner is now testing `.3`, with [NOVA-003](known-issues.md#nova-003--brief-forward-jump-while-travelling-with-the-compact-overlay) open. Gaming acceptance, physical monitor hotplug and authenticated speech remain pending. Preserve `.2` and the existing external profile for a normal-quit rollback; no sealed payload is changed by edits to this checkout.

### Later: theme presets

Add independently selectable UI and fox palette presets: Ember (current charcoal/teal/orange), Moonlight (silver/blue), Aurora (violet/mint), and Rosefire (plum/rose/gold). Preserve recognizable eyes, chest glow, readable controls, and animation consistency. This is a roadmap item, not implemented in the compatibility slice.

### First desktop trial fixes

The generated source sheet is not a uniform grid. Frame metadata is now derived from the alpha components of each pose, with a fixed reference size and common foot baseline. The original PNG is unchanged. `scripts/map-nova-frames.py` reproduces the metadata using Pillow; the application does not require Python. `preview:nova -- --scene=frames` renders every mapped frame for visual review.

Nova is draggable by default; passive mode remains an explicit opt-in setting. Sun-spirit and speech-bubble pointer-down opens chat immediately, independent of a moving actor’s eventual click target. Keyboard activation is also supported. An open chat freezes roaming and keeps the native window accepting input. The overlay can accept its first click without being programmatically focused until chat is opened. Drag release is handled at document level, including outside the sprite. Picking up Nova, approaching her with the mouse, or opening her chat wakes her briefly; agent activity also wakes her as before.

Validation at this checkpoint included renderer mouse-down/move/up tests for sun, body drag/release and speech bubble, plus opening/focusing the input through the production preload and main-process IPC in a disposable full-app profile. Later owner trials reported these controls working on prior builds; `.3` physical acceptance remains separate as described above.

### Natural voice, short remarks, and desktop travel

Voice settings select local speech or natural cloud speech, with a built-in voice selector, a sample button, and a separate daily speech request cap (30 by default). The implementation selects the OpenAI Realtime API with `gpt-realtime-2.1-mini`, using only a one-liner as text input: no microphone, screen image, chat history, or tools. The saved OS-encrypted API key is reused; Codex login is not a speech API credential. Selecting cloud voice is explicit. Local speech remains the settings default; the owner requested a cloud-voice trial. Earlier validation had no saved test key and made no authenticated cloud-speech request; current private profile contents were not inspected in this audit.

Nova’s generated remarks are capped at 12 words and 90 characters. Overlong model output is rejected instead of truncated. Cloud audio is buffered completely in memory, checked against the full intended transcript, and played only when generation completed successfully. Incomplete/mismatched/overlong audio is discarded. Playback retains its audio object; local speech retains its utterance reference and only cancels on a mute transition, instead of repeatedly cancelling an already-muted engine. Status text is never voiced. There is no pending speech queue and no automatic robot-voice fallback after a cloud error. Mute and Hide interrupt playback intentionally. Speech attempts, including failures after reservation, count against the separate durable daily cap, resetting at midnight Pacific; this is a request-count guard, not a dollar billing cap. Audio is not saved to disk.

The implementation follows the [Realtime voice workflow](https://developers.openai.com/api/docs/guides/realtime-conversations), rather than the Speech API. This audit does not verify current provider model availability, pricing or deprecation dates. Audio is disclosed as AI-generated in settings. Voice quality and timing still need an authenticated listening test.

The carried animation uses only open-eyed poses with slower timing; the wink is removed. Frame source artwork remains unchanged.

On Windows, Nova normalizes its own device scale to 1 before window creation. This addressed the reproduced mixed-DPI overlay shrinking/offset defect. Windows display scaling is not changed. Read-only native monitor-scale metadata supplies fox/control sizing and settings zoom; if unavailable, the canvas falls back to scale 1. Work areas retain real monitor boundaries for travel across taskbar seams, while taskbar strips stay clipped. Roaming deadlines account for journey distance instead of abandoning distant targets every few seconds. Native bounds/reachability fixtures and earlier owner drag trials do not establish all mixed-scale behavior: [NOVA-001](known-issues.md#nova-001--cursor-chasing-increases-novas-size-on-the-1080p-monitor) remains open, and `.3` physical travel/hotplug checks remain pending.

Spirit controls include **Hide Nova**. Clicking Nova's tray icon when hidden restores her. **Enable Cursadex restore link** registers only the fixed `nova-fox-companion://show` action with the OS, using the current executable and absolute profile path. The link neither reads nor transmits chat/workspace contents. In `.3`, a genuinely new default profile registers this link on its first normal launch if no existing handler is present. Existing profiles, malformed settings, explicit `--profile` launches, capture previews and offline tests do not register automatically; existing users retain the manual button. Packaging alone never registers anything. Cursadex's fox button defaults on for fresh preferences and retains saved choices in its separate host update. The earlier `.2` handoff remains unchanged. The standalone app and tray restore do not depend on that fork.

Historical `.1` qualification: 184 Node tests (including unequal portrait/landscape monitors, negative origins, differing scales, and layout reconfiguration); actual Electron bounds/chat-focus/missing-key/audio-playback/Hide/restore checks; input and fullscreen renderer previews; optional Cursadex TypeScript, restore-button and preference fixtures. That qualification did not replace or restart the running Codex/Cursadex application. The current local-status section records `.3` separately.
