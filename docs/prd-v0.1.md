# Product requirements: v0.1

- **Status:** Proposed v0.1 release contract; host feasibility unverified
- **Research snapshot:** 27 October 2026
- **Product:** opencode-openai-router

## 1. Summary

Build a lightweight OpenCode plugin that chooses an appropriate available OpenAI model and reasoning variant for coding tasks, while preserving the user's explicit choices and OpenCode's existing workflow. The v0.1 objective is automatic, conservative routing with an inspectable explanation and safe fallback. It uses OpenCode's existing provider connection and runs assessment locally; it does not introduce another model service or manage credentials.

The current repository is an inert scaffold, despite its package version being `0.1.0`. This PRD describes the **target v0.1 product**, not functionality that exists today. A release called v0.1 must meet the release gates below. A recommendation-only build may be distributed as a clearly labeled preview if automatic routing cannot be proven safe; it must not be represented as satisfying the automatic-routing objective.

The [domain specifications](specs/README.md) derive implementation boundaries and verification from this PRD.

Current evidence blocks automatic release: the [1.19.4 source review](host-feasibility-v1.19.4.md) does not establish the required host guarantees, and the [keyword classifier assessment](classifier-assessment.md) found false-simple cases. Neither is a complete runtime host test or paired live quality evaluation.

## 2. Problem and users

OpenCode users often keep a single model and reasoning setting throughout a session even though task difficulty changes. Manual changes interrupt work and depend on the user knowing which models and variants are currently available. Excessive changes can also add latency or disrupt prompt-cache reuse. A router must help without silently overriding a deliberate choice or making claims about savings it cannot measure.

The primary user is a developer using OpenCode with an existing OpenAI connection, including a ChatGPT sign-in where supported by OpenCode. They want a suitable default with minimal intervention. A secondary user is an experienced developer who wants to inspect a decision, choose a profile, pin a model, or disable the router when diagnosing behavior.

## 3. Outcomes and scope

### Goals

1. Discover the current eligible OpenAI models and supported reasoning variants through the verified OpenCode host interface, without a hard-coded list of model IDs.
2. Assess each eligible user turn using bounded local signals and choose an available model and variant only when the evidence is sufficient; otherwise keep the current selection.
3. Apply decisions automatically on supported hosts, respect explicit overrides and pins, and fail safely without losing or duplicating a user turn.
4. Provide Economy, Balanced, and Quality profiles and a native, discoverable way to disable routing, pin a model, and inspect the latest decision.
5. Make decisions testable and explainable; optionally record minimal local observations for evaluation.

### Non-goals for v0.1

- Supporting non-OpenAI providers, generic OpenAI-compatible endpoints, provider proxies, credential storage, or account onboarding. Only a host-identified OpenAI provider is eligible; an OpenAI model exposed by another provider is outside this release.
- Replacing OpenCode's agent loop, spawning subagents, injecting a routing protocol into prompts, changing conversations or system instructions, or making paid classification calls.
- A separate application, dashboard, cloud analytics, automatic self-training, cross-user learning, or guaranteed cost and subscription savings.
- Automatically retrying a failed model request with a different model, changing a request mid-generation, or overriding a host's safety or permission decisions.
- Claiming support for every OpenCode release, v2 API, desktop client, model, or reasoning setting without verification.

## 4. Product decisions

| Decision | v0.1 requirement |
| --- | --- |
| Default mode | Automatic routing enabled on verified host versions only. On an unsupported host or when required capabilities cannot be established, retain the existing selection and report why if the plugin can safely load and expose inspection; otherwise the compatibility documentation provides the reason. |
| Default profile | Balanced. Economy favors a lower resource choice when evidence supports it; Quality favors capability when evidence supports it. Balanced avoids speculative changes. None overrides a pin or safety constraint. |
| Scope | Route only the current eligible user turn before dispatch. A decision must not leak into another session, provider, or later turn unless a verified host control explicitly defines that behavior and it is documented. |
| Manual control | A per-turn selection wins for that turn; a session picker change or explicit router pin pauses routing for the session until the user explicitly resumes it. When selection origin or scope cannot be distinguished, pause rather than guess. See the lifecycle below. |
| Missing evidence | Unknown is not false, zero, a ranking, or proof of access. No confident valid decision means keep current. |
| Observations | Off by default. When enabled, data is local, minimal, bounded, and user-deletable. |
| Delivery | A versioned installable artifact with documented host compatibility and rollback. npm publication is not assumed; choose and test a distribution method before release. |

