# Host integration specification

**Scope:** PRD FR-1 and FR-4. This adapter is the only boundary that interacts with OpenCode's runtime, including discovery, user selection state, native controls, dispatch, and events. No actual hook or SDK method is established by this document.

## Capability contract

For each tested host version and surface, a checked-in compatibility report records: plugin loading/unloading; connection-scoped inventory, eligibility proof and freshness; current selection and origin/scope; turn and session identity; original-turn model and variant application; atomic guard coverage for catalog, connection, turn, selection and controls; observable rejection and completion; deadline/late-result behavior; native controls and inspection; and session isolation. A capability is `verified`, `unsupported`, or `unknown`, with evidence and exact tested build. Unknown is not verified.

The initial research target is OpenCode CLI 1.19.4 with matching 1.19.4 plugin types, in isolation; see [verification](verification.md). The [pinned source review](../host-feasibility-v1.19.4.md) is a **no-go** for automatic routing because the required guards are unverified; it is not a runtime compatibility test. The installed 1.3.13, other CLI versions, TUI, desktop and v2 are not automatically supported. If a host cannot load the plugin, compatibility documentation—not an in-plugin warning—is the fallback.

## Per-turn protocol

1. At a host-observed pending turn, capture its session/turn and connection identities, current selection, user choice origin, policy state, and monotonic start time. Unrelated providers and uncertain user intent keep the original selection.
2. Within the shared 200 ms deadline, obtain a verified snapshot, build a deterministic decision, and capture a guard for original turn, connection and catalog revision, selection and user-origin/scope, and control revision. The control revision includes enabled state, profile, preferences, pause, pin and any state whose change could invalidate the decision. Validate the target pair and guard before commit.
3. `keep` leaves the original request untouched. A `select` may be applied only to that original request by an operation that **atomically compares every guard component and commits**, or by demonstrably equivalent serialization with all host and plugin user actions. The host must reject stale guards without mutation. Checking before a separate unguarded write does not meet this requirement. No application may complete after the deadline.
4. On timeout, missing capability, unsupported state, stale guard, validation failure, or a proven pre-commit error, perform no router mutation. Preserve the host's **latest authoritative selection**, including a user choice made after the initial snapshot; never restore an older captured selection over a newer user choice. Cancel or ignore late reads and decisions. Late writes must be impossible; if the host cannot prove this, automatic routing is unsupported on that host.
5. Once the host owns dispatch, the plugin does not submit a replacement turn, retry a model request, or claim a task succeeded. A host error is surfaced through host behavior; do not hide it with an alternate model.

If capability checking itself cannot prevent an unsupported host from loading or executing unsafe code, the package cannot claim graceful degradation for that host. UI-visible selection state must be checked independently for each claimed surface. Logs and inspection contain reason codes and bounded metadata, never prompts, credentials, or raw provider output.

If an operation returns an error, times out, or loses acknowledgement after a possible commit, the result is `indeterminate` unless authoritative host evidence establishes rejection or application. Never report `kept`, start a cooldown, retry the commit, issue a replacement turn, or assert no change on an indeterminate outcome. Suspend further automatic routing for that session, surface a diagnostic where possible, and mark the host combination as failing its automatic-release gate. Recovery and any host request error belong to the host/user; no plugin rollback is assumed safe. A host that can produce this ambiguity within the supported path fails the gate until the adapter establishes a race-free resolution and the suite passes again. The 200 ms rule is an application deadline enforced by the host commit operation, not a claim that JavaScript scheduling has a hard real-time bound: a plugin-side timer alone cannot prevent a delayed write.

## Acceptance

- A simulated host-identified OpenAI provider observes an actual model change and a separate variant change on the original request, each exactly once. A scripted provider is not evidence of a real account's inventory.
- No mutation on explicit turn selection, pin, ambiguity, unsupported host, unrelated provider, stale snapshot, disabled router, or deadline expiration. No cross-session or future-turn mutation.
- Between validation and commit, inject a manual selection, pin, pause, disable, profile or preference change, connection switch, catalog revision change and turn cancellation. Each stale guard must be rejected without mutation. Exercise simultaneous requests, host error, lost acknowledgement, late read/write and cancellation. An ambiguous commit produces `indeterminate` and blocks the host release gate; it must never trigger a retry or a false `kept` result.
- The compatibility report records a go/no-go. Failure or missing evidence blocks automatic v0.1 for that combination.
