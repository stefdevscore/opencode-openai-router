# Configuration and inspection

Status: planned v0.1 contract. Existing research and scaffold utilities do not establish full acceptance.

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