The exact OpenCode control surface and plugin configuration format must be chosen after the host spike. The product requires the behaviors above; this document does not claim a particular command, hook, configuration key, or UI exists today.

### First feasibility target and decision owner

The first spike targets the **OpenCode 1.19.4 CLI**, with the matching `@opencode-ai/plugin` 1.19.4 contract, in an isolated test environment using a scripted provider. Both package versions exist in the npm registry; this is a research target, not a claim that the host implements the required hooks. The locally installed 1.3.13 is a separate, unverified version. The project maintainer owns the spike and records the exact host build, OS, plugin version, test commands, provider request evidence, and a pass/fail for each required capability in a checked-in compatibility report. The maintainer issues the go/no-go decision before implementation moves past the recommendation preview.

The initial release target is this CLI combination only if it passes; desktop, TUI-specific behavior, other versions, and v2 are unsupported until independently tested. If 1.19.4 fails, document the failing evidence and evaluate a new explicitly pinned candidate. If no candidate has a supported path for the original request, explicit controls, and safe rollback, v0.1 automatic release is blocked; a clearly labeled preview is the only deliverable. This target does not authorize modifying the user's global OpenCode installation.

### Selection and pin lifecycle

The following behavior applies only where the host exposes selection origin and scope reliably:

| Event | Required behavior |
| --- | --- |
| Session begins with a host default | Routing follows the configured enabled state; the existing selection is the fallback. A default is not a pin. |
| User explicitly selects model or variant for one turn | That selection wins for that turn, even when a session pin exists; the prior session routing state and pin resume on the next turn. |
| User changes the session picker or explicitly pins | Preserve the selection and pause routing for that session, including later turns and plugin reloads while the session exists. Do not change another session. |
| User explicitly resumes or unpins | Clear the router pause/pin; subsequent eligible turns can route. The user's current host selection remains the fallback. |
| Plugin is disabled | Preserve the host selection; re-enabling does not clear an existing session pin or pause. |
| Pinned model becomes unavailable | Surface the failure and retain the pin; do not substitute another model. |

If the host cannot identify whether a change is user-originated or distinguish its scope, the adapter must retain the selection and pause routing for the affected session; it must not interpret a plugin-originated change as a manual selection. A resume only clears the pause; it cannot establish the origin of future selections, and any new ambiguity pauses routing again. If the host cannot reliably detect the required origins and scopes in ordinary supported use, or cannot expose a reliable native resume or pin control, the surface fails the automatic-routing gate. Session state must not expose prompt content; any persistence is limited to what is needed for the lifecycle and is documented and tested separately from opt-in observations.

### Decision evidence and practical defaults

Treat evidence in this order: (1) host provider identity, connection/availability, model capabilities, context bounds and enabled variants are hard constraints; (2) explicit user selections and pins are authoritative; (3) optional user-provided role preferences supply an ordering for models already eligible under the host constraints; (4) host-provided model or variant semantics may be used only when the adapter can document and test their meaning. Price, name, release date, and context size are not capability rankings. The router never promotes an unknown model into a role merely because it appears in the catalog.

Support optional ordered user preferences for **economy**, **general**, and **complex** roles. Preferences are references to discovered models, not a shipped model list: validate on use, allow the same model in multiple roles, ignore no stale entries silently, and report missing/ineligible entries. A new model becomes discoverable automatically; it becomes routable by role only when the user assigns it or the host supplies documented, validated role evidence. With no role evidence, keep the current model and explain how to configure preferences; this means a default installation can legitimately be non-routing rather than invent a ranking.

For reasoning, use only variants that the host identifies as supported **and** whose semantics are known through documented host metadata or explicit user mapping. An unknown custom variant is never mapped to an effort level by its label alone. If no trustworthy variant mapping exists, keep the existing selection and report the reason; in particular, do not carry the current variant to a different model unless the host confirms it is valid for that model. An unspecified variant may be used only if the host proves the target's default is valid and the user did not explicitly select an effort. A one-turn explicit model **or** variant selection protects the whole model-and-variant pair for that turn; the router must not alter the other half.

