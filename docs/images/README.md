# Nova screenshot provenance

Captured and visually inspected on 2026-10-29, Pacific time. These PNGs are genuine Electron `capturePage` output from the repository's synthetic renderer preview, not AI mockups or screenshots of a personal desktop.

| File | Size | Suggested caption |
| --- | --- | --- |
| [nova-chat-preview.png](nova-chat-preview.png) | 440 × 470; 36,812 bytes | Synthetic preview: Nova, her sun spirit, and floating chat controls. |
| [nova-sleep-preview.png](nova-sleep-preview.png) | 250 × 280; 21,806 bytes | Synthetic preview: Nova napping beside her sun spirit. |

The driver was derived from [preview-nova.cjs](../../scripts/preview-nova.cjs), using the current checkout's renderer, production fox artwork and fixture preload. Only screenshot-driver settings changed: a unique disposable profile and synthetic `CODEX_HOME`, forced scale factor 1, an explicit window backdrop, blocked HTTP/WebSocket requests, and a tighter native capture rectangle for the sleep image. Installed Electron 43.3.0 was used with software rendering; no dependency was downloaded. Chat and sleep fixture assertions passed and both processes exited normally. The first restricted-sandbox attempt failed to load its graphics subprocess; successful captures used the same installed runtime outside that restriction.

The conversation is fixture text: “Hello Nova” and “I heard you. Supervisory ears are operational.” No real name, key, memory, chat transcript, selected Codex home or external window content was used. No hook, URI, startup or cloud registration was performed. Detailed disposable driver/log evidence stays under ignored `work/`; it is not required to display these images in a public clone.

These static previews demonstrate appearance only. The fixture does not exercise production native viewport movement, mixed-monitor travel or gaming performance. It does not resolve or visually accept the `.3` movement regression, [NOVA-003](../known-issues.md#nova-003--brief-forward-jump-while-travelling-with-the-compact-overlay), or the other open issues. No running Nova instance or sealed bundle was modified.

SHA-256:

- `nova-chat-preview.png`: `59f46039465f9f1c8a30d7a5fdd5c72769288dedc5ca34dc1c7d24ddbc60ec88`
- `nova-sleep-preview.png`: `f38841d0dc2a529a39733e3aac4cc85e56e2b404aaa1cc9044a6a28f64242caa`
