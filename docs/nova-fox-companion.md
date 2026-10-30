# Nova Fox Companion: development notes

This fork builds an original companion personality on the MIT-licensed Codex Avatars foundation. Mochi's publicly described behavior is inspiration only; no Mochi source or artwork has been copied.

## Available in this checkout

- Brief visual notices for agent state changes. “Turn finished” and “Agent stopped” describe lifecycle events, not a claim that a task succeeded.
- Original local quips with a shared 20-second cooldown. Input requests and terminal notices bypass the visual cooldown; they do not automatically produce a quip.
- Speech uses the system speech engine through Electron's Web Speech API. Only the separate quip field is spoken. Status notices are never read aloud.
- Mute on each pet in interactive mode, in settings, and in the tray menu. The tray remains usable in passive mode. Mute cancels speech immediately; missed quips are not queued or replayed.
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

Model prices checked 2026-10-29: input/output dollars per million tokens are Luna 0.10/0.50, Terra 1/5, Sol 2/10. The local guard reserves a conservative 30,000-byte input allowance plus 256 output tokens, rounded upward to $0.001. It is not actual billing or a provider-side spending cap. Configure provider-side limits too; prices may change.

References: https://developers.openai.com/api/docs/models and https://developers.openai.com/api/docs/guides/structured-outputs

### Validation boundaries

Provider tests use fakes. No real model request has been made; enter a key in the app, enable cloud remarks, and use Preview to verify account access. Never put keys in chat or source. Audible speech and the full overlay still need a live Windows check with a compatible pet. GPU acceleration failed in the restricted environment; the isolated settings preview succeeds with `--disable-gpu`. Use `--settings-scroll=800` to inspect memory controls.

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

### Validation

`npm test` covers geometry subtraction, fullscreen versus maximized work-area windows, negative display origins, idle-cursor cancellation, bounded escape, reduced motion, sensor metadata filtering, and atlas bounds. `npm run preview:nova -- --scene=chat` runs an isolated Electron renderer fixture with synthetic state, no hooks, no provider calls, and no real cursor changes. Other scenes: `sleep`, `peek`, `play`, `escape`, `fullscreen`. The chat scene verifies round-trip typing, scrollable history, and memory clearing. The play scene verifies that a real-cursor movement sample removes the decoy.

The read-only native sensor has been smoke-tested on Windows. Preview assertions use synthetic windows; real fullscreen games, multi-monitor arrangements, live speech, authenticated GPT, and real window capture still need a live desktop trial. No Codex restart or hook installation was performed.

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

### Later: theme presets

Add independently selectable UI and fox palette presets: Ember (current charcoal/teal/orange), Moonlight (silver/blue), Aurora (violet/mint), and Rosefire (plum/rose/gold). Preserve recognizable eyes, chest glow, readable controls, and animation consistency. This is a roadmap item, not implemented in the compatibility slice.

### First desktop trial fixes

The generated source sheet is not a uniform grid. Frame metadata is now derived from the alpha components of each pose, with a fixed reference size and common foot baseline. The original PNG is unchanged. `scripts/map-nova-frames.py` reproduces the metadata using Pillow; the application does not require Python. `preview:nova -- --scene=frames` renders every mapped frame for visual review.

Nova is draggable by default; passive mode remains an explicit opt-in setting. Sun-spirit and speech-bubble pointer-down opens chat immediately, independent of a moving actor’s eventual click target. Keyboard activation is also supported. An open chat freezes roaming and keeps the native window accepting input. The overlay can accept its first click without being programmatically focused until chat is opened. Drag release is handled at document level, including outside the sprite. Picking up Nova, approaching her with the mouse, or opening her chat wakes her briefly; agent activity also wakes her as before.

Validation includes renderer mouse-down/move/up tests for sun, body drag/release and speech bubble, plus opening/focusing the input through the production preload and main-process IPC in a disposable full-app profile. Live desktop behavior still needs the owner’s retest.

### Natural voice, short remarks, and desktop travel

Voice settings now select local speech or natural cloud speech, with a built-in voice selector, a sample button, and a separate daily speech request cap (30 by default). Cloud speech uses the current OpenAI Realtime API with gpt-realtime-2.1-mini, using only a one-liner as text input: no microphone, screen image, chat history, or tools. The saved OS-encrypted API key is reused; Codex login is not a speech API credential. Selecting cloud voice is explicit. The local voice remains the default for existing/new settings; this owner’s live trial is explicitly set to cloud as requested. No authenticated cloud-speech request has been made in validation because the live trial has no saved API key.

Nova’s generated remarks are capped at 12 words and 90 characters. Overlong model output is rejected instead of truncated. Cloud audio is buffered completely in memory, checked against the full intended transcript, and played only when generation completed successfully. Incomplete/mismatched/overlong audio is discarded. Playback retains its audio object; local speech retains its utterance reference and only cancels on a mute transition, instead of repeatedly cancelling an already-muted engine. Status text is never voiced. There is no pending speech queue and no automatic robot-voice fallback after a cloud error. Mute and Hide interrupt playback intentionally. Speech attempts, including failures after reservation, count against the separate durable daily cap, resetting at midnight Pacific; this is a request-count guard, not a dollar billing cap. Audio is not saved to disk.

The provider is based on the current [Realtime voice workflow](https://developers.openai.com/api/docs/guides/realtime-conversations). The older Speech API models are scheduled for shutdown; new voice support does not depend on them. Audio is disclosed as AI-generated in settings. Voice quality and timing still need an authenticated listening test.

The carried animation uses only open-eyed poses with slower timing; the wink is removed. Frame source artwork remains unchanged.

On Windows, Nova now normalizes its own device scale to 1 before window creation. This prevents the reproduced mixed-DPI bug where a requested desktop-sized overlay was shrunk and offset. Windows display scaling is not changed. Read-only native monitor-scale metadata restores the appropriate fox/control size on each display and the settings window zoom; if scale metadata is unavailable the canvas falls back to scale 1. Work areas retain their real monitor boundaries for travel across taskbar seams, while taskbar strips stay clipped. Roaming deadlines account for journey distance instead of abandoning distant targets every few seconds. Native bounds and reachability were tested on the owner’s two-monitor, mixed-scale layout; final physical dragging and travel need an owner retest.

Spirit controls include **Hide Nova**. Clicking Nova’s tray icon when hidden restores her. The optional **Enable Cursadex restore link** button registers only the fixed nova-fox-companion://show action with the OS, using the current executable and absolute profile path. The link neither reads nor transmits chat/workspace contents. Registration is explicit, not performed automatically by the app or tests. Cursadex’s optional restore-logo source was added separately, disabled by default in its settings; it needs a Cursadex rebuild/relaunch and a live host protocol check. The standalone app and tray restore do not depend on that fork.

Validation for this update: 184 Node tests (including unequal portrait/landscape monitors, negative origins, differing scales, and layout reconfiguration); actual Electron bounds/chat-focus/missing-key/audio-playback/Hide/restore checks; input and fullscreen renderer previews; optional Cursadex TypeScript, restore-button and preference fixtures. The running Codex/Cursadex application was not replaced or restarted.