Profiles use the same evidence: Economy prefers the economy role on straightforward tasks, Balanced prefers general, and Quality prefers complex when the classifier has sufficient evidence; on a complex task Economy may escalate to general or complex and never forces economy against a context or safety constraint. A role preference expresses the user's preference, not verified model quality. When a needed role, task classification, or context fit is unknown, keep current. Publish the exact bounded task signals, thresholds, hysteresis, and reason codes as part of implementation, with versioned fixtures; the profile labels do not themselves prove model quality.

For context fit, use the host's effective limit for the selected connection, not the model's advertised maximum. A switch is allowed only when the host exposes a reliable current context estimate, the target's effective limit, and the output reservation needed by the host, and their sum fits. An estimate is not a guarantee; a host context-overflow response is reported normally and must not trigger a hidden retry. If the inputs or comparison semantics are missing, keep current. The initial policy may change a model or variant at most once per user turn and must keep the current selection for at least the next two eligible user turns after an automatic change, unless an explicit user action takes precedence. Session boundaries and the method for counting eligible turns must be documented and tested. This cooldown is an overhead control, not proof of a cache hit.

## 5. Core user journeys

### Automatic selection

1. A developer connects OpenAI through OpenCode and enables the plugin using its documented installation method.
2. On an eligible turn, the plugin obtains the active selection and current eligible inventory. It assesses bounded task and session signals and produces a decision: select a specific available model and optional supported variant, or keep the existing selection.
3. The plugin applies a change only on a verified host path and only before the request is dispatched. The existing user turn proceeds once. The latest decision can be inspected without requiring a model call.
4. If discovery, assessment, validation, or a proven pre-commit operation fails, the plugin performs no mutation and the host's latest authoritative selection and original turn continue when the host permits. A newer user selection must never be overwritten with an earlier snapshot. An ambiguous application outcome is `indeterminate`, suspends automatic routing and fails the affected host's release gate; it is never reported as a proven keep. In all cases the plugin must not submit a replacement turn.

### Control and inspection

- The user can select Economy, Balanced, or Quality, and can disable and re-enable automatic routing using documented native host controls.
- The selection and pin lifecycle above determines when routing pauses and resumes. If pinning cannot be implemented without a separate interface, the host capability gate remains unmet.
- Inspection shows the active mode and profile, current selection, proposed/applied decision, whether it was applied or kept, and concise reason codes. It distinguishes missing information, a user override, unsupported host behavior, unavailable candidates, and errors. Inspection does not expose prompts or credentials by default.

## 6. Functional requirements and acceptance criteria

### FR-1 — Host compatibility and activation

- The release specifies an explicit, tested OpenCode version or version range and supported surfaces. Each supported combination must pass the host contract suite; installation must not imply that an untested desktop, CLI, or host version is supported.
- The adapter identifies whether discovery, decision application, user-override detection, and inspection are supported. If any capability required for safe application is unavailable or indeterminate, routing is non-mutating for the affected turn.
- The plugin uses OpenCode's existing authentication and must never read, store, or transmit credentials itself. It sends no prompt or conversation content to a classification endpoint.
- **Acceptance:** On a supported host, load and unload the packaged plugin without changing an unrelated turn. On an unsupported or unrecognized host that can safely load the plugin, it keeps the current selection, reports why, and does not block normal work. A host on which the package cannot load is documented as unsupported; no in-plugin diagnostic is promised there.

### FR-2 — Model discovery and validation

