# Nova Fox Companion known issues

These are local development observations, not public release notes. The `.3` handoff was launched at the owner's request on 2026-10-29 using the existing external profile. Launch success does not establish visual acceptance. Local bundles and evidence are ignored development artifacts and are not supplied by a public clone; no public Nova release is claimed. See the [current development status](nova-fox-companion.md#current-local-status--2026-10-29-pacific).

## NOVA-003 — Brief forward jump while travelling with the compact overlay

- Reported by the owner on 2026-10-29, Pacific time, after launching `nova-fox-companion-0.7.2-handoff.3-s41478a3490b8`.
- Status: open; source review identified a possible native-window/renderer synchronization gap. No fix or replacement build has been validated.
- Actual: Nova intermittently glitches ahead in her direction of travel, apparently for a single frame.
- Follow-up: the owner cannot distinguish whole-body displacement from an adjacent sprite-frame slice because it happens too quickly. Neither visual mechanism is confirmed.
- Expected: moving or resizing the compact native viewport preserves Nova's apparent desktop position in every presented frame.
- Evidence: owner observation in chat. In `src/main.cjs`, the `nova:overlay-surface` handler calls `overlayWindow.setBounds` before returning the new origin. In `src/renderer/overlay.js`, `updateSurface` applies the compensating world offset only when that asynchronous reply resolves. A compositor presentation between those operations could move the previous pixels with the native window. This is a candidate explanation, not an independently captured reproduction.
- Next validation: correlate synthetic, frame-by-frame desktop positions with native viewport changes; distinguish a whole-body displacement from sprite-atlas bleed. Cover both travel directions, vertical travel, drag expansion/release, and mixed-scale monitor transitions. Check compositor cost as well as visual stability before selecting a correction.
- Keep `.3` immutable and retain `.2` as rollback. This report does not authorize replacing or stopping the running app, and no sealed handoff was edited.

## NOVA-004 — Cursadex fox button still does not launch Nova after enabling the restore link

- Reported again by the owner on 2026-10-30, Pacific time.
- Status: open, recorded only. The owner explicitly deferred investigation and fixes.
- Context: the owner reported enabling **Cursadex restore link** in Nova after the local `.3` launch on 2026-10-29. On the following day, clicking Cursadex's fox button still showed the same warning and did not launch Nova.
- Expected: after the link is enabled and any required confirmation is accepted, the fox button starts Nova when closed or restores her when hidden, retaining the intended profile.
- Evidence: owner observation in chat. Exact warning text, whether confirmation was accepted, current Nova process state, persisted protocol command, target availability and host URI dispatch have not been checked for this recurrence. Do not assume the handler is absent: the earlier missing-registration diagnosis predates the owner's registration action.
- Future investigation, when authorized: capture the warning, distinguish Cursadex's normal per-session confirmation from an OS/dispatch error, inspect the registered command and profile target read-only, then test hidden restore and cold launch separately.
- No protocol registration, settings, processes, launch controls or sealed bundles were changed for this report.

## NOVA-001 — Cursor chasing increases Nova's size on the 1080p monitor

- Reported by the owner on 2026-10-29, Pacific time.
- Status: recorded for later investigation; no fix authorized as part of this report.
- Trigger: Nova chases the mouse on the owner's 1080p monitor in a mixed-resolution display setup.
- Actual: Nova's displayed scale increases during the chase.
- Expected: cursor chasing preserves the scale appropriate for the display she occupies.
- Evidence: owner observation in chat. Exact build, transition timing, display scale selection and underlying cause have not been independently verified.
- Keep separate from the active overlay performance investigation; do not infer a cause or mark resolved from performance fixtures.

## NOVA-002 — Bring the sun spirit closer to Nova

- Requested by the owner on 2026-10-29, Pacific time.
- Status: recorded for later visual adjustment; no placement change in the performance update.
- Current: the sun spirit floats too far from Nova.
- Requested: reduce the gap while keeping the spirit easy to click and preserving readable chat placement at different display scales.
- Evidence: owner feedback in chat. Exact spacing and overlap limits will be reviewed when this adjustment is implemented.
