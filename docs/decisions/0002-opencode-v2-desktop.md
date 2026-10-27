# ADR 0002: investigate the native v2 desktop boundary

- Status: accepted target; automatic adapter unresolved.
- Date: 27 October 2026.

## Decision

Make OpenCode desktop 2.1.4 the primary compatibility target, with the 1.19.4 CLI adapter described in [ADR 0001](0001-turn-local-routing.md) treated separately. The package exposes an inert v2 `setup` entry and an inert v1 `server` entry. An isolated fixture has loaded the v2 entry and accessed its prompt hook and model inventory; this is not an automatic router.

The v2 [plugin API](https://opencode.ai/v2/docs/build/plugins/) and [server hooks](https://opencode.ai/v2/docs/build/plugins/server/) differ from the v1 draft mutation boundary. The documented session model switch affects session state. Its timing and interaction with explicit selections, picker state, other plugins and subsequent turns have not been established here. A context hook exposes request options, but its compatibility with user-chosen variants and other settings is also unverified. Do not assume either API preserves the PRD's user-choice and turn-scope guarantees.

Before enabling v2 mutations, identify a supported boundary or revise the product contract through an explicit decision. Test desktop and CLI selections, model-only and effort-only choices, configured agent pins, subsequent turns, tool continuations, errors, cancellation, concurrency, plugin ordering and lifecycle using the real pinned host and a scripted local provider. Unknown selection intent keeps the existing pair. A successful account smoke test does not replace these tests or the policy quality gate.

## Consequences

Pure catalog, configuration and recommendation components may advance independently. They do not perform routing. The existing v1 decision remains applicable only to its pinned v1 adapter; it is not evidence that its turn-local hook exists in v2. No release or quality claims follow from plugin loading or provider connectivity alone. See the [v2 evidence report](../host-feasibility-v2.1.4.md).
