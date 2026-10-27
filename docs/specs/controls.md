# Controls, configuration, and session state specification

**Scope:** PRD FR-5. Controls must be available through a verified OpenCode-native integration; names, commands, and configuration paths are intentionally not asserted until the host spike proves them. A host without the required controls cannot be claimed as supporting automatic routing.

## Configuration contract

The conceptual settings are routing enabled/disabled, profile (`economy`, `balanced`, `quality`), ordered model preferences for economy/general/complex roles, optional explicit variant-to-effort mappings, and observation consent. On verified hosts, routing defaults to enabled and the profile to balanced; observation collection defaults off. Model and variant preferences are optional and must be checked against the current connection-scoped catalog before use. The same model may fill multiple roles. No role mapping means keep the existing model unless documented host role evidence supports a decision.

Malformed or unreadable configuration must not silently enable an unsafe mode: keep the current selection, present a bounded diagnostic, and preserve the user's configuration for correction. Do not guess a missing provider or replace a stale preference silently. The final format, schema, global/project precedence, invalid-value diagnostics, exact path, and scope of configuration changes must be documented and tested before release.

## Precedence and session lifecycle

Host safety, available provider/model and supported variant constraints always apply. A user-selected model or variant protects the entire pair for its explicit turn; that turn-level choice takes precedence over a session pin for that turn only. Next comes a session-level pin or pause, then the router's eligible decision, then the unchanged host selection as fallback. A stale pin remains pinned and is reported; never replace it with an unrequested model.

| Input | Session behavior |
| --- | --- |
| Host default at session start | Follow configured enabled state; current selection remains fallback. |
| User choice scoped to one turn | Keep the entire selected pair for that turn; restore the prior routing/pin state for the following turn. |
| User session selection or explicit pin | Pause routing for that session until explicit resume/unpin; preserve the selected pair across plugin reload while the session exists. |
| Explicit resume/unpin | Clear pause/pin; later eligible turns may route only if selection origin/scope remains reliable. |
| Router disabled, then enabled | Keep the host selection; do not erase a prior session pin or pause. |
| Ambiguous choice origin/scope | Keep the pair, pause affected session and show why. Resume does not make future ambiguous events safe. |
| Router-originated choice | Do not misclassify it as a manual selection or pin. |

Separate session state by host session and connection; cleanup at session deletion according to verified host lifecycle. A session's pause/pin and cooldown must not affect another session. Persist only the minimum needed to preserve the stated lifecycle, separately from opt-in observations. Specify its location, restart semantics, access permissions and deletion behavior when the host integration is known; do not write prompts or source content. Unknown host persistence or inability to distinguish the above transitions blocks the automatic-routing gate.

## Ordering, acknowledgement and recovery

Each session/connection has a monotonic control revision covering enabled state, profile, role/variant preferences, pause, pin, current user selection and cooldown. A control change and every routing commit must be ordered against the same guard described in [shared contracts](README.md#shared-contracts), including native host picker actions. The guard must be enforced atomically by the host, or all relevant host and plugin operations must be demonstrably serialized under an equivalent mechanism; a plugin-only lock cannot guard unobserved native picker changes. A stale revision rejects the routing commit without mutation.

For a pin or pause, acknowledge success only after the new control state is effective against in-flight commits and durably recorded for reload while the session exists. For a turn-scoped selection, the host's selection must be effective before dispatch; it does not erase a prior pin. A resume/unpin is acknowledged only after the cleared state is effective and durably recorded. If durable state cannot be written, present a failed/unconfirmed operation and keep routing paused; never claim the pin or resume succeeded. If read, schema validation, recovery, or the authoritative revision is unavailable, default the affected session to paused and retain the host selection until explicit, successful recovery. A missing record for a genuinely new verified session differs from a missing or corrupted record for an existing session; inability to distinguish them fails closed.

Serialize concurrent events for one session, deduplicate terminal turn admission by host turn identity, and ensure a confirmed application and cooldown update have a recoverable ordering. Before committing, durably record a bounded attempt marker identifying the session, turn and guard, or use a host-owned durable transaction with equivalent recovery. If the marker cannot be recorded within the deadline, do not commit. This marker must not itself invalidate the control guard or include prompt content. On crash/reload, a pending marker is `indeterminate` unless an authoritative durable host result resolves it. Do not infer it was kept or start cooldown; suspend automatic routing and fail the host release gate as described in [host integration](host.md). Clear the marker only after a definitive outcome and its required state update are durable. Cleanup of deleted sessions must not race with a live session, a pending pin, or late commit. Cross-process or multi-window access must use a proven shared coordinator or fail closed; in-memory locks alone are insufficient when more than one process can mutate the same session. Document the final storage path and supported process model, and test crashes before marker persistence, before/after commit, before cooldown persistence and before acknowledgement. If the host and store cannot provide these guarantees under the shared deadline, automatic routing is unsupported.

## Inspection contract

Through a supported native path, show active enabled/paused state, profile, current pair, last proposed/applied/kept/indeterminate outcome, and bounded reason codes. Distinguish no role evidence, unavailable candidate or pin, explicit user choice, invalid config, unavailable state store, stale commit guard, unsupported host, and failure/timeout. An indeterminate outcome must never display as a successful keep or application. Inspection must not make a model call or display prompt text or credentials by default. A host that cannot load the plugin cannot expose this status; documentation must state compatibility instead.

## Acceptance

Test all rows above, including one-turn selection during a pin and restoration afterward, reload, restart behavior as documented, ambiguous origins, plugin-originated changes, stale pin, invalid config, profile edits, disable/re-enable, concurrent sessions and connection changes. Inject a pin, host picker change, disable, profile or preference update between decision and commit; each must invalidate the commit guard. Exercise write failure, missing/corrupt records, crash before/after acknowledgement, concurrent same-session turns, duplicate admission, deletion and multi-process races. A failed control operation must not trigger a model switch, destroy an existing pin, or be reported as successful.
