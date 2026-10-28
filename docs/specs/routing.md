# Routing decisions

Status: planned v0.1 contract. Existing research and scaffold utilities do not establish full acceptance.

## Pure contract

Input: immutable original pair, validated snapshot, agent context, configuration/profile, validated model-evidence snapshot and effort semantics, bounded task/context signals, configuration generation and session cooldown. Output: deterministic `keep` or `select`, proposed pair, ordered reason codes and policy version. SDK, disk, clock and UI access stay outside the pure function; pass timing/freshness as facts. No prompts or code are persisted.

## Decision order

1. Keep for disabled mode, unsupported origin, expired budget or stale configuration. In auto mode the policy chooses the model and effort; it does not treat a selected model or configured agent model as a pin.
2. Validate OpenAI connected inventory and candidate facts. Unknown or malformed host availability, required capability or safety facts prevent unsafe switches; incomplete quality evidence may yield an explicitly provisional estimate.
3. Assess task demand. **The old keyword-only policy is rejected**; [counterexamples](../history/keyword-classifier-assessment.md) remain regression cases. Implement the assessment for automatic application in isolated tests. Before automatic release, a versioned assessment design must define input bounds, features, thresholds and abstention rules and pass fixtures plus the live paired evaluation. This is a genuine implementation/evaluation task, not an unavailable host API.
4. Separate model and effort. Derive cross-model choices from the [model evidence lookup](model-evidence.md), using measured comparable results where possible and evaluated, explicitly labeled provisional estimates otherwise. No manual roles are required, and stale entries are reported. Exclude disabled/removed entries. Do not present ID, date, price or context size as a measured quality rank.
5. Resolve only supported effort settings or explicit mappings. Preserve full variant semantics and reject unapproved unrelated settings. A model change requires compatible target variant/default; uncertain compatibility keeps the original pair. Manual effort can be superseded while auto mode is enabled.

## Profiles and switching

Economy favors evidence-supported efficient candidates on confidently straightforward tasks; Balanced balances evidence-supported capability and efficiency; Quality favors evidence-supported capability. Complex/high-impact/uncertain tasks cannot be downshifted solely from `rename`, `format`, prompt length or another isolated token. This is resource selection, not permission approval. Profiles influence preference and thresholds; they do not prove model quality. Unknown demand keeps.

After an observed cross-model change, suppress new cross-model proposals for two subsequent eligible admissions in that session unless independently validated context/tool/input compatibility would require a different candidate; unknown task demand alone cannot bypass cooldown. A prior switch persists in the host session; use the host's current selection as the baseline and do not issue a redundant switch merely to retain it. Effort-only changes are not subject to this model-switch cooldown. Eligible admissions are original OpenAI user turns with routing enabled, verified host path and valid identity. Count once per message; cancel/retry/duplicate callbacks do not double-decrement. No authoritative observation means no claim of an applied switch; conservatively keep further model changes until the next independently validated admission/state reset. Session reload never recreates an old proposal.

## Reasons and tests

Use stable bounded reasons: `disabled`, `unsupported_origin`, `config_changed`, `invalid_config`, `catalog_unavailable`, `catalog_stale`, `disconnected`, `candidate_unavailable`, `model_evidence_unknown`, `task_unknown`, `context_unknown`, `context_exceeded`, `variant_unknown`, `cooldown`, `unchanged`, `proposed`, `deadline`, `host_error`, `dispatch_mismatch`, `dispatch_unknown`. Sort by this declared order. Host outcomes supplement decision reasons rather than pretending dispatch was known when assessing.

Fixtures must demonstrate all profiles, abstention, automatic decisions and disable precedence, counterexamples, mixed/quoted requests, new/unranked models, evidence ranking, variant-only decisions, model changes, context limits, cooldown and isolation. The old all-keep loophole is closed by real host model/effort tests and meaningful switches in the live evaluation. Exact classifier implementation is not finalized by a document claiming it is safe; its design and measured performance are a milestone exit requirement.
