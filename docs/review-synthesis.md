# Final synthesis and development readiness

- Date: 28 October 2026.
- Scope: current source and tests, PRD, all domain specs, research evidence, package contents and CI/release configuration.
- Decision: **staged v2 development is underway**. Automatic activation and publication remain gated. Initial user controls exist, but the plugin does not route; development readiness does not certify a production router.

## Accepted product contract

[ADR 0002](decisions/0002-opencode-v2-desktop.md) governs: OpenCode desktop 2.1.4 is the initial target; auto mode may replace a manual model/variant choice, update the picker and leave that pair selected on later turns. Users disable routing for manual control. Disabling prevents new switches after it is effective and does not restore an old selection or promise to cancel an already-issued switch. The user subsequently removed recommendation-only behavior and model pins from the routing contract; auto mode owns selection. v1 is historical and outside product scope.

This removes the earlier requirement to infer manual picker intent and restore the previous pair after each turn. The desktop fixture demonstrated basic native session switching and persistence, which now match the chosen direction. Unknown session activity, failed controls and stale results still require abstention; the user clarification does not authorize uncontrolled switching during active work.

## Findings resolved in this synthesis

| Finding | Resolution |
| --- | --- |
| Architecture abstract and prior synthesis still governed the project with the v1 turn-local design. | Updated both to the accepted v2 session behavior and actual implementation status. Historical reports remain explicitly historical. |
| Documentation CI required v1 evidence despite the v2-only target. | Check active v2 loader/catalog evidence and parse all evidence JSON; v1 fixture counts no longer govern acceptance. |
| Packaged documents and research runners referenced omitted research inputs. | Include the synthetic research directory in the private development archive; check its Markdown links as well. Verify links inside the extracted archive and load the compiled inert entry without installed dependencies. |
| PRD used unknown user intent as a keep reason and could imply that disabling cancels an issued session switch. | Unknown task demand keeps; auto may supersede manual selection. Distinguish late decisions that must not issue switches from issued host operations that may still complete. |
| Verification required auxiliary calls to remain unaffected even though the accepted model change is session state. | Trigger switches only from eligible admissions and test/document their effects on later primary and auxiliary calls. Do not route title/compaction callbacks independently. |

## Cut 1 update

The v2-only foundation is committed. The v1 entry, dependency, normalizer, process-boundary code and related tests/overrides are removed. The remaining v2 graph has no `toml` package. The pure decision/config contracts use `auto`/`off` with no manual-selection guard; no routing hook is registered. The actual packed entry was observed active in the pinned 2.1.4 host after adding the root `server.js` needed by that version’s local-directory resolver. Initial user controls are implemented and awaiting QA. The table below records the foundation baseline.

## What existed at the prior synthesis

| Area | Present state | Development implication |
| --- | --- | --- |
| Package | Foundation had an inert v2 entry, pinned v2 type dependency, clean TypeScript build, CI on both long-lived branches, and a publishing-disabled workflow. | Keep the release safeguard; validate the actual packaged plugin as the adapter develops. |
| Pure utilities | Initial bounded v2 catalog normalization, auto/off configuration and provisional upward-effort decisions. | Starting points only: no policy or controls are wired to the host. Complete catalog, assessment and switching contracts before integration. |
| Host evidence | Local CLI and actual desktop fixture changed the session model and retained it on the next turn. The inert packed plugin loaded in the pinned CLI; server command registration/options were exercised. | Native switching is a feasible mechanism. Complete disable behavior, session status, deduplication, ordering, lifecycle and actual packaged-plugin switching tests. |
| Account facts | Existing OpenAI connection responded; catalog facts and non-sensitive token-field availability were observed. | No auth management is needed. Test real variants and measurement completeness; do not infer entitlement or allowance savings. |
| Policy | Toy rules fail adversarial examples; 500 external human-time labels provide an independent proxy, not AI-model routing labels. | Define and evaluate a replacement assessment. Do not ship the exploratory rules as the policy. |
| Live coding | Four static-model attempts on two synthetic pure-function tasks passed their checks. | Pilot only; no router, repository tool use, paired-profile quality result or savings result exists. |

The desktop test used a disposable project in the existing app and shared session database. Its test tab/project entry were closed and provider stopped; synthetic sessions remain in history. Local models were absent from picker search, so explicit picker re-selection and variant paths were not exercised. The research report discloses this; it is not full production desktop acceptance.

## Implementation sequence and readiness

1. The v2-only foundation removes the manual-selection/agent-pin guard and recommendation-only configuration. Its provisional pure decision is not the final policy.
2. Build effective controls and the native automatic adapter in isolated fixtures; verify same-session ordering, disable timing, active/queued work, disposal and actual model/effort dispatch. No recommendation-only milestone is required.
3. Build catalog normalization and background model evidence, including an isolated classifier experiment through the existing host connection with explicit allowance limits. Prove source coverage, identity, grounded output, change-based caching, budget enforcement and no classifier recursion. A separate paid service is not silently introduced.
4. Implement bounded local task assessment and evidence-based profile selection, then exercise real automatic switches. No user-assigned roles, manual model pins or per-task classifier calls are required.
5. Complete opt-in observations, cold/warm overhead measurements, held-out classifier tests and the frozen paired coding corpus, then package/rollback and release dry-run.

The [development plan](development-plan.md) gives delivery dependencies. Config transport, reliable host activity, evidence-source coverage, classifier transport/bootstrap, enforceable budget units, policy thresholds and storage path are implementation deliverables. They are not established facts. A missing source or classifier limits ranking coverage and triggers keep behavior; it does not authorize invented quality claims or block unrelated implementation.

## Additional conflicts resolved

- Removed recommendation-only development defaults, mandatory manual roles and pin precedence from active product requirements. The modes are auto/off; automatic switching is developed directly.
- Replaced the blanket paid-classifier ban with a distinction between optional low-frequency model classification and per-task assessment. The former may consume a disclosed budget; the latter remains local. Separate API credentials/billing are not a v0.1 requirement.
- Separated the host inventory, public model evidence and classifier interpretation. Exact identity, provenance, comparable settings and grounded output govern ranking; schema compliance and model self-confidence are not quality proof.
- Aligned disabled behavior across routing and background jobs: no new dispatch after effective disable; already-issued work may finish without applying a coding-session switch. No rollback is promised.
- Added cold-cache, evidence-change and classifier-budget tests and separated their usage from warmed per-task routing performance. Historical results remain narrow fixture evidence.

## Verification of the scaffold

Fresh locked installation, typecheck, six foundation tests, documentation checks, dependency audit and whitespace checks passed on Node.js 24.21.0, matching the CI major version. The audit reported zero vulnerabilities; npm also reported upstream deprecation notices, which are not a compatibility guarantee or advisory finding. The foundation tests do not establish v2 routing coverage.

The private development archive includes the referenced research inputs; its extracted documentation links and evidence JSON passed and its inert v2 entry loaded without development dependencies. The current package test checks extracted entries in CI, and a separate local-provider probe loaded the packed plugin in the pinned CLI. These are scaffold checks, not release provenance or package routing acceptance. CI configuration targets Node.js 24 and pushes/PRs to both `main` and `development`; these changes must pass remote CI when pushed. Release readiness explicitly fails instead of publishing.
