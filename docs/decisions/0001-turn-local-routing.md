# ADR 0001: use a turn-local plugin boundary

- Status: accepted for the v1 adapter; [ADR 0002](0002-opencode-v2-desktop.md) defines the primary v2 desktop target. Automatic release requires the remaining tests.
- Date: 27 October 2026.
- Governs: [PRD](../prd-v0.1.md) and [specifications](../specs/README.md).

## Decision

Build one TypeScript package around a pure decision engine and a thin OpenCode 1.19.4 adapter. Change only the pending user message's model/variant pair inside the awaited `chat.message` hook, with one synchronous mutation after all reads and checks finish. Do not call a session model setter, update the picker, add a virtual provider, submit a second prompt, or persist a commit journal.

Initially support noninteractive `opencode run` and its server prompt path. An explicit prompt model or variant protects the complete pair; a configured agent model is also a pin. TUI and desktop routing are outside the automatic compatibility claim because their clients may populate prompt selection fields for defaults. Equal-model comparison cannot establish intent; do not use sticky routing heuristics.

At admission, capture configuration generation and immutable prompt facts. After bounded async work, recheck deadline and generation and mutate the draft synchronously or keep. Controls accepted before that final check take precedence; controls accepted afterward govern subsequent admissions. The hook never changes the persistent user selection. Other plugins run in host order and may subsequently edit the same draft; observe actual dispatch and report conflicts without retrying.

## Superseded requirements

Earlier specs demanded host-wide compare-and-swap over catalog, quota, picker, controls and persistence, exact entitlement proof, crash-safe commit journals and a host-enforced 200 ms transaction deadline. These are unestablished v1 plugin primitives and unnecessary for one scoped draft transformation. They cannot guarantee remote account availability after dispatch. This ADR supersedes those requirements. Preserve explicit inputs, scope changes to one draft, bound work, discard late results and leave auth, cancellation and retries to OpenCode.

Catalog evidence means host-connected/selectable according to available inventory, not proof of remote quota or subscription allowance. Refresh and validate before choosing; do not describe that as a transaction with a provider. On uncertainty before mutation, keep. The plugin does not replay operations after a crash.

## Evidence and limits

The [host report](../host-feasibility-v1.19.4.md) and [synthetic probe output](../evidence/host-1.19.4.json) document actual local-provider dispatch, variant lowering, catalog access and per-turn scope. This validates the basic mechanism, not live ChatGPT access, UI intent, policy quality, cancellation, concurrency or other-plugin composition. These remain integration/release tests.

## Product tradeoffs

Effort selection within the current model can use documented variant settings. Cross-model capability ranking is not present in catalog metadata, so v0.1 model switching uses optional user roles. New unranked models are visible without an update but receive no invented quality rank. This is a deliberate limit relative to the long-term fully automatic objective.

The rejected keyword policy is historical evidence, not implementation guidance. Begin with recommendations and evaluate a replacement before enabling changes. For releases, build once, bind source and artifact hashes and use trusted GitHub workflow/environment approval records. Attestations are useful hardening, not proof of task quality; a bespoke distributed approval ledger is deferred.
