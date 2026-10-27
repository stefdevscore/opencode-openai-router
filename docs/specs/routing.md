# Routing policy specification

**Scope:** PRD FR-3 and the policy portion of FR-4. The routing core consumes validated facts and returns an explainable decision. It has no SDK, filesystem, credential, network, or UI dependency. It cannot itself dispatch or mutate a host selection.

## Inputs and output

Inputs are the current selection, eligible snapshot, profile and validated role/variant preferences, explicit selection/pin status, known task signals, effective context evidence, per-session cooldown state, and policy version. Session state is supplied by the caller, not stored in a global singleton. All task text needed to compute bounded in-memory signals is transient; no prompt or source content is persisted as an observation.

The output is `keep(current, reasons)` or `select(current, target, reasons, snapshot revision)`. The target is an eligible OpenAI model and a validated compatible variant or explicitly verified target default. A `keep` result is normal behavior, including when facts are unknown. Reason codes are stable and contain no prompt content. Identical inputs, policy version and session state must produce identical results; time-dependent inputs must be explicit.

## Policy order

1. Reject changes for disabled routing, unsupported host capability, unrelated provider, explicit turn selection, active pin/pause, or uncertain origin. The user-selected model **or** variant protects the entire pair for that turn.
2. Require connection-scoped eligibility and fresh snapshot evidence. Filter candidates using host constraints, verified variant/default semantics, and context fit. Context fit requires reliable current context estimate, target's effective connection limit, and host output reservation; their sum must fit. Missing evidence means keep.
3. Map a task to bounded, documented signals and thresholds. Ambiguous or contradictory evidence means keep; no single prompt length, model name, date, context size or price proves capability. Separate explicit user role preference from host facts.
4. Resolve roles from ordered user preferences or documented and tested host role evidence. Economy favors economy for straightforward work and may escalate for complex work; Balanced favors general; Quality favors complex when sufficient evidence exists. A missing role, stale preference or unsupported effort is reported and does not authorize a fabricated substitute. No mapping means keep.
5. Apply a cooldown after an automatic change: keep current for the next two eligible user turns, unless an explicit user action takes precedence. At most one model/variant-pair change is allowed per turn. Update cooldown only from a confirmed `applied` outcome; a rejected, timed-out, or indeterminate proposal must not start it. This is not a cache-hit claim.

On a model switch, keep the old variant only when the host confirms it is valid for the target; otherwise require a validated target variant or verified default under the PRD's rules. Unknown variant semantics cause keep, not an assumption based on its name.

## Policy v0.1.0: rejected automatic candidate

The adversarial [classifier assessment](../classifier-assessment.md) found false-simple cases. **Do not use this candidate to apply automatic changes.** The rules are retained for reproducibility and recommendation-only experiments; `keep current` is the safe behavior until a separately versioned replacement passes the host and paired quality gates. An always-keep implementation still does not qualify as automatic v0.1.

This deliberately conservative baseline is a proposed product rule, not evidence that keywords reliably measure coding difficulty. Evaluate only the current user message text, transiently. If it is unavailable, is longer than 4,096 Unicode code points, or contains non-text attachments whose content is not already represented in the bounded text, classify `unknown`; do not truncate and then guess. Normalize by Unicode NFKC and locale-independent lowercase; if the normalized result exceeds 4,096 code points, classify `unknown`. Split on every run of characters outside ASCII `a`–`z` and `0`–`9`, discard empty tokens, and match the following consecutive token sequences exactly. A match is a heuristic, not a safety classification or evidence of model capability:

| Class | Token sequences |
| --- | --- |
| `straightforward` | `rename`, `typo`, `format`, `spelling`, `explain this`, `summarize this` |
| `complex` | `architecture`, `security audit`, `root cause`, `multi file`, `cross service`, `migration plan` |