- Read the host's current connected OpenAI provider inventory and normalize provider/model identity, availability, context limits, capabilities, and variants only when supplied. Preserve unknown and unsupported as distinct states where the host provides that distinction.
- Honor host disablement, account/connection state, model retirement, and custom model/variant configuration. A listed candidate is not assumed usable merely because it appears in a catalog.
- Refresh according to a documented host-supported lifecycle and revalidate immediately before applying a choice. Avoid fixed model-ID lists as a release dependency. Never select an unverified non-OpenAI provider.
- Set a single 200 ms maximum routing decision deadline measured from plugin entry for the turn, including discovery, revalidation, local policy, durable attempt recording and application. Use a host-provided fresh snapshot only if its connection, revision, and eligibility can be validated under that deadline; stale or unverifiable snapshots cannot authorize a switch. On a proven pre-commit timeout, cancel or disregard late work, preserve the latest authoritative host selection, and emit a timeout reason. Application must use a host operation whose completion and rejection are observable within the deadline and whose effects cannot arrive after fallback; a timeout must never race a late mutation. Revalidation and application must atomically guard the original turn, connection, catalog revision, user selection and all routing controls, or provide proven equivalent serialization. If an outcome is ambiguous or the host cannot establish these guarantees, it fails the automatic-routing gate. Do not use a late result to change this or a later turn.
- **Acceptance:** Fixture and host tests cover an added model, a retired or disabled model, a missing connection, a changed catalog, an unknown capability, and an unsupported variant. None causes an invalid selection; a newly available eligible model can be considered without a plugin release.

### FR-3 — Task assessment and decision

- Use deterministic, bounded local signals available from the host, such as prompt length, explicit task intent, recent error/retry signals, and known context usage, without presuming that any single signal proves complexity or success. Do not persist raw prompt or source text as part of assessment.
- A decision includes the current selection, optional candidate and variant, profile, reason codes, and an explicit `keep current` result. It must not rank capability solely from a model name, release date, context limit, or price. When reliable relative capability data is absent, do not fabricate a hierarchy; preserve the selection unless another validated signal supports a safe decision.
- Account for context fit when sufficient trustworthy data is available. Keep the current selection when context fit cannot be determined and a change could truncate or exceed limits. Debounce unnecessary switching using documented session-level rules; cache effects may inform the policy but must not be reported as measured unless the host supplies evidence.
- **Acceptance:** A versioned, anonymized fixture corpus tests straightforward, complex, ambiguous, long-context, and repeated-failure cases. Identical inputs and session state yield identical decisions. Every selected candidate is in the current eligible inventory, and uncertain cases retain the original selection. Tests prove role preferences are validated, stale preferences are reported, new unranked models are not silently ranked, effective context fit and the cooldown are enforced, and profiles have documented, tested differences where evidence supports a choice.

### FR-4 — Applying model and effort

- Apply only a validated candidate to the original pending user request through a supported, tested host mechanism. A variant must come from that model's current eligible variants; custom variants cannot be assumed to correspond to standard effort names without metadata.
- Do not modify a different session, provider, turn, or user-selected pin. Preserve host semantics for tool calls, context, permissions, and errors. A rejected or stale decision must not cause a duplicate request or synthetic conversation turn.
- **Acceptance:** On every claimed automatic-routing host/surface, a scripted provider observes the actual model and variant received for the original request. The test adapter must simulate a host-identified OpenAI provider; this does not establish that a live OpenAI account has the same inventory or permissions. With a verified eligible two-model inventory, explicit role preferences, known context fit, and no override, at least one fixture must dispatch a model different from the original. A separate fixture with a verified two-variant mapping must dispatch a variant different from the original. Each asserts the applied value, decision reason and exactly one original request; an always-keep implementation fails. Tests also cover keeping current, unavailable models, incompatible old variants on a new model, invalid variants, simultaneous sessions, multi-turn behavior, a catalog change between validation and application, a timed-out operation completing late, host failures, and a manual override. Verify UI-visible state separately for each supported surface. If any required check fails, automatic routing is not enabled for that surface/version.

### FR-5 — Preferences, controls, and fallback

- Expose enabled/disabled, profile, session pin and unpin, and latest-decision inspection through supported OpenCode-native integration. Document scope, persistence across restarts, and precedence: host safety/availability → explicit user choice or pin → router policy → existing selection as fallback.
- Validate configuration with safe defaults; malformed or unreadable configuration never silently enables an unsafe mode. A pin that becomes unavailable is reported and never replaced with a model the user did not choose.
- **Acceptance:** Tests exercise every lifecycle transition above, including a one-turn selection followed by resumed routing, a session picker pause across a plugin reload, explicit resume, ambiguous selection origin, plugin-originated selection, stale pin, disable/re-enable with a pin, invalid configuration, and isolation of two sessions. Failed routing does not interrupt an otherwise valid host request.

