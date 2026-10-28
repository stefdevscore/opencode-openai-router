# Verification and release

Status: planned v0.1 contract. Existing research and scaffold utilities do not establish full acceptance.

## Evidence layers and order

1. **Credential-free unit tests:** catalog normalization and freshness, config and control precedence, deterministic routing decisions, abstention, context/variant constraints, privacy and failure paths. Freeze independent policy fixtures; do not test only implementation-shaped snapshots.
2. **Pinned v2 server and package tests:** use the actual packaged plugin, OpenCode 2.2.0 and an isolated scripted local provider. The [status RPC probe](../../scripts/probe-v2-gui-rpc.mjs) checks inspection, not routing acceptance; the earlier 2.1.4 probes are historical. Isolate XDG configuration, credentials and provider endpoints; assert isolation before execution. Keep host tests separate from ordinary CI until a reproducible runner is configured.
3. **Pinned desktop tests:** exercise the actual desktop picker with a disposable profile/configuration and local provider. Record the version, installation/configuration method, event evidence and actual dispatched model/effort; restore temporary state. Never alter the user's working global configuration. A CLI fixture cannot satisfy desktop selection tests. If isolation cannot be achieved, mark the desktop gate incomplete rather than using the user's active sessions.
4. **Live compatibility and quality:** a connection smoke test establishes only that the account can respond. Test a packaged candidate using authorized synthetic tasks after the local host gates; the frozen paired coding evaluation below establishes policy evidence. Do not record credentials, raw private sessions or account identifiers.
5. **Release:** clean build, audit, package contents, installed archive, uninstall/rollback, source/artifact binding, evidence and approval.

## Host scenario matrix

| Scenario | Evidence required | Expected outcome |
| --- | --- | --- |
| No explicit selection | Local provider receives separate model-change and effort-only test decisions. | Each occurs only on a verified eligible turn; actual request matches the proposal. |
| Desktop manual model and effort selection | UI selection and provider request captured in auto and off modes. | Auto chooses a model; off issues no switch. |
| Configured agent | Agent context and actual dispatch. | The automatic policy remains in control; agent context is handled correctly. |
| Consecutive turns and control changes during pending work | Compare UI selection and provider dispatch on both turns; disable before and after switch issuance. | Session switch can persist; no stale new switch after an effective disable, no promised rollback of issued work. |
| Primary, title, compaction, generate and tool continuation | Distinguish calls using host evidence and synthetic provider requests. | Issue switches only for verified eligible admissions, not auxiliary callbacks. Document their session-wide effect on later host calls; no extra user turn and no confusion between tool loops and retries. |
| Timeout, cancellation, stale catalog, disconnect and host errors | Controlled faults before and after admission, including late promise settlement. | Keep when safely possible; no plugin retry, replay or late mutation. Report unknown when dispatch cannot be established. |
| Concurrent sessions, multiple plugins, reload and unload | Interleaved decisions, ordered registrations, disposal and subsequent calls. | Isolation, no stale hooks or cross-session leakage; observed conflicts are not misreported as success. |

The local desktop fixture demonstrated that `switchModel` changes session state and persists. That behavior is accepted for auto mode; activation still requires the complete concurrency, control and policy tests. An unsafe or unobservable application condition keeps the host selection. The desktop [host specification](host.md) governs the investigation. The v1 probe is retained as historical evidence only.

## Performance and quality gates

Use at least 100 paired warmed trials on a recorded reference machine plus cold/timeout paths. Measure local decision and added dispatch median/p95 including discovery/control work; target local p95 <50 ms and added dispatch p95 <250 ms. Observe the 200 ms work budget and discard late reads. A plugin timer is not a real-time host deadline. Investigate misses before automatic release.

Freeze the PRD's 30 independent synthetic tasks before evaluation; at least five each of straightforward, multi-file, debugging and long-context/ambiguity, with predeclared high-impact cases and automated outcomes. Compare a fixed baseline and each profile under equivalent limits with recorded randomized/alternating order. Publish all paired results, retries, changes, exclusions and attempts. No high-impact baseline pass may regress, and at most one other baseline pass may regress per profile without offsetting gains. Each profile must actually change a pair; missing pairs/access are incomplete. Changes to a failed candidate require rerunning the entire frozen suite under predeclared rules. This small sample is a provisional gate, not proof of universal non-inferiority or savings.

Live evaluation needs an explicitly authorized test connection/budget and sanitized public fixtures. It is not ordinary CI. Automatic implementation and local testing can proceed without it; automatic release cannot claim the gate passed without actual measurements. Distinguish resource-routing errors from permission enforcement, which remains OpenCode's job.

