# v0.1 domain specifications

These specifications translate the [v0.1 PRD](../prd-v0.1.md) into implementable boundaries. They describe planned behavior, not implemented APIs. The PRD governs scope and release criteria if a spec is ambiguous; record and resolve contradictions before implementation. Host-specific mechanisms, public command names and persisted formats remain unverified; the versioned routing policy is a proposed implementation contract subject to the release evaluation.

| Domain | Responsibility | PRD |
| --- | --- | --- |
| [Host integration](host.md) | Lifecycle, host capabilities, dispatch, deadline and fallback | FR-1, FR-4 |
| [Catalog](catalog.md) | Connection-scoped model and variant facts, snapshots and validation | FR-2 |
| [Routing](routing.md) | Task evidence, role preferences, policy, context fit and cooldown | FR-3, FR-4 |
| [Controls and configuration](controls.md) | Profiles, explicit choices, pins, inspection and state isolation | FR-5 |
| [Observations](observations.md) | Opt-in local measurement and data lifecycle | FR-6 |
| [Verification and release](verification.md) | Host spike, test matrix, performance, evaluation and release gates | Sections 7–8 |

## Shared contracts

These are conceptual fields, not a promise about the OpenCode SDK or serialized shape:

- **Selection:** exact host provider ID, model ID, and either a host-validated variant or an explicitly verified model default. No credential is included.
- **Turn identity:** host-supplied session and turn IDs, with the active provider connection identity kept internal and scoped to that turn.
- **Decision:** `keep` or `select`, current selection, optional proposed selection, profile, stable reason codes and evidence provenance. `select` requires a currently eligible model and valid variant/default. `keep` never implies task success.
- **Catalog snapshot:** connection identity, revision or equivalent verified freshness token, eligible candidates and explicitly unknown fields. Do not treat a timestamp by itself as proof of current availability.
- **Commit guard:** original turn identity, current connection and catalog revision, plus a version covering current selection, user-origin/scope and all router controls. The host must atomically reject a stale guard or provide proven equivalent serialization; an adapter-side read alone is insufficient.
- **Outcome:** `kept`, `applied`, `failed/unsupported`, or `indeterminate`, with a reason and whether the original host request was observed when knowable. `indeterminate` means the adapter cannot establish whether an attempted change took effect; it is not equivalent to `kept`, `applied`, or task success. Do not replay, retry, or claim the original pair was preserved. Suspend further automatic changes, surface a bounded diagnostic, and treat any observed or possible indeterminate outcome as a failure of the host release gate until resolved and the full contract suite is rerun. Never infer a successful task from a successful dispatch.

Null/unknown is distinct from false, zero, empty, and unsupported. Host data is untrusted input; validation occurs at the boundary. Session and turn IDs must not be used as credentials and must not appear in default diagnostics. Configuration precedence and manual choice always outrank router policy. The host owns the user turn and request; a plugin must never create a replacement turn as a fallback. Contracts requiring capabilities not established by the spike are release gates, not claims that OpenCode currently exposes them.

## Delivery sequence

The pinned [host source review](../host-feasibility-v1.19.4.md) does not establish the required guarantees, and the proposed keyword classifier failed an [adversarial assessment](../classifier-assessment.md). Both are no-go for automatic routing, not completed host or live quality tests. Perform the pinned-host feasibility spike in [verification](verification.md) and evaluate a replacement policy before claiming automatic support. Recommendation-only catalog and policy work may proceed without mutating selections. Cross-domain tests must use the same fixtures and reason-code vocabulary.
