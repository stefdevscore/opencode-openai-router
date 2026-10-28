# Configuration and inspection

Status: initial control implementation awaiting QA. No automatic routing hook is registered. OpenCode 2.2 desktop inspection uses an experimental GUI entry and typed server RPC; switching integration and broader host compatibility remain open.

## Implemented controls

On the pinned macOS target, the plugin reads `$XDG_CONFIG_HOME/opencode-openai-router/config.json` when `XDG_CONFIG_HOME` is absolute, otherwise `~/.config/opencode-openai-router/config.json`. It ignores project plugin options. A genuinely absent file at startup selects auto/Balanced; a dangling symlink or an existing file that later disappears is unreadable for that plugin instance. Restarting with no file uses the defaults again. The file is user-managed and is never created or rewritten by the plugin. Only `mode` (`auto`, `off`) and `profile` (`economy`, `balanced`, `quality`) are implemented; all other fields or malformed values are invalid. The input is bounded to 64 KiB.

The earlier pinned-host fixture confirmed that project configuration can supply `ctx.options`, so options are unsuitable as the only user-owned consent and control source. Native options precedence and live reload have not been fully characterized; the implemented controls do not depend on them. A packed-plugin fixture supplies conflicting project options and verifies that the user file governs the reported control state.

Startup and the OpenCode 2.2 **OpenAI router: Show status** command-palette action refresh the configuration. The action calls a bounded server RPC scoped to the current session's location and shows a native dialog; it does not submit a prompt or require a model. Invalid or unreadable settings are reported without presenting last-valid values as effective. The isolated 2.2 server fixture verifies zero session messages, provider requests and agent/model changes. The actual 2.2 desktop displayed the dialog. A missing session or unavailable server produces a bounded explanation. No model or observed-dispatch status exists yet.

The desktop action is available through the command palette, not as a slash command: the 2.2 composer applies its selection before running client slash commands. Earlier server-command, synthetic-input and dynamic-description approaches did not provide a safe visible status on 2.1.4; see the [desktop status investigation](../evidence/v2-desktop-status-investigation.md). The 2.2 GUI API is experimental. The 2.1.4 desktop has no supported status UI in this implementation.

There is no file watcher. A change becomes effective for this instance when a refresh reads it; an edit alone is not an acknowledgment. Reads are serialized, and invalid or unreadable input prevents mutation while retaining the last valid settings for diagnosis. The `issue` boundary serializes the final refresh and generation check with synchronously starting a caller-supplied operation; the caller must start the host request before returning its promise, without an intervening asynchronous step. The boundary does not wait for that promise to finish, so an accepted later disable cannot undo an already-issued operation. The future adapter must use and test this boundary with the actual host API. Disposing the instance invalidates pending reads and decisions. There is no atomic guarantee against external file changes between the last read and a host operation; effective disable means a refresh has accepted `off` before issuance.

## Configuration

Use a plugin-owned validated configuration, without modifying unrelated OpenCode settings. Logical fields: mode (`auto`, `off`), profile (Economy/Balanced/Quality), optional effort/variant mappings, model-evidence refresh settings, optional classifier enablement/budget and observations enabled. Manual model roles and pins are not part of the product controls. Automatic routing is the intended default; use isolated fixtures during development and complete PRD acceptance before release. Production fallback profile is Balanced and observations are off.

First implement configuration in one user-controlled location; do not accept project-provided files as observation consent. Investigate the v2 loader's `ctx.options`, including scope and precedence, and test whether it can meet user-only consent and control requirements; otherwise use one dedicated user configuration mechanism. Choose one tested mechanism in the adapter change and document its schema/path before exposing it. Do not introduce two inconsistent config systems. Invalid/unreadable settings mean no mutation with a bounded diagnostic; preserve files for correction.

## Precedence and ordering

Host constraints → disabled mode → policy → unchanged host selection. The router chooses model and effort automatically in auto mode; users disable it for manual control. Desktop and unknown clients remain non-mutating until the session-switch safety tests pass.

Maintain one in-memory generation for validated control changes in a plugin instance. A pending async decision captures it and rechecks at the proven v2 application boundary; accepted earlier changes invalidate that decision. A switch already issued before disable may complete; no rollback is promised. Changes after issuance affect subsequent admissions. Do not acknowledge success before the setting is effective in the instance and any promised persistence succeeds. Failed updates retain the previous valid setting and disable affected automatic mutation if control state is uncertain.

Global settings persist in the documented user configuration. Routing `off` also prevents new classifier dispatch and background refresh; already-issued classifier work may finish but cannot switch a coding session. A host switch issued before disable may still complete as described above. Re-enabling schedules deduplicated refresh, never a backlog of accumulated jobs. No router model pin, distributed commit journal or crash replay is required. Test one process owning each session; multi-process control synchronization is unsupported until separately designed and tested.

## Native controls

Investigate v2 server commands, desktop GUI and RPC support for status/inspect and enable/disable/profile; use only controls verified to work without invoking a model. If the pinned loader cannot register such deterministic commands, use validated config for mutations and native structured logs/status available without model inference; document this constraint. Do not invent a UI or use a model tool as a substitute for a user's explicit control. Command names are part of the adapter implementation, not assumed APIs.

Inspection reports mode, profile, current pair, proposed pair, known observed pair, reason codes and stale catalog status. Unknown dispatch is labeled unknown; no prompt, credentials or arbitrary provider errors. No live model call for inspection. Classifier enablement, budget and refresh status are inspectable without starting classification.

## Tests

Model and variant decisions in auto versus off mode; configured agents; disabled mode; invalid config; changes while awaiting a catalog; late promises; independent sessions; unload/reload; failed settings writes and plugin ordering. No configuration operation may submit a coding turn or override permissions.
