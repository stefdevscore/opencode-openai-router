# Proposed OpenCode admission and switch boundary

This is a proposal for upstream collaboration, not an API that OpenCode currently provides. It is based on the [2.2.0 activity probe](v2-host-adapter-2.2.0.md) and does not authorize production switching.

## Required behavior

A plugin needs a host-owned operation that conditionally selects a model and variant for a specific eligible admission. The operation must compare the admission identity, session selection and an opaque state revision, and establish that the target admission is the only eligible pending user input and that no execution or shell activity is active. Checking these conditions and committing the selection must be serialized with session admission, delivery, execution start, cancellation and other selection changes. If any precondition fails, it returns a definite non-application result and leaves the selection unchanged.

The host should expose a snapshot or hook context with an opaque revision covering those conditions; the revision is meaningful only to the host, not inferred from event arrival order. An operation could take `{ sessionID, messageID, expectedRevision, expectedSelection, targetSelection }` and return `applied`, `unchanged` or a bounded `rejected` reason. The host validates target availability and supported variant. A later plugin or user action may change the selection after the operation; dispatch observation must remain separate from switch acceptance.

A pre-dispatch hook with equivalent ordering is another possible design. Neither proposal assumes that independently querying the session and inbox makes a conditional switch atomic. The implementation must not hold a session lock across arbitrary plugin calls or network inference. A plugin computes a proposal outside the critical section; the host then validates the revision and applies or rejects it inside the critical section.

## Integration points to investigate

At upstream `dev` revision `a97dc23` (the relevant files are identical to the 2.2.0 tag), `Session.prompt` prepares plugin hooks before durable inbox admission, then wakes execution. `SessionRunCoordinator` owns a process-local busy period and schedules its drain; `SessionInbox.promote` separately serializes inbox promotion with a keyed mutex. `SessionRunner.advanceToStep` currently selects context before promoting input, then loads that selection for a step. A host-owned hook at or near promotion would therefore need to carry the promoted admission identity, preserve control-item priority, and re-read or deliberately resolve the accepted selection before loading the step. The promoted count alone is insufficient when multiple steers are delivered together.

The inbox mutex does not by itself serialize model switches or the execution coordinator. Adding a lock around a plugin-side status read would therefore not satisfy the contract. A complete implementation must identify a shared ordering authority across admission, promotion, execution ownership and selection events, including existing direct switch callers, rather than assuming those existing mechanisms form one transaction. Process-local ownership and restart recovery also need explicit semantics; the current execution claim is not clustered fencing.

## Lifecycle and failure semantics

The host must define when an admission becomes eligible, how its identity survives retries, what happens if the admission is cancelled, and how long its revision remains valid. It must define whether a cancellation or transport failure means definitely not applied or unknown. An unknown result cannot trigger an automatic retry or another switch for that session until reconciled by a documented host operation. The plugin's own config generation is checked immediately before issuing the host operation; a configuration change after issuance cannot undo an already accepted operation.

This contract avoids requiring a classifier or a user prompt inside the critical section. It does not request access to credentials or private conversation content. It does not require OpenCode to prevent subsequent changes by other plugins or the user.

## Acceptance tests for a host implementation

- Idle eligible admission: one model switch and a separate variant-only switch; verify provider dispatch, desktop picker and next-turn persistence.
- Active execution, queued input, shell activity, cancellation, duplicate ID and stale revision: reject without changing selection.
- Simultaneous admissions and competing model changes: at most one eligible atomic result; no stale proposal changes another turn.
- Plugin unload, deadline and disable before issuance: no new switch. Distinguish a definite rejection from an issued operation whose response is lost.
- Verify other plugins' changes after acceptance are visible as later host state; do not report an observed dispatch from switch acceptance alone.
- Test startup, reconnect and event loss so a plugin cannot mistake incomplete event history for an idle snapshot.

The acceptance suite requires actual host integration and an isolated desktop, not only mocks. Upstream API naming and implementation remain subject to OpenCode maintainers' design.