One or more matches in exactly one class give that class; no match or matches in both classes give `unknown`. Before matching, classify `unknown` if normalized text contains ASCII single/double quotes, backticks, Unicode left or right single/double quotation marks, or any standalone token `no`, `not`, `never`, `dont`, or `without`; this conservatively avoids treating quoted or negated instructions as positive evidence. A host-verified count of two or more failed attempts in the same session for the current task classifies `complex`, unless the text also matches `straightforward`, in which case classify `unknown`. The quotation/negation guard takes precedence over failure history. Failure history is usable only if the host can associate attempts with the same task; otherwise it is unknown. No model call is used. These rules are intentionally narrow; unrelated keyword occurrences, unsupported negations and languages may still be misclassified, so the frozen quality suite must include them. This policy is not approved for automatic release merely because fixtures pass; it must meet the live paired quality gate. Replace these rules only via a separately versioned policy and a full re-evaluation.

If task class is known, select the role by this table; `unknown` always keeps current:

| Profile | `straightforward` | `complex` |
| --- | --- | --- |
| Economy | economy | complex |
| Balanced | general | complex |
| Quality | complex | complex |

For the chosen role, examine the user-configured ordered list from first to last. Report a bounded stale-preference reason for entries known absent from a **complete** current snapshot or known ineligible, and choose the first entry with verified eligibility and context fit. Absence from an incomplete snapshot is unknown; if an earlier entry's eligibility or fit is unknown rather than known ineligible or too small, keep rather than skip uncertain evidence. If no user list is configured, use host role evidence only if its ordering and semantics have a documented tested contract; otherwise keep. A user ordering is a preference, not a claim of quality. Do not fall back to a different role, alphabetical order, or a newly discovered unranked model. If the chosen target equals the current model, a validated variant-only change is permitted; if the complete pair is unchanged, return `keep`.

Each role may optionally specify a preferred effort through an explicit variant-to-effort mapping; select the first user-ordered eligible variant mapped to that effort on the chosen model. A host's documented variant semantics may supply the mapping only when tested. No role effort preference means retain the current variant if valid on the chosen target and its semantics are trustworthy, or use a host-verified target default only when the user did not explicitly choose an effort. Missing, ambiguous or invalid mappings, incompatible existing variants, unknown variant semantics, and unknown default validity mean keep the entire original pair. The policy never derives effort meaning from an unknown variant's label.

Define an eligible cooldown turn as an original user turn in the same session and connection for which routing is enabled and unpaused, there is no explicit one-turn selection, host capabilities and selection origin are verified, and the active provider is eligible OpenAI. Count it once at terminal host admission, even when its decision is keep or evidence is insufficient. A cancelled turn, plugin-generated message, unrelated provider, explicit choice, or paused/disabled turn does not consume cooldown. After a confirmed automatic change, set the count to two; each subsequent eligible turn with a terminal admission decrements it once and cannot change the pair. The third eligible turn may route. If terminal admission cannot be observed reliably, keep and fail the affected host gate. The host/control guard must serialize concurrent turns and cooldown updates; a stale or duplicate turn must not decrement twice. Persistence and isolation are defined in [controls](controls.md).

Stable v0.1 reason codes are `disabled`, `unsupported_host`, `invalid_config`, `control_unknown`, `store_unavailable`, `manual_choice`, `session_paused`, `non_openai`, `catalog_unknown`, `catalog_stale`, `commit_stale`, `role_unknown`, `candidate_unavailable`, `preference_stale`, `task_unknown`, `context_unknown`, `context_exceeded`, `variant_unknown`, `cooldown`, `unchanged`, `selected`, `deadline`, `host_error`, and `indeterminate`. Multiple codes are sorted in the listed order; emit no arbitrary host text. The decision core emits codes for facts available to it; the host/control layer supplies commit, storage, timeout and indeterminate codes as outcome metadata rather than pretending they were known at decision time. `selected` denotes a proposal in a decision and must not be shown as `applied` without definitive host confirmation. A bounded code may be added only with a versioned schema change. Decisions do not contain raw matched words, prompt text, or credentials.

## Acceptance

Exercise every decision-table cell and reason code, NFKC/case and token boundaries, long input, attachment, negation and quotation, conflicting patterns, retry provenance, ordered stale/unknown entries, missing context and variant semantics, pair-level explicit overrides, and all cooldown boundaries including cancellation and duplicate/concurrent turns. Require policy fixtures for a model change, a separate variant change and `keep`, with exact expected outputs. A scripted host must observe at least one real model change and separately one real variant change. A fixture that only produces `keep` cannot satisfy v0.1.
