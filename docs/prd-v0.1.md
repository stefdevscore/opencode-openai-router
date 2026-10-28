# v0.1 product requirements

- Status: development baseline; production acceptance is not yet met.
- Updated: 28 October 2026.
- Governing decision: [ADR 0002](decisions/0002-opencode-v2-desktop.md). v1 evidence and decisions are historical.

## 1. Objective and present state

Choose an appropriate available OpenAI model and supported reasoning variant for a coding turn inside OpenCode, with minimal overhead and explicit user control. Preserve OpenCode's conversations, authentication, engine, permissions and normal request lifecycle. Successful completion matters more than reducing a single request's token count.

The plugin currently implements controls and desktop status but does not route requests. A development package version does not establish product readiness. A session-level v2 switch has been demonstrated in a local desktop fixture; the adapter and safety gates remain unfinished. Development targets automatic switching directly, exercised first with local fixtures.

## 2. Users and scope

The primary user has an existing OpenCode OpenAI connection, including ChatGPT sign-in where supported by the host. They want automatic effort/model choices, explanations, Economy/Balanced/Quality profiles and an effective disable control for manual selection.

The development target is OpenCode desktop 2.2.0 with its native v2 plugin API, including its experimental GUI surface for status. Earlier native session-switch evidence is from 2.1.4 and must be reproduced on 2.2.0; full automatic desktop compatibility is not yet established. OpenCode v1 is outside v0.1 scope. TUI, interactive CLI, other host versions and providers are not implicitly supported. Manual selection intent need not be inferred in auto mode. A local scripted provider validates host mechanics, not real account access.

Discover candidates and variants dynamically. On new or changed models, perform a background lookup for structured evidence from reliable sources as defined in [model evidence](specs/model-evidence.md), without requiring user-assigned roles. Optional low-frequency classification can interpret retrieved evidence under an explicitly enabled allowance budget; it does not run on coding prompts. Combine only comparable, correctly identified evidence to make provisional profile choices. Missing or ambiguous evidence keeps a valid host selection while lookup retries; do not invent a rank. Optional local calibration may use the connected account only with explicit user consent and a disclosed allowance budget.

Out of scope: credentials, proxies, virtual router models, subagent orchestration, prompt injection, a separate interface, per-task paid classification, plugin-owned provider retries, quota management, automatic self-training and ChatGPT allowance savings claims. The router is not a permission or command-safety system.

## 3. Functional requirements

| ID | Requirement | Acceptance |
| --- | --- | --- |
| FR-1 Host | Use the native v2 session selection for eligible tasks. A switch may change the visible picker and persist to later turns. | Observe actual model, UI and subsequent-turn behavior; test safe timing, identity, concurrency and tool loops. |
| FR-2 Catalog | Read host inventory and connected providers; use only OpenAI, enabled models and validated variants. Preserve unknown data and inventory completeness. | Added/removed/disabled/malformed models, partial discovery, disconnected providers and stale reads do not authorize an invalid pair. No shipped model-ID list. |
| FR-3 Assessment | Pure bounded local assessment returns routing decisions and reasons. Unknown task demand keeps. Model and effort decisions are distinct. | Versioned policy and fixtures cover normal coding, mixed/multi-step work, debugging, long context, negation, quotes, high-impact requests and unknown inputs. Do not reuse the rejected keyword policy. |
| FR-4 Application | Choose a host-listed pair under user preferences and context constraints. Auto mode may override manual model/variant choices; disabled mode prevents router changes. | Observe separate model and effort changes, session persistence, disable behavior and incompatible target variants. |
| FR-5 Controls | Configuration and supported native commands provide mode, profile, preferences and inspection. Invalid configuration disables mutation. | Document precedence and ordering; inspect without a model call; never acknowledge a failed setting update as successful. Unsupported or unknown host state keeps. |
| FR-6 Observations | Optional local aggregates default off, remain bounded and exclude prompts/code/credentials. Unknown measurements stay unknown. | Test consent, bounds, deletion, storage failures and late writes. Use opaque aliases if grouping is needed; an error-free response does not establish task success. |
| FR-7 Model evidence | Retrieve model evidence on catalog changes and optionally classify it through a budgeted background call. No user-assigned roles or per-task classifier calls. | Exact identity and grounded output, cache/change deduplication, isolation, budget/off behavior and a model added without a plugin release. |

## 4. Controls and ordering

The plugin supports `auto` and `off`, with `auto` as the intended default, Balanced profile and observations off. Development uses isolated fixtures; automatic release requires all acceptance gates. Enabled does not authorize a change without sufficient policy/catalog evidence.

Precedence is host constraints → disabled mode → evaluated automatic policy → unchanged host selection. In auto mode the policy controls model and effort; disable routing for manual control. Agent configuration can inform task context but is not a manual model pin.

Capture a local configuration generation before bounded reads and recheck it at the verified v2 application boundary. Controls accepted before that check invalidate the proposal; later controls govern subsequent admissions. A native session switch can persist and affect ongoing work, so serialize admission decisions, gate on verified session state and treat a switch already issued before disable as potentially completing. Do not promise rollback; report observed dispatch mismatches where reliable evidence exists.

