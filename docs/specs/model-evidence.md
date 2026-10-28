# Model evidence and background classification

Status: planned v0.1 contract. Retrieval sources, classifier transport and ranking quality require implementation verification.

## Responsibility

On new or materially changed OpenAI models, collect public evidence and optionally use a model to interpret it into a cached capability assessment. Users do not need to assign model roles. Coding-task assessment remains local; the background classifier does not run for each prompt. The host catalog alone authorizes selectable models and variants, not external scores or classifier output.

## Evidence and inference

Use host metadata for canonical identity, tools, modalities, limits and variants. Retrieve attributable public model documentation and coding evaluations where available. Provider guidance, independent benchmarks, measured local outcomes and model-generated interpretation must be distinguishable. Prefer documented structured sources; a bounded adapter or classifier may extract information from retrieved prose, but extracted claims require source references and validation. Evidence contents are untrusted data, never executable instructions.

A low-frequency inference call is an allowed design option, replacing the earlier blanket prohibition on paid classification. Prefer an isolated background generation through the existing OpenCode connection if the pinned host supports it without affecting coding conversations or session selection. This path consumes normal allowance. A separate paid API or keyed data source is optional future integration, not a v0.1 requirement; it must use an explicitly configured, host-managed connection and budget, never repurpose ChatGPT credentials as API credentials. No new billing path is selected silently. Provider choice and source coverage remain implementation deliverables, not proven capabilities.

Classification must be explicitly enabled with a disclosed budget before consuming allowance. The default automatic router can use cached/direct evidence and keep the host selection when adequate evidence is unavailable. This is not a recommendation mode: eligible routing decisions still apply automatically. Neither background inference nor evidence lookup blocks a coding turn. Lack of a classifier budget does not disable the router or initiate repeated setup prompts.

## Trigger, cache and output

Fingerprint canonical model identity/version, routing-relevant catalog settings, evidence content hashes, classifier identity and prompt/schema version. Classify on a new fingerprint; do not classify merely because a catalog was fetched, a session started or a TTL elapsed. Batch multiple changed models within input/output limits. Deduplicate in-flight work, bound retries and negative-cache unavailable evidence. Periodic retrieval may discover changed evidence, but unchanged content must not cause additional inference. Exact refresh intervals, size/token bounds, retry caps and budget reservation rules must be specified and tested in the implementation change.

Return a strictly validated structure containing exact candidate identity, task-class suitability, supported evidence references, comparative strengths/limitations, uncertainty, classifier/prompt version and retrieval times. Rank only host-listed candidates. Do not accept invented models, capabilities, sources, prices or benchmark results. The classifier may return insufficient evidence. Its self-reported confidence is not a calibrated success probability, and schema validity does not prove factual correctness.

Bootstrap the classifier from a separately validated host-connected OpenAI generation path; do not rely on a new candidate classifying itself, infer classifier quality from a model name, or recursively invoke discovery/classification from classifier sessions. Record the selected classifier separately from the routed model. If bootstrap or isolation cannot be verified, perform no classification and keep using valid cached/direct evidence.

Cache bounded validated assessments with provenance and fingerprints. Evidence expiry, removal or conflict invalidates the affected rank; it must not erase the last known record's provenance. Only future admissions use refreshed evidence. Lookup and classification cannot change an active conversation or apply a delayed routing decision. Use timeouts, bounded downloads, backoff and last-valid cache behavior; offline operation retains the host selection when no adequate candidate evidence exists.

## Identity, ranking and privacy

Require exact provider/model/version correspondence, including reasoning configuration when it changes evaluation meaning. Use documented canonical identity or a source-provided explicit mapping; display-name or fuzzy matching is insufficient. Avoid sending custom aliases or arbitrary host identifiers externally: resolve to a verified public model identity first, otherwise leave it unverified.

Compare scores only when benchmark version, settings and agent/tool conditions are compatible. Produce provisional task-class/profile rankings with traceable reasons, not a universal best-model score. Economy balances sufficient capability and measured efficiency; Quality favors supported capability; Balanced balances both. API prices and token counts do not measure ChatGPT allowance savings. Downshifts on weak evidence, particularly for uncertain/high-impact tasks, are not justified by a classifier's assertion.

No coding prompts, source, paths, private conversation, account identifiers, credentials or raw errors enter lookup/classification requests or caches. The cache stores only required public canonical identity, bounded assessment and provenance; it is operational state separate from optional observations. Optional synthetic model calibration is separate again: it runs a frozen suite only with a disclosed allowance budget and user authorization, and must not touch private projects.

## Acceptance

- Prove at least one source adapter with exact identity, documented format/terms, attribution and tested coverage. Prove isolated native classifier invocation or document why it is unavailable. Do not claim universal zero-configuration coverage if new models lack usable evidence.
- Test add/change/remove, aliases, malformed and conflicting evidence, benchmark mismatch, malicious text, fabricated citations, unknown or unsupported variants, refusals, invalid/partial output and insufficient evidence. Verify evidence before it can authorize a switch.
- Test cache fingerprints, unchanged refresh, batch size, concurrent discovery, negative cache, retry exhaustion, offline startup, disable/unload, budget exhaustion and duplicate callbacks. Reserve usage before dispatch, reconcile actual usage when exposed, and report unknown rather than claim exact spending when metering is incomplete. The configured budget must state its enforceable unit; a currency cap requires trustworthy rates and reservation accounting.
- Freeze a held-out set of model evidence packets and independently reviewed expected claim/identity constraints before tuning. Measure grounded-claim errors, unsupported promotions/demotions, identity accuracy, abstention, coverage, cache effectiveness and usage. Include newly introduced models and equivalent names at different settings. Never validate rankings only by asking the same classifier to agree with itself.
- Evaluate actual automatic model/effort switches against the frozen coding corpus and report end-to-end regressions. Classification quality, local task-assessment quality and coding outcomes are separate tests. No result alone establishes savings or the globally best model.
