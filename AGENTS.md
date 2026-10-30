# Nova Fox Companion project rules

Read the README and relevant documentation before changing behavior. Inspect the branch/diff and preserve other agents' work. Stage explicit task files; never reset, clean or sweep unrelated work into a checkpoint.

## Product and privacy

- Nova is a standalone companion usable with stock Codex. Keep Cursadex integration optional; do not make its presence, branding or workspace paths a runtime requirement. Derive paths from explicit configuration/installation.
- Preserve the existing profile, settings and encrypted memory. Keep credentials, encryption keys, live profiles, chat contents and personal screenshots out of source commits and staged packages. Use synthetic fixtures and ignored `work/`, `outputs/` or `artifacts/` for local evidence.
- Hooks, URI registration, process launch, cloud features and external communication require explicit owner choices. Preserve existing opt-in/confirmation boundaries and integration identifiers; never register hooks or enable features as a packaging side effect.
- Update user/developer documentation for controls, data lifetime and compatibility changes. Record meaningful behavior changes in the project's changelog/release notes without claiming unpublished work is released. Report tests and native verification separately, including pending checks and known dependency issues.

## Deployment handoffs

- Follow the workspace `WorkspaceSetup/Deployment/README.md` contract when present. Public clones remain portable: exact source identity, immutable artifact hashes/sizes, validation evidence and limits, dependencies, profile-preserving activation and rollback instructions are required. Put local bundles in ignored `artifacts/handoffs/`.
- A Git commit is a source checkpoint, not an installer or staged app. Use `source-ready`/`blocked` when packaging/runtime prerequisites are missing. A staged source launch must include the exact runtime/dependencies and immutable app source, not a command targeting the mutable checkout. No automatic downloads or upgrades.
- The standalone app and optional Cursadex restore control need separate application/component handoffs. Submit shared Cursadex work as `integrate-only`, scoped to owned files. Do not reapply an already integrated patch, bundle another agent's changes or modify the shared Cursadex version/launch controls. The designated coordinator owns combined builds and activation/rollback selection.
- Freeze handed-off source or issue an explicit replacement handoff. Never overwrite an existing staged/running build. Owner review gates activation, installation, registration, publication and restart. Do not kill live Codex/Nova processes, move live state or modify live databases.
- Use installed tools only unless downloads are explicitly authorized. Report exact blockers and pending live checks; do not weaken tests or change security policy to manufacture readiness. Do not push, tag, release, publish or change remote settings without direct authorization.