### FR-6 — Local observations and privacy

- Observation collection is opt-in and off by default. If enabled, collect only available, bounded decision and outcome fields needed for evaluation: timestamp, pseudonymous session correlation if needed, selected model/variant, profile, decision and reason codes, host-reported token counts, elapsed time, and coarse error/retry or explicitly verifiable outcome signals. Unknown measurements remain unknown. Do not collect prompts, source content, file paths, credentials, or raw tool output.
- Document the local path, schema version, maximum size or retention period, permissions supported by the platform, disable behavior, and how to inspect and delete records. Handle corrupt or unwritable storage without blocking the turn. No network upload or silent migration.
- **Acceptance:** With observations off, no observation file is created or automatically updated; a user may still explicitly delete existing records. With observations on, a fixture test checks field allowlisting, retention, deletion, corrupt storage, and failures. Counts are only recorded where the host supplies them; a model response or lack of error alone is not labeled a successful task outcome.

## 7. Quality, measurement, and rollout

### Release evidence

| Measure | v0.1 release criterion |
| --- | --- |
| Correctness and control | 100% pass for required host, routing, override, fallback, and isolation acceptance tests on each claimed host/surface, including the two non-no-op dispatch fixtures in FR-4. No known case of a duplicate or dropped user turn caused by routing. |
| Availability | 100% of selected candidates in automated tests are host-eligible at application time; unverified eligibility results in keeping current. |
| Determinism | The decision fixture corpus produces repeatable results for identical inputs and configuration. |
| Privacy | Zero prompt, source, credential, or raw tool-output fields in the observation schema; collection off by default. |
| Performance | With at least 100 warmed paired trials on a documented reference machine and scripted host, report median and p95 for both local computation and added wall-clock time from turn entry to actual request dispatch versus the plugin-disabled baseline, including host discovery, validation, and timeout paths. Local computation must have p95 below 50 ms; added dispatch time must have p95 below 250 ms. Test cold, slow, unavailable, and stale catalog behavior separately, with delayed replies after the 200 ms deadline; none may cause a late switch or duplicate request. A failed threshold or inability to enforce safe timeout blocks automatic release. |
| Quality and efficiency | Meet the paired evaluation gate below. Report verifiable outcomes, model usage, retries, end-to-end latency, routing frequency, and missing data for each profile. No numerical improvement is promised until measured. Do not infer ChatGPT allowance savings from token counts or API pricing. |

Unit tests cover normalized catalog, policy, control precedence, and persistence. Integration tests use a scripted/local provider to verify the actual dispatched request and host lifecycle without paid credentials. A live authenticated evaluation is an explicit, separate release activity and is never required for ordinary CI; it uses only synthetic public fixtures and must not expose credentials or private conversation data. Packaging and installation are tested in a clean environment. CI runs install, audit, type checks, and tests; release automation must be verified end to end before the v0.1 release.

### Paired quality evaluation gate

Before the release candidate, freeze and version exactly 30 independent synthetic coding tasks with explicit automated pass/fail checks and no private source or prompt data. Include at least five tasks in each of straightforward changes, multi-file implementation, debugging, and long-context or ambiguity; mark safety-critical tasks in advance and define their independent checks. Record task definitions, evaluation environment, model availability, role mappings, profile, timeout, retry limits, order, and a predeclared rule for infrastructure failure and reruns. Use isolated, equivalent initial workspaces and the same connection, host version, tools, and limits for each pair; alternate or randomize execution order with a recorded seed. A human reviewer blinded to the run labels adjudicates test-infrastructure failures against the predeclared rule. Report every exclusion; an excluded or missing task makes the gate incomplete until the predeclared procedure yields a valid pair. Do not replace tasks after seeing results.

