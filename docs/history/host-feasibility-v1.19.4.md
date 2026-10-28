# OpenCode 1.19.4: pinned source and runtime findings

**Historical:** v1 is outside the current product scope. This report is retained as prior evidence and does not establish v2 behavior.

- Date: 27 October 2026.
- Verdict: core turn-local routing mechanism verified against a local provider; production acceptance remains incomplete.

This report supersedes the earlier source-only no-go under the overconstrained transaction proposal. [ADR 0001](../decisions/0001-turn-local-routing.md) explains the revised boundary. The plugin itself remains inert; the probe deliberately mutates synthetic fixtures to test host mechanics.

## Reproduction

Run `node scripts/probe-host.mjs /absolute/path/to/opencode` with the 1.19.4 native binary. The npm `opencode-ai@1.19.4` wrapper required its postinstall link; the native `opencode-darwin-arm64@1.19.4` binary was invoked directly from npm's cache. The global OpenCode installation was not changed. Tested on macOS arm64 with Node.js 26.11.1 driving the probe; ordinary project CI uses Node.js 24, so probe portability to other OS/Node versions remains unverified.

The harness uses isolated XDG config/data/cache/state directories, a temporary working directory, a local HTTP fixture, a dummy local API key, an ephemeral password for the local OpenCode server, and a restricted child environment with no inherited provider keys. It cleans up its host process and files. It neither reads the user's OpenCode auth store nor makes a live OpenAI inference. System-managed OpenCode settings may still apply independently of XDG configuration; run the probe in an environment without external managed plugins or providers. The global host remains 1.3.13.

## Runtime observations

The sanitized [JSON output](../evidence/host-1.19.4.json) records:

- `/provider` exposed `openai` as connected, both configured model candidates, and `low`/`high` variants. This is configured host inventory, not remote entitlement proof.
- Editing the pending default `probe-a` pair to `probe-b/high` produced an actual local-provider request for `probe-b` with `reasoning_effort: high`. The temporary plugin preserves explicit prompt selections.
- A separate variant-only edit retained `probe-a` and sent `reasoning_effort: high`.
- An unchanged explicit fixture retained `probe-a/low`. With no prompt selection, hook `input.model`/`input.variant` were omitted and the host selected its default.
- A following turn in the routed session returned to the host session model `probe-a`; omitting its variant used the host default, not the routed `high` variant. Do not promise persistence of a prior effort.
- Each simple fixture generated one provider request; this is not a universal claim about tool loops or auxiliary model calls.
- A standalone noninteractive `opencode run` fixture used the `run` process shape and dispatched the routed pair. Separate `--model`-only, `--variant`-only and combined flag fixtures preserved the user's selection. The `serve` fixture used a different process shape. This is evidence for these exact 1.19.4 invocations on macOS arm64, not proof that attached, interactive, UI, or other-version clients are distinguishable.

## Pinned source corroboration

Upstream tag `v1.19.4` resolved to `148842ef7cb1bc34192b3fff57d0f9721ab9c801`. [Prompt code](https://github.com/anomalyco/opencode/blob/148842ef7cb1bc34192b3fff57d0f9721ab9c801/packages/opencode/src/session/prompt.ts) constructs session state before invoking `chat.message`, saves the mutable user message afterward, and later resolves the model from it. [Plugin dispatch](https://github.com/anomalyco/opencode/blob/148842ef7cb1bc34192b3fff57d0f9721ab9c801/packages/opencode/src/plugin/index.ts) awaits hooks in registration order. [CLI code](https://github.com/anomalyco/opencode/blob/148842ef7cb1bc34192b3fff57d0f9721ab9c801/packages/opencode/src/cli/cmd/run.ts) sends explicit model/variant arguments to the prompt API; the adapter must still test the end-to-end CLI path before claiming support.

Earlier [v1.15.7 input-mutation issue](https://github.com/anomalyco/opencode/issues/28901) and [active-picker issue](https://github.com/anomalyco/opencode/issues/18644) concern different paths. Input-model mutation is not equivalent to changing the output user-message draft; picker persistence is not the same as a per-turn request. Neither issue alone establishes current feasibility.

## Historical gaps at the end of this investigation

Configured agent pins, cancellation, late promises, concurrent sessions, tool-loop behavior, other-plugin ordering, live ChatGPT authentication, real context caps and policy quality still require tests. The hook does not expose a client-surface identifier, so omitted selection fields in a server prompt cannot establish whether a future request came from the noninteractive CLI or a UI. A candidate boundary based on the observed standalone process shape has unit tests, but attached and interactive paths, other launchers and operating systems need integration evidence before automatic routing. TUI/desktop intent is unverified and remains outside automatic support. No atomic quota/catalog/picker transaction is claimed or required for the scoped design. The pure core remains recommendation-only; automatic production release waits for the PRD's remaining evidence.
