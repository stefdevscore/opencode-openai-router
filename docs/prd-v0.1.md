# v0.1 product requirements

- Status: development baseline; production acceptance is not yet met.
- Date: 27 October 2026.
- Governing decisions: [ADR 0001](decisions/0001-turn-local-routing.md) for the v1 adapter and [ADR 0002](decisions/0002-opencode-v2-desktop.md) for the primary v2 desktop target.

## 1. Objective and present state

Choose an appropriate available OpenAI model and supported reasoning variant for a coding turn inside OpenCode, with minimal overhead and explicit user control. Preserve OpenCode's conversations, authentication, engine, permissions and normal request lifecycle. Successful completion matters more than reducing a single request's token count.

The plugin is currently inert. A development package version does not establish product readiness. This PRD replaces the earlier host-wide transaction proposal with the turn-local approach in ADR 0001. A recommendation preview is a development milestone, not a completed automatic v0.1.

## 2. Users and scope

The primary user has an existing OpenCode OpenAI connection, including ChatGPT sign-in where supported by the host. They want automatic effort/model choices, explanations, Economy/Balanced/Quality profiles and reliable manual overrides.

The primary target is OpenCode desktop 2.1.4 with its native v2 plugin API. Automatic desktop compatibility is not yet established: the v2 model-selection boundary and manual intent must be proven before activation. The 1.19.4 noninteractive CLI remains a separate, conditional compatibility target. TUI, interactive CLI, other host versions and providers are not implicitly supported. Unknown client selection intent means keep. A local scripted provider validates host mechanics, not real account access.

Discover candidates and variants dynamically. Automatic effort choices can use documented variant settings; cross-model selection uses optional explicit user model-role preferences because catalog metadata is not a quality ranking. Without role evidence retain the model. New unranked models become discoverable without a plugin release but are not assigned invented capability ranks. This limits zero-configuration model switching and must be stated in user documentation.

Out of scope: credentials, proxies, virtual router models, subagent orchestration, prompt injection, a separate interface, paid classification, plugin-owned provider retries, quota management, automatic self-training and ChatGPT allowance savings claims. The router is not a permission or command-safety system.

## 3. Functional requirements

| ID | Requirement | Acceptance |
| --- | --- | --- |
| FR-1 Host | Preserve the user selection and affect only the intended turn. The v1 adapter uses the awaited `chat.message` draft; v2 requires a separately verified native boundary. | Each supported host sends the intended pair to a local provider without overriding explicit choices or changing a following turn. Check message identity and tool-loop behavior. |
| FR-2 Catalog | Read host inventory and connected providers; use only OpenAI, enabled models and validated variants. Preserve unknown data and inventory completeness. | Added/removed/disabled/malformed models, partial discovery, disconnected providers and stale reads do not authorize an invalid pair. No shipped model-ID list. |
| FR-3 Assessment | Pure bounded local assessment returns recommendations and reasons. Unknown intent keeps. Model and effort decisions are distinct. | Versioned policy and fixtures cover normal coding, mixed/multi-step work, debugging, long context, negation, quotes, high-impact requests and unknown inputs. Do not reuse the rejected keyword policy. |
| FR-4 Application | Choose a host-listed pair under user preferences and context constraints. Explicit model or variant inputs protect the entire pair; configured agent model/pin wins. | Observe a real model change and separate effort-only change; test explicit model-only and variant-only selection, agent pin and incompatible target variants. |
| FR-5 Controls | Configuration and supported native commands provide mode, profile, preferences, pin and inspection. Invalid configuration disables mutation. | Document precedence and ordering; inspect without a model call; never acknowledge a failed setting update as successful. Unknown intent/surface keeps. |
| FR-6 Observations | Optional local aggregates default off, remain bounded and exclude prompts/code/credentials. Unknown measurements stay unknown. | Test consent, bounds, deletion, storage failures and late writes. Use opaque aliases if grouping is needed; an error-free response does not establish task success. |

## 4. Controls and ordering

Default enabled state is true on supported paths, profile Balanced, observations off. During development/recommendation mode no selections change. Enabled does not authorize a change without sufficient policy/catalog evidence.

Precedence is host constraints → explicit turn model or variant → configured agent model or pin → router session pin/disable → evaluated policy → unchanged draft. A user model or effort protects the complete pair. Do not infer intent by comparing model IDs or implement sticky picker workarounds. An explicit selection affects that turn; a session pin persists until explicitly cleared. Persistent settings and pins are distinct from optional observations.

For the v1 draft adapter, capture a local configuration generation at admission. Finish bounded reads, then recheck generation/deadline and perform at most one synchronous draft edit. Controls accepted before that check invalidate the proposal; controls accepted afterward govern subsequent admissions. This does not reverse an already admitted request or alter persistent host selection. Later plugins may edit the same draft; report observed dispatch mismatches without retrying or asserting exclusive ownership.

