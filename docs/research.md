# Research and implementation considerations

Research snapshot: 27 October 2026. This document describes the intended structure, not implemented behavior.

The [architecture abstract](architecture.md) presents the project's intended design at a higher level. This note retains the supporting findings and questions for implementation.

## What we learned

- [Oh My OpenAgent](https://github.com/code-yeongyu/oh-my-openagent) is a large OpenCode extension with many concerns and packages. Its scale is a reason to keep our entry point and domain boundaries small, not a reason to adopt its orchestration system. GitHub reported about 70,000 stars at the time of research.
- [Dynamic Context Pruning](https://github.com/Tarquinen/opencode-dynamic-context-pruning) separates its OpenCode entry points, library, configuration schema, and tests. It shows the value of explicit configuration and host integration tests. It manages context rather than model selection; we should not duplicate that feature. GitHub reported about 4,400 stars.
- [OpenCode Model Router](https://github.com/marco-jardim/opencode-model-router) separates routing, compatibility, telemetry, and tests, and offers host smoke tests. Its routing delegates to tiered subagents and injects routing instructions into the prompt; that is a different design from selecting the existing conversation's model. GitHub reported about 140 stars. Its documented protocol has a per-message context cost, which reinforces measuring routing overhead rather than assuming savings.
- [Superpowers](https://github.com/obra/superpowers) uses a thin OpenCode integration around shared functionality. It is a multi-host skills project; its roughly 306,000 repository stars are not a measure of OpenCode plugin adoption.

These examples are useful design references, not direct competitors or evidence that their approaches meet our requirements. Star counts are repository-wide snapshots, not usage or quality measurements.

## Host API constraints

The current scaffold targets the `@opencode-ai/plugin` 1.x type contract; the locally installed OpenCode reports 1.3.13, whereas the project's locked plugin types are 1.19.4. Those versions have not been demonstrated to be compatible. For the locked types, `chat.message` receives a model and variant in its input and a mutable user message in its output; `chat.params` receives a model as input and exposes request parameters in its output. The types alone do **not** establish when model or variant changes take effect, how the UI reflects them, or how explicit user choices are distinguished from defaults. [An upstream model-switching issue](https://github.com/anomalyco/opencode/issues/28901) illustrates why this needs an actual host test.

[OpenCode v2 documents a different plugin API](https://dev.opencode.ai/v2/docs/build/plugins/migrate-v1), including model listing and session hooks. Its API and packaging must not be assumed to work in 1.x. Start by investigating a supported 1.x range against the real host, then add a separate v2 adapter only when its runtime and behavior are verified. Do not claim cross-version support from types alone.

## Chosen structure

Keep a single package and create modules only as features are implemented:

```text
src/
  index.ts                 # thin host entry point and composition
  host/                    # version-specific OpenCode adapters and capability checks
  catalog/                 # normalize OpenCode's available OpenAI models and variants
  routing/                 # task signals, policy, decisions and switch hysteresis
  config/                  # profiles, overrides, validation and defaults
  observation/             # opt-in local measurements and retention
test/
  ...                      # policy and adapter contract tests
  integration/             # real OpenCode smoke/contract tests and fixtures
docs/
  architecture.md
  research.md
```

This is a target layout, not a requirement to create empty files. The host adapter supplies facts and executes a decision; routing is pure, deterministic, and independently testable. It returns a recommendation with reasons and an explicit `keep current` result. Host types, SDK calls, filesystem access, and UI details stay outside the routing core. Do not add an additional UI, authentication system, provider, agent orchestration layer, or paid classification service.

## Routing boundaries

1. Read the host's available model inventory and normalize only metadata actually present, including OpenAI provider identity, context limits, capabilities and variants where available. Missing metadata means unknown, not zero or an inferred capability. Availability can be connection-specific: catalog presence alone does not prove access.
2. Assess a prompt and conversation using bounded, local signals. Start with conservative deterministic rules and a `keep current` option. Do not infer that a model is better just from its name or its context size; the catalog may not contain enough evidence to rank capability. Profiles adjust policy only where a defensible signal exists. If a decision is ambiguous, leave the current selection alone and explain why.
3. Give explicit user selections and pins precedence. Avoid switches when the benefit is uncertain; consider existing context fit, switching frequency, and cache effects without claiming a measurable cache hit or savings unless the host reports it. Confirm the selected model and effort are available immediately before applying them.
4. Apply changes only through a host path proven by integration tests. On unsupported APIs, missing metadata, invalid variants, failed discovery, or errors, retain the user's existing selection. Do not create a synthetic user turn or replace the agent loop to simulate routing.
5. Start with recommendations and verification. Enable automatic changes by default only after the adapter proves its behavior and preserves user control in supported versions.

## State and evaluation

Preferences, session overrides, and local observations are separate. Persist only what is needed, use a documented local storage location and retention policy, avoid prompts, source code, credentials and raw conversation content, and make collection explicitly opt-in. Missing usage, latency or cache data stays unknown. Respect host-provided counters and distinguish measurable tool/test outcomes from subjective success. Do not infer subscription allowance savings from tokens or API price metadata.

## Implementation gates

1. **Host spike:** run a minimal plugin against explicitly pinned OpenCode versions and a scripted or local test provider. Verify discovery, model and variant changes for the next actual request, UI state, explicit user overrides, errors, and CLI/desktop behavior. Include multi-turn and concurrent-session isolation. Record which host/version supports each behavior.
2. **Catalog and recommendations:** normalize dynamic inventory and expose explainable decisions without mutating selection. Test missing, retired, unavailable and changing models and unknown capabilities.
3. **Controlled application:** implement switching only where the spike proves it safe. Test pinning, fallback, reasoning variants, context limits, cache-sensitive switching and session isolation. Preserve the original selection whenever uncertain.
4. **Measurement:** add bounded local, opt-in aggregates and an evaluation corpus with verifiable outcomes. Compare against a no-routing baseline, including failures, retries, latency and routing overhead before making effectiveness claims.

Host smoke tests complement pure policy tests; run them against each supported version, while CI remains credential-free by default. Any live authenticated checks are explicit and separate. The existing scaffold and release pipeline do not yet establish a successful routed request or an end-to-end published release.
