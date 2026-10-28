# Final synthesis and development readiness

- Date: 28 October 2026.
- Scope: current source and tests, PRD, all domain specs, research evidence, package contents and CI/release configuration.
- Decision: **ready to begin staged v2 development**. Automatic activation and publication remain gated. The plugin remains inert; development readiness does not certify a production router.

## Accepted product contract

[ADR 0002](decisions/0002-opencode-v2-desktop.md) governs: OpenCode desktop 2.1.4 is the initial target; auto mode may replace a manual model/variant choice, update the picker and leave that pair selected on later turns. Users disable routing for manual control. Disabling prevents new switches after it is effective and does not restore an old selection or promise to cancel an already-issued switch. Explicit router pins and protected configured agent models remain separate controls. v1 is historical and outside product scope.

This removes the earlier requirement to infer manual picker intent and restore the previous pair after each turn. The desktop fixture demonstrated basic native session switching and persistence, which now match the chosen direction. Unknown session activity, failed controls and stale results still require abstention; the user clarification does not authorize uncontrolled switching during active work.

## Findings resolved in this synthesis

| Finding | Resolution |
| --- | --- |
| Architecture abstract and prior synthesis still governed the project with the v1 turn-local design. | Updated both to the accepted v2 session behavior and actual implementation status. Historical reports remain explicitly historical. |
| Documentation CI required v1 evidence despite the v2-only target. | Check active v2 loader/catalog evidence and parse all evidence JSON; v1 fixture counts no longer govern acceptance. |
| Packaged documents and research runners referenced omitted research inputs. | Include the synthetic research directory in the private development archive; check its Markdown links as well. Verify links inside the extracted archive and load the compiled inert entry without installed dependencies. |
| PRD used unknown user intent as a keep reason and could imply that disabling cancels an issued session switch. | Unknown task demand keeps; auto may supersede manual selection. Distinguish late decisions that must not issue switches from issued host operations that may still complete. |
| Verification required auxiliary calls to remain unaffected even though the accepted model change is session state. | Trigger switches only from eligible admissions and test/document their effects on later primary and auxiliary calls. Do not route title/compaction callbacks independently. |

## What exists and what the evidence establishes

| Area | Present state | Development implication |
| --- | --- | --- |
| Package | Inert dual entry, pinned v1/v2 type dependencies, clean TypeScript build, CI on both long-lived branches, publishing-disabled workflow. | Remove the unused v1 surface first; keep the release safeguard. |
| Pure utilities | Bounded v2 catalog normalization, validated recommendation/off configuration and initial upward-effort recommendation. | Starting points only: config rejects auto, roles do not select models, and the old explicit-selection guard conflicts with the new product behavior. Refactor before integration. |
| Host evidence | Local CLI and actual desktop fixture changed the session model and retained it on the next turn. Server command registration/options were exercised. | Native switching is a feasible mechanism. Complete disable/pin behavior, session status, deduplication, ordering, lifecycle and actual packaged-plugin tests. |
| Account facts | Existing OpenAI connection responded; catalog facts and non-sensitive token-field availability were observed. | No auth management is needed. Test real variants and measurement completeness; do not infer entitlement or allowance savings. |
| Policy | Toy rules fail adversarial examples; 500 external human-time labels provide an independent proxy, not AI-model routing labels. | Define and evaluate a replacement assessment. Do not ship the exploratory rules as the policy. |
| Live coding | Four static-model attempts on two synthetic pure-function tasks passed their checks. | Pilot only; no router, repository tool use, paired-profile quality result or savings result exists. |

The desktop test used a disposable project in the existing app and shared session database. Its test tab/project entry were closed and provider stopped; synthetic sessions remain in history. Local models were absent from picker search, so explicit picker re-selection and variant paths were not exercised. The research report discloses this; it is not full production desktop acceptance.

## First implementation changes

1. **v2-only baseline:** remove legacy entry, v1 dependency/overrides and unused boundary/normalizer/tests; review whether TOML coverage still applies to the resulting dependency graph. Keep historical evidence. Adapt the existing pure recommendation contract to the accepted behavior. Exit with clean install, audit, tests and a complete extracted package.
2. **Controls and host contract:** implement one validated user configuration mechanism, deterministic inspect/off/pin controls and instance/session state. Prototype verified session activity, same-session admission serialization and disable-before/after-switch ordering against a local provider. Recommendation mode remains the default. If a host path cannot be proven, keep on that path rather than block unrelated development.
3. **Recommendation policy:** specify bounded inputs, thresholds and abstention, complete catalog facts and user role mapping, and freeze independent behavioral fixtures. Exercise all profiles without host mutation. Model names and catalog size do not supply quality ranks.
4. **Native adapter:** wire eligible recommendations to session switching after the contract tests pass; observe model and effort separately, session persistence, controls, active/queued work, duplicate admissions, cancellation, concurrency and other plugins in the actual packaged v2 plugin and desktop.
5. **Release acceptance:** implement opt-in observations, performance measurement, the frozen 30-task baseline/profile coding evaluation, installed-package checks and rollback, then dry-run the build-once approval workflow before any automatic release.

Exact config transport, safe host activity signals, policy features and observation storage path are explicit implementation deliverables. They are not established facts or prerequisites for beginning the first change. The [domain specs](specs/README.md) and [development plan](development-plan.md) define their acceptance criteria.

## Verification of the scaffold

Fresh locked installation, typecheck, nine existing tests, documentation checks, dependency audit and whitespace checks passed. The audit reported zero vulnerabilities; npm also reported upstream deprecation/install-script notices, which are not a compatibility guarantee or advisory finding. Local default runtime was Node.js 26.12.1. Typecheck, all nine tests and documentation checks also passed on Node.js 24.22.1, matching the CI major version. Existing tests include legacy v1 coverage and must not be presented as v2 routing coverage.

The private development archive includes the referenced research inputs; its extracted documentation links and evidence JSON passed and its inert v2 entry loaded without development dependencies. These are scaffold checks, not release provenance or package routing acceptance. CI configuration targets Node.js 24 and pushes/PRs to both `main` and `development`; the documentation cleanup must pass remote CI when pushed. Release readiness explicitly fails instead of publishing.
