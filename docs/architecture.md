# Architecture abstract

**opencode-openai-router** is a planned OpenCode v2 plugin that selects an available OpenAI model and reasoning effort for coding work within OpenCode's existing conversations, authentication and coding engine.

A single package contains a thin host integration and an independent routing core. The integration obtains host model facts, validates controls and applies eligible decisions through native session selection. The pure core considers bounded task and conversation signals, supported capabilities and configured preferences. Configuration and optional local measurements remain separate from policy decisions.

Automatic mode may replace a manually selected model or variant, update the visible picker and leave the new choice selected for later turns. Users disable automatic routing for manual control; disabling prevents new switches rather than restoring earlier choices. The integration must handle admission ordering, active and queued work, cancellation and control changes before it can safely apply decisions.

The intended profiles are Economy, Balanced and Quality. The router avoids unnecessary switches and prioritizes successful completion, latency, token efficiency and possible cache effects. Discovery does not establish model quality or account entitlement. Unranked new models remain discoverable; cross-model choices require validated evidence. Background lookup and optional budgeted classification update cached model assessments when catalog/evidence changes; per-task assessment remains local and requires no manual role setup. Unknown required information causes the router to keep the current selection.

Optional observations are local and off by default. Measured tokens, errors and latency are distinct from verified task outcomes. The plugin does not train itself automatically or claim subscription allowance savings without reliable measurement.

The package currently has inert entry points and initial pure utilities; it does not route requests. The [current decision](decisions/0002-opencode-v2-desktop.md), [development plan](development-plan.md) and [review synthesis](review-synthesis.md) govern implementation. The [feasibility assessment](v2-product-feasibility.md) distinguishes demonstrated session switching from unfinished controls, policy evaluation and production acceptance. Earlier v1 research is historical.
