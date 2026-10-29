# Nova Companion: development notes

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
- The model receives state cues, personality, language, and explicit companion memory/direct chat only. No automatic access to other agents' conversations, labels, ids, paths, screenshots, source, or tool outputs. Requests use `store: false`.
- Pickup tilt, drop bounce, and optional relocation remarks, respecting mute, cooldown, and reduced motion.

### Budget guard

Model prices checked 2026-10-29: input/output dollars per million tokens are Luna 0.10/0.50, Terra 1/5, Sol 2/10. The local guard reserves a conservative 30,000-byte input allowance plus 256 output tokens, rounded upward to $0.001. It is not actual billing or a provider-side spending cap. Configure provider-side limits too; prices may change.

References: https://developers.openai.com/api/docs/models and https://developers.openai.com/api/docs/guides/structured-outputs

### Validation boundaries

Provider tests use fakes. No real model request has been made; enter a key in the app, enable cloud remarks, and use Preview to verify account access. Never put keys in chat or source. Audible speech and the full overlay still need a live Windows check with a compatible pet. GPU acceleration failed in the restricted environment; the isolated settings preview succeeds with `--disable-gpu`. Use `--settings-scroll=800` to inspect memory controls.

## Character and next movement/window slice

Nova is an original charcoal spirit fox: soft smoky silhouette, expressive ears, teal eyes, teal accents on a comet tail, and an orange/amber chest ember. The ember should pulse softly while resting and brighten when Nova perks up. The napping pose curls Nova into the tail with closed eyes and sleepy ear twitches. Respect reduced motion. The first generated character sheet is an art draft; repair frame alignment before using it as an animation atlas.

- Add optional active-window awareness with explicit screenshot controls and exclusions.
- Avoid displays covered by fullscreen or borderless fullscreen windows. Hide when all displays are occupied.
- Stalk and bat at a cursor decoy while the real cursor is idle; yield immediately when the mouse moves.
- Peek from behind window edges and occasionally speak from there.
- After repeated pickups, briefly scurry away from the cursor, then settle. Keep escape attempts bounded so Nova remains placeable.
- Build/validate custom animation frames for idle, running, carrying, dropping, waiting, thinking, reacting, sleeping, and looking around.

## Future ideas — explicitly deferred

Windows Bubbles and Pipes screensaver cameos. Do not change or integrate with the user's screensaver yet.

The app and GitHub repo now use Nova Companion. Legacy hook/plugin/pipe identifiers remain for integration compatibility; do not install two companions on the same bridge. Upstream update prompts are disabled for this fork. The active workspace folder remains named Null Companion to avoid changing this running chat's path.