## Proportionate release design

Keep the existing release job disabled until implemented and dry-run. Build the package once from the exact protected-main candidate SHA after checks. Record package/version, source SHA, lockfile SHA-256, package SHA-256, CI run, host compatibility and quality/performance report references in an evidence manifest. Upload the archive and manifest as run-scoped artifacts with recorded IDs/digests; missing/expired/deleted artifacts fail closed. Do not trust names alone.

Require maintainer approval in a GitHub environment for the same run/candidate before publication. A solo maintainer may self-approve; do not call it independent review. Show the candidate and digests before approval; record GitHub's approval/run identity separately from the manifest. Download the same archive, recheck digests and tag-to-source SHA, then publish the exact bytes. No rebuild after approval. A matching version or ancestor commit alone is insufficient.

Use minimal job permissions and reviewed/pinned actions; untrusted PR code gets no release credentials. Environment settings and trusted maintainer administration are part of the trust boundary. GitHub artifact attestations are recommended for provenance and independent verification; they do not prove test quality. A custom approval ledger, host-transaction proof and multi-party signature system are deferred. See official [environment protection](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments), [artifact behavior](https://github.com/actions/upload-artifact), and [attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations).

Dry-run a passing candidate and reject wrong source/digest, missing approval, missing evidence and unavailable artifacts. Do not publish v0.1 as a release test. Document supported surfaces, preview limitations and install/rollback before release.

## Automatic-routing evaluation preparation

Freeze the candidate policy, configuration schema, supported host version, evidence/assessment snapshot, task corpus and test harness before a comparison. The router must perform real switches in an isolated provider fixture before any live evaluation. Record the tested commit and package digest. Capture each attempt's task ID, profile, initial and observed selection, decision reason, outcome, duration and available token counters without persisting prompts, credentials or arbitrary logs. Keep any private raw diagnostic data outside the repository.

1. **Local integration:** run the installed plugin against at least two scripted models and multiple variants. Assert actual requested model and effort, persistent session selection, no redundant switch, unchanged behavior when off, and correct accounting for primary versus auxiliary calls. Inject disconnection, stale catalog, malformed variants, delayed reads, cancellation, simultaneous sessions and a disable racing an issued switch. Assert no stale decision issues a later switch and distinguish unknown completion from failure.
2. **Frozen coding corpus:** prepare at least 30 independently reviewed synthetic coding tasks and automated outcome checks, distributed as required in the PRD. Keep development examples and evaluation examples separate. Predeclare high-impact tasks, baseline, ordering, time and tool limits, environment resets, failure and rerun rules. The existing human-time benchmark and two-task pilot are exploratory only.
3. **Paired live evaluation:** compare a fixed no-routing baseline with each automatic profile on equivalent tasks, account and tool limits. Record every attempt and both improvements and regressions; enforce the PRD's separate high-impact and other-regression limits. Each profile must produce observed switches. Missing outcomes or models make the comparison incomplete. Run only after a candidate exists and with an agreed test budget.
4. **Performance and reporting:** use at least 100 paired warmed trials plus cold/timeout cases. Report decision-work and added-dispatch median/p95, error and retry counts, observed switches and available usage fields. Include excluded or failed attempts and limitations. Tokens and latency do not prove ChatGPT allowance savings or coding success.


## Background classifier and cold-start gates

Before live classification, test the entire lifecycle with a fake inference provider: zero-call initial catalog baseline, on-demand classifier bootstrap, exact identity resolution, evidence citation validation, malformed output/refusal, insufficient evidence, timeout, unchanged refresh, batching, repeated discovery, recursion exclusion, budget reservation/exhaustion, disabled mode and late completion. Assert that the coding session and its model do not change, and no task prompt or private identifier leaves the host. Separate classifier use from coding-agent use in accounting.

Freeze independently reviewed model-evidence packets and expected factual constraints before tuning; validate grounded claims and cross-model comparisons rather than the classifier's agreement with its own output. Report unsupported promotions/demotions, identity errors, coverage, abstention, retries, tokens and available cost/allowance measures. These tests cannot replace the 30-task end-to-end coding comparison.

Include cold start with an empty evidence cache, partial catalog startup, classifier retirement, automatically renewing dispatch limits, a newly added model and offline recovery; assert no inference without eligible new-model work. Test ambiguous dispatched outcomes separately from known failures. Direct/cached evidence and evaluated provisional estimates may support automatic switching when host safety permits; never block a coding turn waiting for classification. Measure cold classification and amortized refresh overhead separately from the 200 ms per-turn decision work. Freeze cached evidence during each paired evaluation so changing evidence does not confound profile comparisons.
