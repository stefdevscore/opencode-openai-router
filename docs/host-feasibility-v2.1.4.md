# OpenCode 2.1.4 feasibility evidence

The desktop distribution's bundled CLI reported OpenCode 2.1.4. A single authorized synthetic prompt through an existing OpenAI connection returned the requested response. This checks connectivity only; it did not load or exercise the router, validate model selection or reasoning variants, measure quality, or establish subscription savings. No credentials, private prompts, or session identifiers are recorded here.

The [isolated local fixture](../scripts/probe-v2.mjs) loaded the compiled plugin's v2 entry, registered a fixture-owned prompt hook, enumerated a configured local model through the native model catalog, and received a response from a scripted local provider. The plugin itself registered no hooks and made no selection. [Recorded synthetic output](evidence/host-2.1.4.json) is specific to this host version and environment; multiple provider calls can include host auxiliary work. The probe uses isolated XDG directories and a temporary local provider, and does not use the user's provider credentials.

This does not prove that the plugin is installed in the desktop app, that desktop prompts expose manual selection intent, or that a session switch is turn-local. Those are explicit outstanding adapter gates in [ADR 0002](decisions/0002-opencode-v2-desktop.md). Ordinary CI does not require a live account.
