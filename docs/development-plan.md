# v0.1 development plan

Status: ready to begin scoped implementation. Production routing and release remain conditional on measured acceptance; this is not a claim that those features exist.

## Milestone 0: baseline and feasibility — core evidence obtained

Keep the plugin inert, preserve clean install/typecheck/test/audit/package checks, and reproduce the pinned [host probe](host-feasibility-v1.19.4.md). Basic catalog, model dispatch, effort lowering and follow-up behavior are observed. The [ADR](decisions/0001-turn-local-routing.md) removes the unnecessary global transaction prerequisite. The [review](review-synthesis.md) explains changes from historical drafts.

## Milestone 1: shared contracts, catalog and controls

Implement `src/catalog/` and `src/config/` with explicit unknowns, runtime validation, model/variant types and generation-based controls. Resolve one user configuration mechanism against the pinned loader. Use recommendation mode; do not change coding requests. Define agent-pin detection, role/effort mappings and catalog refresh/deduplication. Keep raw prompts and credentials out of storage.

Exit: fixtures cover complete/partial catalogs, disconnected OpenAI, custom variant settings, invalid configuration, unknown context, explicit input selection and configured agent pin. Inspection is possible without model inference. Config precedence/path and session-pin lifetime are documented. Pure contracts contain no SDK or filesystem dependencies.

## Milestone 2: evaluated recommendation policy

Create a versioned assessment design and implement `src/routing/`. Start with effort-only recommendations for the current model: unknown demand keeps; recognized complex/high-impact work may recommend a higher supported effort, but do not automatically downshift from a simplistic token. Add optional role-based model recommendations only with explicit user preference and compatible context. Do not revive the rejected keyword classifier. Define bounded features, task-context inputs, confidence/abstention, threshold values and fixture outputs in the policy change before merging it.

Exit: a held-out fixture set includes the historical counterexamples, mixed requests, code/quotes, ordinary bugs, long inputs, attachments and explicit selections. Each profile produces meaningful explainable differences where evidence supports them, and abstains elsewhere. Policy fixtures are behavioral tests with independently labeled examples, not implementation snapshots. Frozen live evaluation is prepared separately; no fabricated quality/savings claim.

## Milestone 3: narrow adapter and real-host suite

Implement `src/host/` and wire the thin `src/index.ts` entry. Complete the async work inside the budget, recheck generation and synchronously edit the pending pair once. Preserve explicit model/variant inputs and agent pins, and avoid the session picker/setter. Default to recommendations until acceptance and quality evidence justify auto mode.

Exit: actual pinned CLI flag tests, scripted-provider model/variant tests, original-message identity, tool loops, cancellation/late promise, config change during await, independent sessions, reload/pin lifetime and later-plugin conflict tests pass. Establish a tested supported-client boundary or an explicitly scoped user opt-in; the hook's omitted selection fields alone do not identify the client. Observed versus proposed results are distinct. Unsupported or unknown client intent retains the draft. No extra user turn, background mutation, credential read or alternate-model retry.

## Milestone 4: optional observations and live evaluation

Implement `src/observation/` after control and decision contracts stabilize. Test allowlisted fields, aliases, consent off, byte/count/age bounds, deletion and storage failures. Run the PRD's paired live quality suite only with explicitly authorized synthetic test access. Measure added latency with a local fixture and actual quality separately. Any policy changes after a failed evaluation require the full frozen suite again.

Exit: measured performance and paired outcomes meet the PRD, with missing data and sample limitations disclosed. Real ChatGPT compatibility is verified before claiming it. No token-to-allowance inference.

## Milestone 5: package and release

Finalize install/disable/remove and rollback instructions; update the development version only when acceptance is met. Implement build-once protected-main candidate artifacts, package/source digests, required environment approval and publish-the-tested-bytes. Keep the release job disabled until its non-production dry-run passes. Attestations are recommended hardening; a custom distributed approval system is out of scope.

Exit: clean archive installation, no stale/generated/private files, all gates on the exact candidate, correct tag/SHA and artifact digest, approval, rollback and public limitations documented. TUI/desktop/v2 and autonomous unranked-model ranking require later decisions, not silent scope expansion.
