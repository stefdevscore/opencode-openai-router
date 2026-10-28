# v0.1 implementation plan

Status: cut 1 is committed; cut 2 has an experimental native status dialog verified on OpenCode desktop 2.2.0 and awaits user QA. The earlier switching evidence targeted 2.1.4; 2.2 switching compatibility remains unverified. Later cuts remain planned. The product modes are `auto` (intended default) and `off`; there is no recommendation-only stage, manual role setup or model pin. No routing hook is registered. Develop actual automatic switching in isolated fixtures, with production release gated by [verification](specs/verification.md).

## 1. V2-only baseline and decision contracts — committed

The legacy entry, v1 dependency, normalizer and process-boundary code/tests are removed. The remaining dependency graph has no `toml` package, so the v1 overrides and parser-specific test were removed. Archived evidence and research tools remain historical. The old manual/agent-pin guard was removed; the pure effort function returns a select/keep decision and is not connected to the host.

Shared selection, task assessment, evidence snapshot, routing decision and observed outcome types use `keep` or `select` internally: this separates pure decisions from host effects and does not introduce a user recommendation mode. The parser accepts `auto`/`off` and has no manual roles. No routing hook is registered.

Exit evidence: clean locked install, zero audit vulnerabilities, types, focused unit tests and docs checks pass. The extracted package is independently loaded as an active plugin by the pinned 2.1.4 host alongside a local-provider fixture.

## 2. Controls and automatic host adapter

Implement one user-controlled configuration mechanism, effective off/enable/profile settings and deterministic inspection without inference. Prove the pinned loader's precedence/reload semantics before choosing plugin options or one dedicated user configuration source. No separate GUI framework, credentials or parallel configuration system.

Implement per-session admission identity, generation, serialization, deduplication, activity checks, deadlines and cleanup. Apply a native model/variant switch only for a validated eligible admission. Check controls immediately before issuance; disable stops new issuance but does not cancel an already-issued host operation or restore old selection. Keep on unknown timing; do not submit another prompt or implement alternate-model retries.

Use deterministic test decisions and a loopback provider to develop the real automatic switch immediately. Cover separate model and effort changes, persistence, no-op, off mode, active and queued input, same-session duplicates, independent sessions, timeout, delayed completion, cancellation, unload and later-plugin changes. Run the installed package in the actual desktop as well as CLI fixtures. Test account-backed OpenAI variants separately after local mechanics pass.

Exit: the [host contract](specs/host.md) and control tests pass; unverified paths keep their current selection. No all-keep fixture can count as switch acceptance.

## 3. Catalog, evidence lookup and model classification

Complete v2 provider-availability, modality, limit and variant normalization, freshness and single-flight refresh. Add [background evidence collection](specs/model-evidence.md), exact canonical identity, provenance, bounded cache and comparable profile ranking. No user role configuration is required. Unknown candidates are visible but do not receive invented ranks.

Prototype isolated native background classification through the existing connection before adding a new billing integration. Low-frequency classification is permitted with explicit enablement and a disclosed budget; no per-task classifier calls. Verify classifier isolation, bootstrap, recursion exclusion, structured-output validation, evidence grounding, fingerprints, batching, retries, allowance accounting and offline operation. Separate paid API/keyed-source integration is optional and deferred unless explicitly configured through supported host mechanisms. Do not claim source or transport availability without a working test.

Exit: new models can acquire validated assessments without a plugin release; duplicate/unchanged refresh spends no inference; missing evidence/budget retains a valid selection without blocking coding. Freeze held-out model evidence packets and independent expected constraints, then report classifier grounding, coverage and usage before allowing classifier-derived rankings to drive routing.

## 4. Local task policy and end-to-end routing

Specify bounded prompt/history inputs, truncation, confidence/abstention, profile differences and evidence requirements. Task assessment is local; the model classifier in step 3 evaluates models, not coding prompts. Do not ship the exploratory keyword rules. Do not infer quality from names or context size.

Freeze independently reviewed behavioral fixtures before tuning, including ordinary coding, mixed work, negation, quoted code, attachments, long context and high-impact cases. Join the local assessment with current host/evidence snapshots to make actual automatic selections. Profile tests must demonstrate meaningful model/effort differences where supported, and abstention where information is inadequate.

Exit: unit and installed-host fixtures show decision reasons, observed request pairs and mode behavior; no private task content is sent to the evidence/classifier service. Unknown outcomes remain unknown.

## 5. Measurements and release

Implement opt-in local observations after state contracts stabilize, independently of operational catalog/classifier caches. Test consent off, retention/count/byte bounds, corruption, deletion and late writes. Freeze the 30-task baseline/profile coding corpus, checks, environment and rerun rules before live comparison. Run with authorized synthetic test access and an agreed budget; include classification startup/amortized cost separately from per-task routing overhead.

Measure at least 100 paired warmed performance trials plus cold/timeout paths. Require the PRD's coding-regression and latency gates, installed-package/rollback checks, source/artifact evidence and a protected build-once release dry-run. Keep publication disabled until these pass. Neither the 500 human-time annotations nor the two-task live pilot replaces this evaluation.

## Delivery and dependencies

Each numbered stage is a reviewable change or small series of changes with its exit evidence. Stage 1 starts first. After its types stabilize, local catalog/policy work and adapter fixtures may proceed alongside the stage 3 classifier investigation. Final automatic activation joins the proven controls, adapter, catalog, evidence and policy; release requires stage 5. Missing transport or ranking data limits that path's automatic coverage rather than blocking unrelated implementation.

## User review and QA checkpoints

Develop one reviewable cut at a time. At the end of each cut, present the change, relevant diff, verification results, observed behavior and outstanding limitations. Stop for the user's review before advancing to the next cut; a passing automated test alone is not the user's acceptance. If a domain needs multiple cuts, each has its own checkpoint. A cut can be committed after its checks and user review; merging or publishing follows the user's instructions and the repository's release gates.

| Cut | Domain | User-visible review and QA checkpoint |
| --- | --- | --- |
| 1 | V2 foundation and shared contracts | Confirm the legacy runtime path is removed; review clean build, dependency audit, packaged entry and focused tests. Routing remains inert for this foundation cut. |
| 2 | Controls | Review the configuration schema and off/enable behavior; verify invalid config, reload, disabled mode and settings-change ordering. |
| 3 | Host switching | Observe actual model and variant changes with a local provider, persistence and disabled behavior; review concurrency, timeout and queued-turn evidence. |
| 4 | Catalog | Inspect normalized connected/available models and variants; verify stale, missing, malformed and removed models. |
| 5 | Model evidence and background classifier | Review source provenance, exact identity, cache and budget behavior; test new/unchanged models, unsupported evidence, classifier isolation and offline fallback. This cut does not claim universal ranking coverage. |
| 6 | Routing policy | Review profile decisions and reasons against independently labeled fixtures; verify abstention, context fit, nontrivial automatic switches and no paid call per coding task. |
| 7 | Observations | Review opt-in fields, retention, deletion and privacy tests; confirm collection off produces no automatic observation writes. |
| 8 | Integrated QA and release | Review installed desktop behavior, the frozen paired coding evaluation, latency and classifier overhead, known limitations and release dry-run before authorizing publication. |

The numbered implementation stages above describe dependencies; these cuts define the review units. Where a dependency is unfinished, a cut may use an explicit test double or a local fixture, with that limitation stated at the checkpoint. Automatic release remains gated until all relevant cuts and acceptance tests pass.
