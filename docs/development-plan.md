# v0.1 development plan

Status: session-level automatic routing is the accepted product direction and scoped implementation may begin. See the [feasibility assessment](v2-product-feasibility.md). Automatic routing remains disabled until the host boundary, policy and release gates pass. OpenCode desktop 2.1.4 is the pinned initial target; its bundled CLI supports local server tests but does not substitute for desktop tests.

## 0. Retire v1 from the active product

Treat the v1 report, ADR, probe and tests as historical reference. Remove the v1 entry, dependency, normalizer, client-boundary code and dedicated tests in a focused implementation change after checking their dependencies; preserve any genuinely shared TOML coverage. Do not delete historical evidence merely to make the tree smaller. v1 compatibility is not an acceptance target and requires a new decision if reinstated.

## 1. Complete controls and the session-switch contract

The basic session switch and persistence have been observed in CLI and desktop fixtures. Complete the contract tests in the [host specification](specs/host.md) using the actual packaged plugin and a local provider. Implement the off/pin/inspection controls needed to test application ordering. Verify turn identity, protected agent pins, disable ordering, safe session state and subsequent-turn behavior for session-level switches. Manual picker choices may be overridden in auto mode. Unknown host state blocks that application, not pure-module or recommendation work.

Exit: a reproducible evidence report and contract test matrix with actual provider dispatch, desktop picker and subsequent-turn evidence. CLI evidence is not desktop evidence.

## 2. Complete catalog, controls and recommendation mode

Use the native v2 model/provider APIs and verified user configuration mechanism. Complete pure validation, freshness, preference mapping and decision reasons; keep unknown values explicit. Resolve native status/inspection and user controls without a model call. Recommendations do not mutate requests. Remove the unused v1 surface in this phase if not already done.

Exit: deterministic fixtures cover incomplete/disconnected/stale catalogs, variant semantics, unknown context, invalid controls and all override states. Load the actual packaged plugin in the pinned v2 host, exercise inspect and disposal, and verify no provider requests or observation writes are caused by inspection.

## 3. Develop and evaluate the policy

Design a bounded, versioned assessment with predeclared inputs, thresholds, confidence and abstention. Reject the old keyword-only classifier; never infer quality ranks from model IDs. Implement role-based model proposals only with explicit preference and validated context, and effort choices only with known variant semantics. Freeze independently labeled policy fixtures before tuning and hold out counterexamples. A proposed result is not an applied result.

Exit: profile-specific, nontrivial behavioral fixtures and abstention cases pass, including negation, quoted/code text, mixed requests, long context, disable/pin precedence and unknown data. Prepare the frozen live evaluation before running it.

## 4. Implement the proven adapter and local integration tests

After the relevant milestone 1 contract tests pass, wire the pure engine to the tested v2 boundary. Default to recommendation mode during development. Test actual provider model and effort, manual choices in auto and disabled modes, agent pins, subsequent turns, primary versus auxiliary requests, tool loops, plugin ordering, deadline and late promises, cancellation, concurrency and lifecycle. Validate the packaged plugin, not only a fixture wrapper. Unknown evidence keeps the host choice.

Exit: the complete [host matrix](specs/host.md) passes in the pinned server and representative desktop paths; no production mutation is enabled on an untested path.

## 5. Measurements and release

Implement optional local observations only after the contracts stabilize; consent defaults off. Run privacy and storage tests, at least 100 paired warmed performance trials, and the PRD's frozen 30-task paired live quality evaluation with a suitable authorized account and budget. A connectivity smoke test is not a quality evaluation. No savings claim follows from token counts.

Exit: all [verification gates](specs/verification.md) pass, the installed package and rollback are checked, and a protected build-once release workflow is dry-run. Keep publication disabled until then. Any missing desktop, policy, live or performance evidence keeps automatic release blocked.
