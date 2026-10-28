# Evidence and research guide

These records support the [feasibility assessment](../v2-product-feasibility.md); they do not certify a production router. `v1` in policy/pilot filenames is the experiment revision, not OpenCode v1 compatibility.

## Recorded results

| Record | What it demonstrates | Main limit |
| --- | --- | --- |
| [Host 2.1.4](host-2.1.4.json) | Loader, fixture prompt hook and local model listing. | Instrumentation wrapper; no routing policy. |
| [Session switch 2.1.4](v2-session-switch-2.1.4.json) | CLI session switch and subsequent-turn persistence. | Synthetic local provider. |
| [Desktop session switch](v2-desktop-session-switch-2.1.4.json) | Actual desktop picker change, provider dispatch and next-turn persistence. | CLI-seeded session; local models absent from picker search. |
| [Effort override](v2-effort-override-2.1.4.json) | Reasoning option reached a compatible local provider. | Does not establish real OpenAI variants or full turn correlation. |
| [Controls](v2-controls-2.1.4.json) | Plugin options and server command registration/invocation. | Does not establish a complete desktop off/inspection experience. |
| [Initial policy exploration](policy-exploration-v1.json) | Keep, keyword and guarded rules on 24 synthetic examples. | Investigator-authored labels and rules. |
| [Policy stress set](policy-holdout-v1.json) | Fixed rules on 15 later adversarial examples. | Constructed stress test, not independent or representative. |
| [External annotations](independent-assessment-v1.json) | Fixed rules on 500 externally annotated issues. | Human completion time is not an AI routing label. |
| [Live coding pilot](live-coding-pilot-v1.json) | Two models each passed four checks on two pure-function tasks. | Four static-model attempts; no router or repository tool use. |
| [Historical host 1.19.4](host-1.19.4.json) | Prior v1 draft behavior. | v1 is outside current scope. |

The live catalog and usage-field checks are summarized in the report without raw credentials, account IDs, session IDs or response code. No record establishes subscription allowance savings. Synthetic sessions created by live and desktop tests can remain in OpenCode history.

## Reproduction scope

Build the scaffold first. All host probes require the exact version they name; do not assume a newer online API description matches the pinned binary.

| Script or fixture | Scope |
| --- | --- |
| [Initial v2 probe](../../scripts/probe-v2.mjs) | Temporary XDG directories and loopback provider; credential-free. |
| [Packed v2 probe](../../scripts/probe-v2-package.mjs) | Packs the actual plugin and verifies it is active in the pinned host alongside an independent local fixture. |
| [Session-switch experiment](../../scripts/research-v2-session-switch.mjs) | Deliberate changes in synthetic CLI sessions only. |
| [Effort experiment](../../scripts/research-v2-effort-override.mjs) | Local compatible-provider option override. |
| [Controls experiment](../../scripts/research-v2-controls.mjs) | Local fixture command invoked through the host API. |
| [Desktop fixture](../../research/desktop-fixture/README.md) | Manual desktop procedure using a disposable project in the existing app. |
| [Synthetic assessment](../../scripts/research-policy-baseline.mjs) | Offline, reads versioned synthetic fixtures; no model calls. |
| [External data fetch](../../scripts/fetch-independent-benchmark.py) | Downloads a pinned public extraction to a new local file; no account credentials. |
| [External assessment](../../scripts/research-independent-assessment.mjs) | Offline aggregate evaluation of that extraction. |
| [Live catalog summary](../../scripts/research-live-catalog.mjs) | Uses existing local provider connection to read inventory; no inference. |
| [Live coding pilot](../../scripts/research-live-coding.py) | Four real model calls and source execution with a narrow validator; requires authorized allowance and appropriate isolation. The validator is not a security sandbox. |

Ordinary CI does not run live tests. Research scripts are development tools, not the production plugin. Re-running a live pilot consumes allowance and leaves synthetic host sessions. The frozen 30-task paired profile evaluation and 100-trial performance gate are still pending.
