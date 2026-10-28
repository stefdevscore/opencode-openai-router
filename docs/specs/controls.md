# Configuration, pins and inspection

Status: planned v0.1 contract. Existing research and scaffold utilities do not establish full acceptance.

## Configuration

Use a plugin-owned validated configuration, without modifying unrelated OpenCode settings. Logical fields: mode (`recommend`, `auto`, `off`), profile (Economy/Balanced/Quality), ordered optional model roles, optional effort/variant mappings and observations enabled. Development defaults to `recommend`; released automatic behavior is enabled only after PRD acceptance. Production fallback profile is Balanced and observations are off.

First implement configuration in one user-controlled location; do not accept project-provided files as observation consent or permission to override a user pin. Investigate the v2 loader's `ctx.options`, including scope and precedence, and test whether it can meet user-only consent and pin requirements; otherwise use one dedicated user configuration mechanism. Choose one tested mechanism in the adapter change and document its schema/path before exposing it. Do not introduce two inconsistent config systems. Invalid/unreadable settings mean no mutation with a bounded diagnostic; preserve files for correction.

## Precedence and ordering

Host constraints → disabled mode or router session pin → configured agent model/variant pin → policy → unchanged host selection. Manual model or effort choices can be superseded in auto mode; users disable routing or set a router pin for control. Desktop and unknown clients remain non-mutating until the session-switch safety tests pass.

Maintain one in-memory generation for validated control changes in a plugin instance. A pending async decision captures it and rechecks at the proven v2 application boundary; accepted earlier changes invalidate that decision. A switch already issued before disable may complete; no rollback is promised. Changes after issuance affect subsequent admissions. Do not acknowledge success before the setting is effective in the instance and any promised persistence succeeds. Failed updates retain the previous valid setting and disable affected automatic mutation if control state is uncertain.

Global settings persist in the documented user configuration; explicit session pins must use a documented session-scoped store if persistence across reload is promised. Minimum initial behavior can be an in-memory session pin that is clearly labeled as ending on unload; manual picker selection is not a router pin in auto mode. No distributed commit journal or crash replay. If persistence is added, corrupt/unknown pin state pauses automatic routing until resolved. Test one process owning each session; multi-process pin synchronization is unsupported until a separate shared-store design is tested.

## Native controls

Investigate v2 server commands, desktop GUI and RPC support for status/inspect and enable/disable/profile/pin/unpin; use only controls verified to work without invoking a model. If the pinned loader cannot register such deterministic commands, use validated config for mutations and native structured logs/status available without model inference; document this constraint. Do not invent a UI or use a model tool as a substitute for a user's explicit control. Command names are part of the adapter implementation, not assumed APIs.

Inspection reports mode, profile, current pair, proposed pair, known observed pair, reason codes, stale catalog status and pin lifetime. Unknown dispatch is labeled unknown; no prompt, credentials or arbitrary provider errors. No live model call for inspection.

## Tests

Manual model-only and variant-only choices in auto versus off mode; agent model pin; pin/unpin; disabled/recommend mode; invalid config; changes while awaiting a catalog; late promises; independent sessions; unload/reload; documented pin lifetime; failed settings writes and plugin ordering. No configuration operation may submit a coding turn or override permissions.