A two-eligible-turn cooldown may suppress repeated cross-model proposals, but must never force the router's prior model back into a subsequent turn. Effort-only decisions and explicit user selections are outside that model-switch cooldown. Count admitted turns once per session; update cooldown only on definitive dispatch evidence. Unknown evidence is not successful application.

## 5. Policy and context

Economy favors an explicitly preferred economical role on confidently straightforward work; Balanced favors general; Quality favors complex. Any profile may keep. Complex/high-impact/uncertain work must not be downshifted because a simple keyword occurs. Assessment is an evaluated heuristic, not a safety decision or proof of relative model quality.

Effort choices require supported variant settings with known reasoning semantics or explicit user mapping. Labels alone do not establish effort. Without trustworthy semantics retain the variant. On model changes require a compatible variant or documented target default; otherwise keep the complete pair. Preserve additional variant settings, not just reasoning effort.

Model roles are ordered discovered IDs for economy/general/complex. Missing or disabled entries produce diagnostics, never fabricated definitions/ranks. Do not silently skip an unknown candidate as if unavailable. Unknown target context or tool/input compatibility prevents a switch. Prefer equal-or-larger host-effective context limits; a smaller target requires reliable request token estimate plus output reserve and a documented margin. Effort-only selection must not silently alter context/output limits.

## 6. Failure, latency and privacy

Use a 200 ms decision-work budget, including reads. Discard timed-out results. For the v1 draft adapter, callbacks must never mutate a returned draft; complete or ignore async work before the final synchronous edit. This is a bounded plugin design, not a host-wide transaction or hard real-time promise. A connection change, stale inventory or remote quota failure may still cause an ordinary provider error. OpenCode owns those errors and its existing retries; the plugin never reads auth material, probes quota, replays a turn or switches models to retry it.

Persist no raw prompts, code, paths, credentials, arbitrary error strings or tool outputs. Collection off means no automatic observation writes; explicit deletion remains available. Purge-on-access retention is 30 days, at most 10,000 records and 10 MiB, maximum encoded record 1 KiB. Idle/disabled plugins do not guarantee timed deletion. See [observations](specs/observations.md).

## 7. Release acceptance

1. All unit, adapter, packaging and pinned-host tests pass. Cover overrides, agent pins, errors/timeouts, cancellation, late promises, concurrent sessions, reload, metadata, variants, tool loops and plugin ordering. Observe separate model and effort changes; distinguish normal multiple model calls in a tool loop from duplicate user-turn submission.
2. Measure at least 100 paired warmed trials plus cold/timeout cases on a documented machine. Report local decision and added dispatch median/p95, including catalog/control work. Targets are local p95 <50 ms and added dispatch p95 <250 ms; investigate misses before release. No real-time guarantee.
3. Before enabling released automatic policy, freeze 30 synthetic coding tasks with automated outcome checks and at least five each of straightforward changes, multi-file implementation, debugging and long-context/ambiguity. Predeclare high-impact cases, order and infrastructure/rerun rules. Compare unchanged baseline and each profile under equivalent account/tool/limits. Publish all pairs/attempts: no baseline-passing high-impact case may regress; at most one other baseline pass may regress per profile without offsetting against gains. Each profile must exercise a real change. Missing outcomes are incomplete. This is a provisional small-sample gate, not statistical proof or a savings claim.
4. Ordinary CI stays credential-free. Live quality evaluation and real ChatGPT compatibility need an explicitly authorized test connection/budget. These are release tasks, not blockers for pure-module development. Previews state what is unverified.
5. Build once from the tested commit, check package install/contents/rollback, bind source/package SHA-256 and evidence, and require maintainer approval. Publish the tested bytes. Matching tag/version alone is insufficient. The release job stays disabled until implemented and dry-run. Attestations are recommended provenance hardening, not a bespoke approval ledger or proof of quality.

## 8. Development readiness and sources

Follow the [development plan](development-plan.md). [v1 runtime evidence](host-feasibility-v1.19.4.md) verifies basic local-provider dispatch/catalog behavior. [v2 evidence](host-feasibility-v2.1.4.md) covers plugin loading, catalog access and a real connection smoke test, not router behavior or policy quality. Build shared types, catalog normalization, config validation and recommendation fixtures first; the narrow adapter and host integration suite follow; optional measurements and release packaging come last.

Pinned upstream sources: [hook contract](https://github.com/anomalyco/opencode/blob/148842ef7cb1bc34192b3fff57d0f9721ab9c801/packages/plugin/src/index.ts), [prompt lifecycle](https://github.com/anomalyco/opencode/blob/148842ef7cb1bc34192b3fff57d0f9721ab9c801/packages/opencode/src/session/prompt.ts), [CLI inputs](https://github.com/anomalyco/opencode/blob/148842ef7cb1bc34192b3fff57d0f9721ab9c801/packages/opencode/src/cli/cmd/run.ts). Official [plugins](https://opencode.ai/docs/plugins/), [models](https://opencode.ai/docs/models/) and [SDK](https://opencode.ai/docs/sdk/) describe interfaces, not entitlement guarantees. [Review synthesis](review-synthesis.md) records the revisions and remaining tests.
