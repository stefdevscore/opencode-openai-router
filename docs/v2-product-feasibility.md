# OpenCode v2 product feasibility

- Updated: 28 October 2026.
- Decision: **ready for staged implementation of session-level routing** under [ADR 0002](decisions/0002-opencode-v2-desktop.md).
- Initial target: OpenCode desktop and bundled CLI 2.1.4, macOS arm64.
- Evidence: [recorded results and reproduction guide](evidence/README.md).

## Product decision

The user accepted automatic session switching even when it replaces a manual model or variant choice and leaves the selected pair in place for later turns. Users disable the plugin for manual control. This supersedes the earlier turn-local/manual-preservation requirement and the no-go verdict based on it. The observed host behavior has not changed; the accepted product contract has.

Basic native session switching is feasible. Automatic activation still needs tested controls, safe application ordering, a useful policy and the PRD's release evidence. The package itself remains inert.

## Findings against the abstract

| Capability | Finding | Remaining work |
| --- | --- | --- |
| Automatic discovery | The native catalog exposes model IDs, capabilities, context limits and variants. A read-only OpenAI connection check exposed 16 active/enabled models, all with tool flags, limits and variants; 90 variants had string reasoning settings. | Validate refresh, removal, partial data, provider status and effective limits. Catalog presence does not establish entitlement, quota or quality rank. |
| Automatic model switching | Local CLI and actual desktop fixtures changed the session model and retained it on the next turn. | Implement safe admission ordering, disable controls, duplicate handling, concurrency and lifecycle. |
| Reasoning-effort selection | A context option reached a synthetic compatible provider as `reasoning_effort: high`. | Verify native variant selection against the real OpenAI integration and correlate decisions to eligible requests. |
| Task assessment | Cheap local heuristics are possible, but tested exploratory rules fail adversarial examples or abstain heavily. | Define and evaluate a replacement policy; no production task assessor exists. |
| Controls | A local fixture received plugin options and registered/invoked a server command. | Verify usable desktop inspect/off controls and configuration precedence. |
| Measurements | A sanitized fresh OpenAI session export exposed input/output/reasoning/cache fields, including nonzero input and output. | Verify accuracy, completeness and lifecycle across supported models. Tokens do not measure subscription allowance savings. |
| Continuous improvement | Verifiable outcomes and opt-in local aggregates can support policy evaluation. | No automatic self-training or reliable general task-success signal is established. |
| Adapting to new models | Inventory refresh can reveal new models without a plugin update. | Catalog facts do not assign coding-quality roles. Use validated external evidence and optionally budgeted model classification. |

## Host and desktop observations

The [initial host probe](host-feasibility-v2.1.4.md) loaded the scaffold through an instrumentation wrapper, accessed model listing and received a local-provider response. It did not exercise a routing policy.

The [CLI switch fixture](evidence/v2-session-switch-2.1.4.json) requested `probe-a` explicitly, then deliberately called `ctx.session.switchModel` for `probe-b` during prompt admission. The provider received `probe-b`; a continued turn also used it. This establishes session persistence for that fixture.

The actual desktop test used a disposable project and loopback provider in the existing app, sharing its server/session database. Both local models appeared in CLI listing but were absent from the desktop picker search. The test therefore seeded a session through the background CLI on `probe-a`, opened it in desktop, and sent synthetic prompts. A normal send reached A. A fixture switch on the next admission produced a request to B, displayed “Switched to Router Probe B,” updated the picker and left B selected for the next send. Prompt metadata named A before the switch and B afterward. The [sanitized desktop evidence](evidence/v2-desktop-session-switch-2.1.4.json) records this sequence.

The marker `desktop-explicit-a` names a normal desktop send; it does not mean explicit picker re-selection was tested. The test did not cover picker re-selection, manual variants, queued input, configured agent pins or competing changes. It used no real OpenAI inference. The fixture tab and project entry were closed and the local provider stopped; its synthetic session remains in host history. These limits do not invalidate basic session switching, but they prevent a production compatibility claim.

## Pinned contract and version limits

Upstream v2.1.4 resolves to commit `68bc26b7da1990ce10ffecfbc1e09eb13aa5d824`. Source inspection corroborates the runtime findings:

