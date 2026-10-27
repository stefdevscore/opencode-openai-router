# OpenCode 1.19.4 feasibility: source review

- **Date:** 27 October 2026
**Verdict:** No-go for automatic routing under the v0.1 safety contract; runtime integration remains unverified.

This is a source review, not the scripted-host spike or a claim that all relevant OpenCode APIs have been exhaustively searched. It does not test a live account, UI, CLI invocation, credentials, concurrency, or actual model requests. The pinned upstream tag `v1.19.4` resolved to commit `148842ef7cb1bc34192b3fff57d0f9721ab9c801`. Source links below use that commit, rather than a moving branch.

## Evidence

- In the pinned [plugin hook definition](https://github.com/anomalyco/opencode/blob/148842ef7cb1bc34192b3fff57d0f9721ab9c801/packages/plugin/src/index.ts), `chat.message` receives input selection fields and an output user message and parts; the declared hook shape does not itself describe an atomic guarded-commit API, a deadline, catalog revision, or explicit selection origin.
- In the pinned [prompt implementation](https://github.com/anomalyco/opencode/blob/148842ef7cb1bc34192b3fff57d0f9721ab9c801/packages/opencode/src/session/prompt.ts), OpenCode resolves an input/agent/session model and variant, constructs the user message, and updates session agent/model state before invoking `chat.message`. It invokes the hook with the message object and subsequently saves that object. Later, the loop looks up the model from the saved latest user message. This supports the **hypothesis** that mutating the output user message can affect that turn; it does not establish actual provider dispatch, variant behavior, user-override semantics, rollback, or UI consistency.
- The same hook's `model` and `variant` inputs originate from prompt input. The source reviewed does not establish that their presence distinguishes a user picker action from a CLI/client-provided default. The hook type does not itself provide a selection origin or a scope identifier.
- The paths examined do not document a single atomic comparison across turn, selection, router controls, connection, catalog revision and deadline. The `chat.message` hook may be able to mutate an object, but that is not evidence that a late mutation is impossible or that an intervening user action is atomically protected. The catalog evidence and native controls required by the specs have not been demonstrated.
- The [upstream issue on active model state](https://github.com/anomalyco/opencode/issues/18644) describes per-turn output-message mutation and a distinction from active UI model state. A separate [issue reporting v1.15.7 behavior](https://github.com/anomalyco/opencode/issues/28901) reports a different experiment and outcome. These reports concern different questions and do not substitute for a test of the pinned build.

## Decision and next evidence

The automatic-routing gate is **not met** for 1.19.4. Do not ship it as a supported automatic host based on these observations. A recommendation-only preview can proceed only if it can safely load and inspect without changing the host selection, and must make that limitation clear.

To reassess the no-go, run the complete [host spike](specs/verification.md#first-host-spike) against a pinned isolated host and scripted provider. In particular, obtain actual dispatched model/variant evidence, catalog and account eligibility semantics, native pin/resume behavior, selection-origin signals, and race-free guarded commit and deadline evidence. If any mandatory guarantee is absent, an upstream-supported API or a separately verified host version is required; mutating `output.message.model` alone is insufficient. Account-specific behavior requires separately authorized live evaluation.
