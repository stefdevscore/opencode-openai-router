# Architecture abstract

**opencode-openai-router** is a planned OpenCode plugin that aims to select an appropriate available OpenAI model and reasoning effort for each coding task. It is intended to work within OpenCode's existing conversations, model integrations, and authentication, without providing a separate coding interface or managing credentials.

The plugin is intended to be a single package with a thin OpenCode integration around an independent routing core. The integration obtains available model information and, where the host supports it, applies a decision. The core assesses task and conversation signals, considers available capabilities and user preferences, and produces an explainable recommendation. Configuration and optional local performance observations remain separate from that decision logic.

The intended experience is automatic routing with Economy, Balanced, and Quality profiles, while preserving explicit model choices and pins. When availability, capability, user intent, or host behavior is uncertain, the plugin retains the current selection. It avoids unnecessary switching and weighs successful task completion, latency, token usage, and potential cache effects rather than optimizing for token count alone.

The design relies on information actually exposed by OpenCode. Model names or context limits alone cannot establish relative capability, and a catalog entry does not guarantee account access. Supported OpenCode versions, per-turn model and reasoning changes, and manual-override behavior must be verified against real hosts before automatic routing is enabled. Initial work will favor recommendations until those checks pass.

Any performance measurement is intended to be local, minimal, and opt-in, with a clear retention policy. Results should distinguish observed data and verifiable outcomes from estimates; subscription allowance savings will not be claimed without reliable measurement. The current repository is an inert scaffold: routing, discovery, controls, and measurement are not yet implemented.

The supporting [research note](research.md) records historical comparisons. The [current design decision](decisions/0001-turn-local-routing.md) scopes routing to a pending turn, and the [development plan](development-plan.md) sequences implementation and verification. Actual dispatch has been observed only against the pinned host with a local fixture; policy quality and real account compatibility remain release evidence.