- The [desktop composer](https://github.com/anomalyco/opencode/blob/68bc26b7da1990ce10ffecfbc1e09eb13aa5d824/packages/app/src/composer/submit.ts) commits selection before normal steer admission and includes the captured pair in metadata. Queued prompts use different ordering and must be tested separately.
- The [model resolver in the composer](https://github.com/anomalyco/opencode/blob/68bc26b7da1990ce10ffecfbc1e09eb13aa5d824/packages/app/src/composer/selection.ts) can choose from prompt state, agent settings, configured defaults, recents or fallback. The resulting pair alone does not establish explicit user intent; auto mode no longer requires that inference.
- [Prompt preparation](https://github.com/anomalyco/opencode/blob/68bc26b7da1990ce10ffecfbc1e09eb13aa5d824/packages/core/src/session/prompt.ts) forwards metadata to the prompt hook. The [session operation](https://github.com/anomalyco/opencode/blob/68bc26b7da1990ce10ffecfbc1e09eb13aa5d824/packages/core/src/session/session.ts) deduplicates equal model selections and otherwise publishes a session selection event.

The installed 2.1.4 SDK exposes the context request model as readonly. In the observed context hook, `kind` was absent and `options` already contained `maxTokens`, unlike parts of the current online [server documentation](https://opencode.ai/v2/docs/build/plugins/server/). Treat current docs as unpinned guidance and test the exact installed contract.

The installed 2.1.4 plugin package does not expose the GUI SDK described in current [GUI documentation](https://opencode.ai/v2/docs/build/plugins/gui/). Registry metadata on 28 October reported SDK 2.2.0 as latest; its inspected archive includes the experimental GUI interface, but still types the context model as readonly. No app upgrade or 2.2.0 runtime test was performed. GUI availability may improve controls; it does not establish safe switching by itself.

## Assessment and coding-outcome evidence

### Synthetic assessment

The [initial 24 prompts](../research/policy-fixture-v1.json) and [later 15 stress cases](../research/policy-holdout-v1.json) were authored and labeled by the same investigator. The later set was deliberately adversarial, not independently representative. On the initial set, the keyword rule marked two of eight complex and four of eight ambiguous examples simple; the guarded rule marked none. On the later set, the keyword rule marked two of five complex and three of five ambiguous examples simple, while the guarded rule marked two complex and one ambiguous example simple. The keep baseline proposed no downshifts. These rules are research baselines, not product policy.

### External human annotations

The fixed rules were also evaluated on all 500 issue descriptions in [SWE-bench Verified](https://huggingface.co/datasets/SWE-bench/SWE-bench_Verified). Dataset revision was `78f471bf655a3137b2e8a75af1501690ec009ec3`; the extraction SHA-256 was `9a52902f16c871361c0acf739ef3aa6eeef8ed433d43ac1bb35fb72130a4e33b`. A second verified extraction reproduced all matrices. Two descriptions exceeded the 16,000-character input cap and were truncated.

| Human completion-time estimate | Issue count | Keyword rule: simple | Guarded rule: simple |
| --- | --- | --- | --- |
| Under 15 minutes | 194 | 12 | 0 |
| 15 minutes to one hour | 261 | 30 | 0 |
| One to four hours | 42 | 2 | 0 |
| Over four hours | 3 | 0 | 0 |

These independent labels estimate human effort, not which AI model or variant should be selected. Public Python issues are not representative of all interactive coding requests. The [benchmark audit](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/) also reports test-quality and contamination issues; this exercise is a proxy stress test, not a frontier coding score or a release gate. The recorded batch runtimes measure only text matching, excluding host work and coding outcomes.

### Live pilot

Two synthetic pure-Python tasks were frozen before invocation and run once each with `openai/gpt-6-luna` and `openai/gpt-6-sol`. All four attempts passed four checks each. [Tasks](../research/live-coding/tasks.json), [runner](../scripts/research-live-coding.py) and [aggregate results](evidence/live-coding-pilot-v1.json) are retained without response code or account/session IDs. The tasks and tests were investigator-authored; they do not supply independent routing labels.

This pilot used static model choices, no router and no repository tools. It does not establish relative quality, profile performance, token savings or cache preservation. It consumed normal account allowance and created synthetic sessions in host history. The CLI stream in an earlier smoke did not expose token-bearing events, while a separate sanitized export did; stream absence does not prove usage data is unavailable.

## Development and release decision

Development may begin with v2-only cleanup, user controls, session-state contracts, background model evidence and automatic switching. Native session switching is the candidate application mechanism. Unknown activity, uncertain switch completion, invalid configuration or stale evidence must not authorize additional switches. Disabling does not promise rollback.

Automatic activation requires the [host matrix](specs/host.md), a validated assessment and role/variant policy, real OpenAI variant tests and the [verification gates](specs/verification.md). The frozen 30-task paired coding evaluation and 100-trial performance gate remain pending. No experiment demonstrates an automatically improving production router or subscription allowance savings.