A two-eligible-turn cooldown suppresses repeated cross-model proposals unless independent validated evidence shows the retained model is incompatible with the new request. The host's current session selection is the baseline for each decision, including a selection left by a previous switch. Effort-only decisions are outside that model-switch cooldown. Count admitted turns once per session; update cooldown only on definitive dispatch evidence. Unknown evidence is not successful application.

## 5. Policy and context

Economy favors evidence-supported efficient choices on confidently straightforward work; Balanced balances capability and efficiency; Quality favors evidence-supported capability. Any profile may keep. Complex/high-impact/uncertain work must not be downshifted because a simple keyword occurs. Assessment is an evaluated heuristic, not a safety decision or proof of relative model quality.

Effort choices require supported variant settings with known reasoning semantics or explicit user mapping. Labels alone do not establish effort. Without trustworthy semantics retain the variant. On model changes require a compatible variant or documented target default; otherwise keep the complete pair. Preserve additional variant settings, not just reasoning effort.

Task-class suitability and profile ranking are derived from validated, attributable evidence where available. No user-assigned roles or model pins are required. Missing or disabled entries produce diagnostics, never fabricated definitions/ranks. An unknown candidate remains unranked; it need not block selection of a different candidate with sufficient evidence. Unknown target context or tool/input compatibility prevents a switch. Prefer equal-or-larger host-effective context limits; a smaller target requires reliable request token estimate plus output reserve and a documented margin. Effort-only selection must not silently alter context/output limits.

## 6. Failure, latency and privacy

Use a 200 ms decision-work budget, including local/cache reads. Evidence retrieval and model classification run independently in the background and are excluded from this per-turn budget, but their latency and usage must be measured separately. Discard timed-out results. Late decision results must never issue a new switch for a different or already-admitted turn. A switch issued before a timeout or disable may still complete; report its outcome as unknown until reconciled rather than claiming cancellation or rollback. This is a bounded plugin design, not a host-wide transaction or hard real-time promise. A connection change, stale inventory or remote quota failure may still cause an ordinary provider error. OpenCode owns those errors and its existing retries; the plugin never reads auth material, probes quota, replays a turn or switches models to retry it.

Persist no raw prompts, code, paths, credentials, arbitrary error strings or tool outputs. Collection off means no automatic observation writes; explicit deletion remains available. Purge-on-access retention is 30 days, at most 10,000 records and 10 MiB, maximum encoded record 1 KiB. Idle/disabled plugins do not guarantee timed deletion. See [observations](specs/observations.md).

## 7. Release acceptance

1. All unit, adapter, packaging and pinned-host tests pass. Cover disable behavior, configured agents, errors/timeouts, cancellation, late promises, concurrent sessions, reload, metadata, variants, tool loops and plugin ordering. Observe separate model and effort changes; distinguish normal multiple model calls in a tool loop from duplicate user-turn submission.
2. Measure at least 100 paired warmed trials plus cold/timeout cases on a documented machine. Report local decision and added dispatch median/p95, including catalog/control work. Targets are local p95 <50 ms and added dispatch p95 <250 ms; investigate misses before release. No real-time guarantee.
3. Before enabling released automatic policy, freeze 30 synthetic coding tasks with automated outcome checks and at least five each of straightforward changes, multi-file implementation, debugging and long-context/ambiguity. Predeclare high-impact cases, order and infrastructure/rerun rules. Compare unchanged baseline and each profile under equivalent account/tool/limits. Publish all pairs/attempts: no baseline-passing high-impact case may regress; at most one other baseline pass may regress per profile without offsetting against gains. Each profile must exercise a real change. Missing outcomes are incomplete. This is a provisional small-sample gate, not statistical proof or a savings claim.
4. Ordinary CI stays credential-free. Live quality evaluation and real ChatGPT compatibility need an explicitly authorized test connection/budget. These are release tasks, not blockers for pure-module development. Previews state what is unverified.
5. Validate model-evidence identity, provenance and classifier grounding on held-out evidence packets before using their rankings. Report abstention/coverage and refresh usage separately from task-assessment and coding quality.
6. Build once from the tested commit, check package install/contents/rollback, bind source/package SHA-256 and evidence, and require maintainer approval. Publish the tested bytes. Matching tag/version alone is insufficient. The release job stays disabled until implemented and dry-run. Attestations are recommended provenance hardening, not a bespoke approval ledger or proof of quality.

## 8. Development readiness and sources

Follow the [development plan](development-plan.md). [v2 evidence](host-feasibility-v2.1.4.md) covers the initial loading/catalog probe. The [feasibility assessment](v2-product-feasibility.md) records subsequent desktop session-switch experiments, independent difficulty annotations and a small live coding pilot; none establishes a production router or policy quality. Build shared types, catalog normalization, config validation, automatic decision policy and the host adapter with integration tests; measurements and release packaging follow.

Official v2 [plugin overview](https://opencode.ai/v2/docs/build/plugins/) and [server API](https://opencode.ai/v2/docs/build/plugins/server/) describe current interfaces, not proof of behavior in the pinned desktop version or entitlement guarantees. [Review synthesis](review-synthesis.md) records the revisions and remaining tests.