Run each task once with routing disabled using the same preselected baseline model and variant, and once with each v0.1 profile. Report results paired per task, including all failures, retries, model/variant decisions, missing values, and the actual number of switches. For each profile, no safety-critical task that passes the baseline may fail when routed, and at most one non-critical task may pass the baseline and fail when routed; improvements on other tasks cannot offset a regression. Each profile must also exercise at least one real model or variant change in the evaluation; an all-keep run is inconclusive and blocks release. If required model access or any valid paired outcome is missing, the gate is **incomplete**, not a pass. Preserve and publish all attempts. If a candidate fails, investigate and fix it; any new candidate must run the entire frozen suite under the same predeclared procedure, not a selected subset. Model and task variability remain limitations of this small one-run comparison.

These are provisional release thresholds, not statistical proof of non-inferiority or a claim of production savings. The maintainer publishes the full aggregate and paired result with exclusions, notes variability and sample size, and makes the release decision. If a representative live evaluation cannot be performed, do not claim this gate passed; ship only the clearly labeled preview. An authenticated release evaluation requires an explicitly authorized test account or test budget; neither ordinary CI nor the plugin performs a paid classification call.

### Staged delivery

1. **Host feasibility:** the maintainer tests OpenCode 1.19.4 CLI with matching plugin types first, records the capability report and go/no-go described above, and validates discovery, actual model and variant dispatch, override detection, inspection, timeout, error handling, and session isolation. If no safe automatic path exists, stop automatic release work and offer an explicitly labeled recommendation-only preview while pursuing an upstream-supported solution.
2. **Recommendation preview:** implement normalization, deterministic policy, profiles, inspection, and fixtures with no selection changes. Exercise missing and changing catalog data.
3. **Automatic routing:** enable only for combinations that pass FR-1 through FR-5. Default to Balanced on these verified combinations; retain the current selection elsewhere.
4. **Measurement and release:** add optional local observations, baseline evaluation, clean installation, release verification, and user documentation. Publish only after the release criteria pass.

## 8. Risks and unresolved questions

| Risk or question | Resolution required |
| --- | --- |
| Can a v1 plugin select the model for the original pending turn and identify explicit user choices? | Prove in the actual target version with a scripted provider and UI/CLI tests. A [v1.15.7 issue report](https://github.com/anomalyco/opencode/issues/28901) found no effective pre-dispatch model override in its tested lifecycle; it is evidence of risk, not proof about every version. |
| What versions and surfaces are supported? | Test the 1.19.4 CLI first; the local host previously reported 1.3.13. Do not assume either is supported. OpenCode v2 uses a [different plugin API](https://dev.opencode.ai/v2/docs/build/plugins/migrate-v1) and needs independent evidence. |
| Can catalog metadata support automatic ranking? | Inspect real inventory for the connected account. The specified role-preference fallback makes an explicit user ordering possible without shipped model lists; absent preferences or verified host role metadata, keep current and explain why. |
| Can manual overrides and session pins be observed and enforced? | Verify host behavior and persistence semantics. If not, disable automatic changes in the ambiguous case. |
| What are the actual controls and storage location? | Choose only after confirming available native surfaces and platform conventions; document configuration precedence, persistence, privacy, and deletion before release. |
| Can outcomes, latency, and usage be measured consistently? | Treat missing data as unknown and use verifiable outcomes only. Establish a baseline before claiming improved efficiency or completion. |
| Are there reliable model/variant availability signals for a specific connection? | Verify with host and account behavior; catalog membership alone is insufficient. |

## 9. Research and source notes

- [OpenCode plugin documentation](https://opencode.ai/docs/plugins/) describes plugin loading and host integration. It does not by itself prove model switching for an in-flight turn.
- [OpenCode model documentation](https://opencode.ai/docs/models/) describes model-specific and custom variants; variant names and availability cannot be assumed uniform.
- [OpenCode plugin hook types](https://github.com/anomalyco/opencode/blob/dev/packages/plugin/src/index.ts) show the shape of `chat.message` and `chat.params`, but types alone do not establish runtime dispatch or override behavior.
- [OpenCode v2 server plugin documentation](https://dev.opencode.ai/v2/docs/build/plugins/server) describes separate model and session APIs; it is a research reference, not a v1 compatibility guarantee.
- The repository's [architecture abstract](architecture.md) and [research note](research.md) contain the product boundaries and plugin comparisons. Repository star counts in that note are historical snapshots, not adoption or performance evidence.
