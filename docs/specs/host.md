# Host adapter

## Boundary and target

Target pinned OpenCode 1.19.4 noninteractive `run` and equivalent server prompt path. Use the public `chat.message` hook and SDK inventory. The [probe](../../scripts/probe-host.mjs) verifies core local-provider behavior; it is research scaffolding, not production routing. TUI, desktop, interactive CLI, v2 and unknown client intent keep selections until separately supported. No proxy, virtual model, host patch, picker setter or session-model write.

The pinned hook input does not identify its client surface. An omitted model or variant in a server prompt is not, by itself, proof that the caller is noninteractive CLI. Before enabling automatic routing, the adapter must establish a reliable, tested way to limit activation to supported clients or obtain an explicit user-controlled opt-in with documented scope. If neither is available, unknown origin keeps the current pair; the local server probe does not satisfy this gate.

## Turn protocol

1. Capture the pending output draft, explicit input model/variant, agent identity, message/session identity, start time and local configuration generation. Any explicit model **or** variant protects the entire pair. Discover configured agent model/variant pins; if the agent's pin status is unknown, keep.
2. Read validated cached/fresh inventory and compute a recommendation within a 200 ms work budget. An expired result or any error keeps the draft unchanged. Async helpers return values only; they must never retain a draft reference or mutate it in callbacks.
3. Recheck enabled mode, session pin, generation, identity and elapsed budget; if still valid, synchronously replace only the draft's model/variant pair once. Do not edit prompt parts, permissions, system instructions or host limits. A control update accepted before this check invalidates the proposal; later controls apply to following admissions.
4. Return from the hook. The host saves and dispatches its message. Never submit another prompt, retry a failed request or mutate a returned draft. Host cancellation and error behavior remain intact. Observed assistant/provider metadata may establish actual selection; it does not prove task success.

Plugin callbacks execute in host registration order. A later plugin can replace the pair; retain proposed versus observed fields and show mismatch if detectable. Support is conditional on documented plugin composition; do not claim exclusive control or restore a pair after dispatch. Unknown observations remain unknown. A crash does not authorize replay. No atomic remote-catalog or account-quota claim is made.

## Acceptance

- Local-provider tests observe a model change and a separate variant-only change, including actual request `reasoning_effort`.
- Preserve explicit model-only/variant-only requests and configured agent pins; test omitted defaults separately.
- A following turn uses the host session model, not a router-enforced prior choice. An omitted variant follows host default behavior.
- Test deadline, rejected discovery, late promises, config changes during awaits, cancellation, repeated hook events, concurrent sessions and later-plugin mutation. Validate message identity. A simple fixture sends one request; a normal tool loop may send multiple model calls without creating a second user turn.
- Load/package/unload tests use the actual pinned binary. No claim about real ChatGPT auth follows from the local probe.
