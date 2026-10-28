# ADR 0002: use session-level routing on OpenCode v2

- Status: accepted product direction; implementation and release gates remain open.
- Updated: 28 October 2026.

## Decision

Target OpenCode desktop 2.1.4 and its native v2 server. OpenCode v1 is outside v0.1 scope; [ADR 0001](0001-turn-local-routing.md) is historical. The current package registers initial controls but does not route requests.

In automatic mode, the router may use the native session model switch to select a discovered OpenAI model and supported variant. This changes the session's visible picker selection and may persist into subsequent turns; the router evaluates later eligible turns using the host's current selection and its policy. It may override a manual model or effort selection while automatic mode is enabled. Users who want manual selection can disable routing. There is no recommendation-only mode or model pin in the router.

The [desktop experiment](../v2-product-feasibility.md) observed the switch, visible picker update and following-turn persistence with a local provider. This supports the session-level direction; it does not establish a complete adapter, safe concurrency, quality, native controls or real OpenAI variant behavior. The earlier turn-local/manual-override requirement and the prior no-go conclusion based on it are superseded by the user's decision, not by new host evidence.

## Conditions

Implement and exercise automatic switching directly in isolated fixtures. Before release, prove a reliable enable/disable path, generation and admission ordering, failures, same-session concurrency, active and queued turns, cancellation, late work, plugin ordering, host reload and actual provider dispatch. A switch changes session state and may affect active work; if the host cannot reliably establish a safe boundary, abstain for that situation. Disabling prevents new router switches after the disable is effective; it does not restore a prior selection, reverse a completed switch, or promise to cancel an already-issued host operation. Test and document this boundary and failure behavior.

Disabled mode takes precedence over policy. Configured agent models are not routing pins; agent context can inform the assessment. No credential handling, replacement provider, extra user prompt or plugin-owned retries. Effort behavior and supported variants must be observed on the target host before activation. Policy, live evaluation, performance and release gates remain in force. No savings or coding-quality claims follow from the switch experiment alone.

## Model evidence and classification

The router derives task-class suitability and profile ranking from validated public evidence rather than user-assigned roles. Low-frequency, budgeted classification may interpret evidence for new or materially changed models; coding-task assessment stays local. Prefer a verified isolated native generation using the existing connection. No external billing/credential path is enabled by default, and classifier self-confidence is not quality evidence. See the [model evidence contract](../specs/model-evidence.md); source adapters, isolation, budget enforcement and grounded output remain implementation gates.
