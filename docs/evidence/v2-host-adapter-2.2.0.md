# OpenCode 2.2.0 host adapter investigation

The packaged adapter was invoked by a test-only wrapper in a temporary standalone CLI environment with a loopback OpenAI-compatible provider. It used synthetic admission-safety evidence and a deterministic decision; the production plugin did not register the adapter. `probe-v2-host-adapter.mjs` runs three independent scenarios (`model`, `variant`, `off`).

- A switch from `probe-a` to `probe-b` reached the provider for the first prompt and the subsequent prompt.
- An effort-only switch on `probe-a` to the configured `high` variant reached the provider as `reasoning_effort: high` for the first and subsequent prompts.
- With the test control set to `off`, both prompts reached the provider on `probe-a` without a reasoning override.

The probe records model and effort only; it uses temporary HOME and XDG directories, no account credentials and no real model provider. These observations do not establish desktop behavior or safe concurrent admissions. The test controls and activity evidence are injected, not production host evidence.

## Admission boundary

The v2.2.0 tag resolves to `1097e2668b1e08ad63bdf0b1c4860b9bc01e420c`. In the pinned [session implementation](https://github.com/anomalyco/opencode/blob/1097e2668b1e08ad63bdf0b1c4860b9bc01e420c/packages/core/src/session/session.ts), the prompt hook runs during preparation before the new inbox item is admitted; the [hook event](https://github.com/anomalyco/opencode/blob/1097e2668b1e08ad63bdf0b1c4860b9bc01e420c/packages/core/src/session/prompt.ts) contains identity and delivery, but not an activity snapshot or cancellation signal. A `steer` delivery is therefore not proof of an idle session.

The 2.2 plugin SDK's `SessionDomain` omits `active` and `inbox` operations exposed by the separate client API. `session.get` supplies session selection but no execution state or queue snapshot. The event subscription API does not itself establish a race-free initial snapshot or make a switch conditional on unchanged session state. Native `switchModel` reads the session and publishes a selection event; it offers no conditional activity, queue or selection precondition. Even an independently obtained snapshot could become stale before issuance. This source analysis is a limit on the currently verified boundary, not proof that every possible host integration is impossible.

The independent [activity-boundary probe](../../scripts/probe-v2-activity-boundary.mjs) corroborates the distinction: with one provider request held open, the client API reported the session running and a queued input present. A further input reached the plugin hook with `delivery: steer`, and a deliberately unsafe fixture switch changed the session selection while the original request was still active. This confirms that `steer` alone cannot serve as evidence of an idle, queue-free session. The deliberate switch was confined to temporary data and a local provider; it did not use the production adapter or real credentials.

Until a supported boundary supplies adequate evidence or a host change provides atomic admission/switch semantics, the installed plugin must keep selections. Desktop model and variant switching, active/steer/queue, plugin ordering, interruption and real-account variant compatibility remain acceptance work. Tests of mocked state and a wrapper returning `valid: true` are not substitutes for those gates.

## Candidate host capability

A host-provided admission boundary could make an eligible selection conditional on the same admission identity, idle execution, queue state, current selection and catalog revision, with the check and switch serialized with competing admissions and selection changes. An alternative is a host-owned pre-dispatch hook that resolves the selection for the admitted turn and updates the native session selection at a proven safe point. Either design needs a documented lifetime and cancellation contract and a way to distinguish acceptance from actual provider dispatch. Merely adding independent `active()` and `inbox.list()` reads to the plugin context would leave a time-of-check/time-of-use race.

After such a boundary is available, adapt the test fixture to use it rather than a synthetic `valid` callback, then repeat active/queued/concurrent cases, separate model and effort switches in an isolated desktop, and the account-backed variant checks described in the host specification. No upstream change is included in this repository.
