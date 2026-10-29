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

The app and GitHub repo now use Nova Fox Companion. Legacy hook/plugin/pipe identifiers remain for integration compatibility; do not install two companions on the same bridge. Upstream update prompts are disabled for this fork. The active workspace folder remains named Null Companion to avoid changing this running chat's path.
