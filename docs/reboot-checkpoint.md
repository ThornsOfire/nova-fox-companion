# Nova Fox Companion reboot checkpoint — 2026-10-29

**Historical checkpoint, not current launch instructions.** This records the earlier 184-test source baseline. Later .2/.3 handoffs and owner movement/scaling reports supersede its readiness/default statements. Read [current development notes](nova-fox-companion.md) and [known issues](known-issues.md). Use the exact reviewed handoff and its external-profile guard when selecting a packaged build; the source `npm start` command below does not select that immutable package. Do not infer current profile/key/voice state from this dated record.

Repository folder: Nova Fox Companion. Branch: feature/nova-desktop-play. The final commit identifier is reported in chat and available with `git log -1 --oneline`.

## Saved behavior

- Complete Nova rename, independent hook/plugin/pipe/startup identifiers, and name onboarding with encrypted memory.
- Codex-home picker and diagnostics; standalone hook conflict/preservation checks; bounded local bridge recovery. No Cursadex dependency in the standalone app.
- Corrected per-pose source rectangles, fixed animation scale/baseline, open-eyed/slower pickup poses, functional spirit/bubble chat, dragging and interaction wake-up.
- Physical desktop coordinates for Windows mixed-DPI overlays, with read-only native per-monitor scale metadata restoring the fox/control size and settings zoom. Taskbar seams connect adjacent monitors; roaming deadlines allow real journeys. Unequal monitor sizes and negative origins are data-driven.
- Natural cloud speech with voice selector/sample, complete in-memory audio/transcript validation, mute, no robot fallback, and a separate daily request cap. Current model: gpt-realtime-2.1-mini. Generated quips: maximum 12 words / 90 characters. No microphone capture.
- Hide Nova in spirit controls; click the tray icon while hidden to restore. Optional fixed OS restore link can be enabled explicitly in settings.

## Verification

184 Node tests passed. Actual Electron checks passed for mixed-DPI desktop bounds, monitor reachability, real chat focus, missing-key speech gating, WAV playback from memory, Hide/restore, home selection, hook targeting, conflicts and unavailable-home recovery. Renderer input and fullscreen scenes passed. Stock and Cursadex runtime hook discovery was checked separately in disposable homes; active chats were not restarted or altered.

Production dependency audit: zero reported vulnerabilities after a compatible adm-zip update. npm still reports six high-severity development-toolchain findings; those remain to review before publishing an installer. No forced dependency upgrades were performed.

## After reboot

From the repository root, launch Nova with:

```powershell
npm.cmd start -- --disable-gpu --profile=work/nova-live
```

The live trial uses its own profile under work/nova-live. Its settings and encrypted memory have been retained. Cloud voice is selected as requested. No API key is currently saved in this profile, and no paid speech listening test has been made. Enter the API key only in Nova settings, unmute, and use **Hear Nova’s voice**. The Codex chat brain is still a separate future feature; Codex login does not provide a speech API key.

Retest physical dragging near the top of each monitor, travel across the real monitor seam, vertical roaming, pickup expressions, speech completion, fullscreen protection, and Hide/tray restore. Test a monitor disconnect/reconnect when convenient; geometry fixtures cover layout changes, but a physical hot-plug trial is unverified.

## Optional Cursadex restore logo

Source changes were made in the Cursadex Candidate workspace, without rebuilding or replacing the running application. TypeScript, the focused Nova restore fixture, and the shared-preferences fixture passed. The logo is disabled by default and requires **Nova Fox Companion restore button** in Cursadex settings plus **Enable Cursadex restore link** in Nova settings.

The source-only handoff is outputs/cursadex-nova-restore.patch. It contains only the Nova additions, constructed by subtracting those additions from current files; unrelated agents’ changes are excluded. Do not reapply it over the already-modified candidate. It is provided for review/transfer to the next build. Cursadex’s other dirty files were left untouched and are not committed by the Nova checkpoint. The real host’s external-protocol handoff still needs a live test after its rebuild/relaunch.

## Next development

Linked native Codex chat brain (history, model choice, hidden character cues) remains unimplemented. UI/fox palette presets (Ember, Moonlight, Aurora, Rosefire) remain later roadmap work.
