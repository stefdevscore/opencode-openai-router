# Evidence and research guide

These records support the [feasibility assessment](../v2-product-feasibility.md); they do not certify a production router. `v1` in policy/pilot filenames is the experiment revision, not OpenCode v1 compatibility.

## Recorded results

[Automatic extraction calibration](v2-automatic-calibration-2.2.0.md) records the implemented bootstrap/replacement path, passing loopback transport test and unsuccessful bounded live compatibility attempts.

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
| [Packed v2 probe](../../scripts/probe-v2-package.mjs) | Packs the actual plugin, verifies host loading and exercises control status and reload with isolated user and conflicting project settings. Desktop command visibility and switching remain unverified. |
| [Inspection probe](../../scripts/probe-v2-inspection.mjs) | Invokes the packed plugin's status command in a fresh isolated host session and checks for zero session messages and provider requests. Does not prove desktop visibility. |
| [Desktop controls check](v2-desktop-controls-2.1.4.json) | The desktop discovered and ran the status command in a disposable project but showed no result; synthetic input is not a safe direct status display. |
| [Desktop status investigation](v2-desktop-status-investigation.md) | Explains the 2.1.4 command's missing result, the stale command-description experiment, and the later 2.2 status action. |
| [2.2 status RPC probe](../../scripts/probe-v2-gui-rpc.mjs) | Exercises the packed 2.2 status RPC with a local provider; verifies controls, invalid settings, no session messages or provider requests, and unchanged agent/model. |
| [2.2 catalog RPC probe](../../scripts/probe-v2-catalog.mjs) | Exercises an enabled but unconnected OpenAI fixture, exact model/variant discovery and no provider inference. |
| [2.2 evidence store probe](../../scripts/probe-v2-evidence-store.mjs) | Loads the experimental SQLite store in the OpenCode 2.2 server runtime with an isolated local fixture; it does not test recovery ownership, account inference or desktop notifications. |
| [2.2 catalog readiness investigation](v2-catalog-readiness-2.2.0.md) | Explains why a parsed model list can still reflect a cached or bundled startup snapshot; a false-new-model fixture and a readiness signal remain unverified. |
| [2.2 baseline pipeline probe](../../scripts/probe-v2-baseline.mjs) | Runs the packed baseline pipeline inside the host with simulated catalog stages and public evidence; no account or real refresh is exercised. |
| [2.2 stateless generation probe](../../scripts/probe-v2-classifier-transport.mjs) | Exercises stateless generation with a local provider and checks session isolation; does not test a connected account or measure usage. |
| [2.2 desktop status check](v2-desktop-status-2.2.0.json) | Records the native command-palette status dialog in the installed desktop, including the GUI plugin ID collision encountered during development. |
| [2.2 host adapter probe](../../scripts/probe-v2-host-adapter.mjs) | Packed adapter and local CLI fixture exercise model, variant and off scenarios with synthetic safety evidence; they do not validate real admission safety or desktop behavior. |
| [2.2 host adapter investigation](v2-host-adapter-2.2.0.md) | Records fixture results and the pinned plugin API's admission, activity and queue limitations. |
| [Host boundary proposal](host-boundary-proposal.md) | Describes a candidate host-side conditional selection contract and its acceptance tests; no such API is implemented by this plugin. |
| [Upstream request](opencode-host-change-request.md) | Request with the 2.2 reproduction and desired host behavior, submitted as OpenCode issue #60018. |
| [2.2 activity boundary probe](../../scripts/probe-v2-activity-boundary.mjs) | Holds a local provider request open and verifies a steer hook can run while a session is active and another input queued. Its fixture deliberately changes that isolated session's model. |
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
