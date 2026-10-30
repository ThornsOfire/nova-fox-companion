# Architecture

## Product boundary

Nova Fox Companion is deliberately hybrid:

- the **Codex plugin** supplies lifecycle hooks and the `create-nova-fox-companion` workflow;
- the **local renderer companion** owns the operating-system overlay, tray controls, settings, and sprite animation.

Plugin UI is hosted inside ChatGPT. It cannot create a global always-on-top window, so the renderer is the smallest honest system component that satisfies desktop roaming.

## Data flow

```text
Codex lifecycle
      |
      | plugin hook; allowlisted metadata only
      v
PowerShell bridge -- starts renderer when absent
      |
      | local named pipe: nova-fox-companion-v1
      v
Normalizer + agent store
      ^
      | local title index + rollout metadata: labels, model, effort only
      |
      +-------------> normal settings window + Windows tray
      |
      v
transparent compact BrowserWindow over a logical roaming desktop
      |
      v
independent Codex Pet v2 sprite actors
```

## Plugin package

The repo marketplace lives at `.agents/plugins/marketplace.json`; the plugin source lives under `plugins/nova-fox-companion/`.

- `hooks/hooks.json` subscribes to session, permission, prompt, stop, and subagent lifecycle events.
- `scripts/codex-hook.ps1` forwards only explicit fields. On the first event it can start either the source renderer, a configured packaged companion, or the standard per-user install.
- `skills/create-nova-fox-companion/` explicitly invokes `$hatch-pet`, resolves the bundled workspace Python (including Pillow), and writes only to the shared Codex Pets directory.

Codex copies installed local plugins into its cache. `install.ps1` therefore stores `NOVA_FOX_COMPANION_DEV_ROOT` as a user environment variable so a cached hook can still find a cloned source renderer. Packaged installs instead resolve the companion executable from the install directory.

## Installer package

The NSIS installer is the end-user path. It embeds the repo marketplace and plugin under `resources/integration`, so it does not depend on a clone after installation. Its custom install phase merges standalone lifecycle hooks and registers the exact executable path in the per-user `NOVA_FOX_COMPANION_APP` environment value. The custom uninstall phase removes only hooks carrying the Nova Fox Companion marker and deletes that environment value only when it still points at the uninstalling copy.

The first normal packaged launch shows a four-step guide. Its plugin action opens the bundled marketplace through a `codex://plugins/nova-fox-companion` deeplink. The user still installs the plugin and reviews its hooks in Codex; this security boundary is intentionally not automated.

## Overlay and control surface

The logical desktop covers the resolved union of selected work areas; its coordinate system can include negative monitor origins. In the .3 implementation, the alpha-zero native BrowserWindow follows a padded union of visible pets and controls while the renderer translates the logical world to compensate. Chat can expand that union, distant actors can still require a large surface, and dragging temporarily expands to the full logical desktop. Hidden windows throttle and CSS/JS rendering share an active/idle clock. The settings window is separate; the full-desktop zone picker retains its own bootstrap.

This is an asynchronous native-window/renderer transaction, not a guarantee of atomic presentation. The owner has reported movement jumps in .3; a gap between native bounds changes and renderer compensation is a hypothesis under investigation. See [known issues](known-issues.md). Geometry/input fixtures and desktop performance measurements do not replace frame-by-frame visual acceptance.

In passive mode the entire window ignores mouse input. The settings window, tray menu, and global `Ctrl+Alt+A` shortcut are outside that input surface, so passive mode cannot lock the user out. In interactive mode forwarded pointer movement enables input only while the pointer is over an avatar; transparent desktop regions continue to pass clicks through.

The independent enable/disable control hides or restores the overlay window without terminating the tray process or discarding the current agent store. Size previews use a sanitized overlay-only IPC message while the sliders move; the settings file is written once when the user commits the value.

The roaming resolver supports:

- all displays;
- an explicit set of display ids;
- one clamped rectangle in virtual-screen coordinates, including negative monitor coordinates, selected through a full-desktop drag surface that is expanded after startup just like the overlay.

Actors receive deterministic initial display assignments. When more than one zone is active, movement follows a topology built from the actual shared edges in the Windows display arrangement: an avatar crosses a shared seam, uses any intermediary screens, and never jumps across a disconnected gap. Manual dragging uses the same edge topology before changing the actor’s roaming screen.

Idle main agents and completed subagents enter a dormant state after the normal completion grace period. The overlay hides them by default or renders them as stationary sleeping Pets when enabled. The in-memory dormant history expires after 30 minutes and is capped at 50 agents, so long-running companions remain bounded.

## Avatar library

`src/core/avatar-library.cjs` scans the shared `${CODEX_HOME}/pets` directory first and optional bundled assets second. It validates package paths and WebP dimensions before exposing an asset through the private `nova-fox-companion:` protocol.

V2 sheets use 8 columns, 11 rows, `192x208` cells, and a final size of `1536x2288`. The overlay maps lifecycle state and horizontal velocity to the native idle, directional-running, waving, waiting, working, and review rows.

Personal Pet binaries are never copied into Git. A watcher refreshes the library every five seconds and can automatically enable newly created avatars.

The Pet Gallery exports a constrained `.codexpet` ZIP and stages imports before validation. Only a small allowlist of root files is accepted; existing ids are never overwritten. See `docs/pet-gallery.md`.

## Persistence and privacy

Renderer preferences are stored under Electron's per-user application data directory. No prompt or transcript data is persisted.

The bridge accepts only event name, session id, turn id, agent id, agent type, optional task/model/effort metadata, and a project-folder basename derived inside the hook. The full working-directory path never enters the pipe or renderer state. The named-pipe server limits payload size, ignores malformed data, and never exposes a TCP port.

Current lifecycle hooks expose `agent_id` and `agent_type`, but not the main task title, collaboration task label, configured model, or reasoning effort. The optional metadata resolver reads the root title from `session_index.jsonl`, then matches `agent_id` to the local rollout filename, reads `session_meta` and the first `turn_context`, and returns only the task title, `agent_path`, nickname, model, and effort. A non-persistent 250 ms file-stat monitor rereads all active root titles in one pass when that index changes; generation ordering prevents a stale read from overwriting a newer rename. Conversation records are not added to the agent store or settings.

## Event accuracy

`SubagentStart` and `SubagentStop` include `agent_id` and `agent_type`, which is enough to create and retire independent actors. Tool-use hook payloads do not currently expose an individual subagent id, so the renderer does not claim per-agent command or file attribution. When rollout enrichment is unavailable, a unique `Agent XXXX` fallback is shown instead of repeating `Default`.
