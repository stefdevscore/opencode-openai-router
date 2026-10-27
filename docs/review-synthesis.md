# Adversarial review and synthesis

- Date: 27 October 2026.
- Scope: source, dependencies, tests, packaging, CI/release, PRD and every domain spec.
- Disposition: ready for staged development; automatic release is not yet ready.

## Findings addressed

| Priority | Finding | Resolution |
| --- | --- | --- |
| High | Host-wide transaction, entitlement and crash-journal requirements made the plugin appear impossible without demonstrating the simpler draft boundary. | ADR 0001 replaces them with one awaited turn-local edit, explicit-input preservation, local generation/deadline checks and no replay. A real host/local provider now verifies the core mechanism. |
| High | Source-only no-go was being treated as a verdict on runtime feasibility. | The pinned runtime probe records actual model/effort dispatch, catalog access and follow-up behavior. The host report distinguishes observed mechanics from remaining tests. |
| High | Manual intent cannot be inferred from equality of picker values; sticky routing could override a deliberate selection. | Initial scope is noninteractive CLI/server with explicit-input protection and agent pins. TUI/desktop/unknown intent keep; no sticky workaround or virtual model. |
| High | Catalog discovery was conflated with quality rank and live account entitlement. | Separate host-selectable inventory, reasoning settings, user model roles and unknown remote quota. Effort-only decisions do not require cross-model ranking; unranked models remain visible but unselected. |
| High | A rejected classifier was still the only detailed policy, giving development contradictory instructions. | Historical rules stay in the assessment record; current spec defines the assessment contract and a concrete recommendation-first milestone. Exact replacement features/thresholds and held-out fixtures are required in its implementation change. |
| Medium | Cooldown required retaining the router's model across turns even though the hook does not own the session picker. | Cooldown suppresses new proposals without reapplying the prior pair. Host defaults remain authoritative; absent effort follows host behavior. |
| Medium | Release security grew into an unimplemented custom approval ledger, while the actual workflow was still disabled with a constant condition rejected by actionlint. | Replace unused publishing code with a read-only readiness workflow that explicitly fails on tags/manual runs until a proportionate build-once artifact/digest/environment approval flow is tested. Provenance attestation is recommended hardening, not proof of coding quality. |
| Medium | Packaging could include stale TypeScript outputs; API types could float beyond the tested host; the TOML check could resolve a different hoisted dependency. | Clean generated output before build, pin the plugin contract, and resolve the compatibility check through the actual plugin dependency graph. |
| Medium | Documentation lacked a single current implementation sequence and durable checks for broken local links. | PRD → ADR → domain specs → development plan, with a local documentation check in CI. Historical research is labeled as a snapshot. |

## Remaining implementation/release tests

Core local-provider feasibility is not live account compatibility or policy quality. End-to-end CLI flags, agent pins, cancellation, late promises, tool loops, concurrent sessions, plugin composition, real ChatGPT auth and quality must still be tested in the milestones. These are finite implementation work, not unbounded research prerequisites. No claim is made about unsupported UI surfaces, quota, allowance savings or universal model quality.

## Checks completed in this review

Clean locked installation, typecheck, both existing tests and dependency audit passed with zero reported vulnerabilities. The audit covers this package's installed dependency graph, not all dependencies embedded in the separately distributed native host. The reproducible 1.19.4 probe passed five local-provider fixtures and recorded sanitized request evidence. A planted stale build file was removed by the new build command. The actual packed archive was extracted and checked for local documentation links, included probe scripts and a dependency-free inert entry point. Both GitHub workflows passed actionlint 1.7.12 with optional shellcheck/pyflakes integrations disabled. CI changes have not yet run remotely, and the probe driver was exercised on Node.js 26/macOS arm64 rather than the configured Node.js 24 CI runtime.

## Research basis

Use pinned upstream code and the recorded host probe over issue speculation. [OpenCode prompt lifecycle](https://github.com/anomalyco/opencode/blob/148842ef7cb1bc34192b3fff57d0f9721ab9c801/packages/opencode/src/session/prompt.ts), [hook order](https://github.com/anomalyco/opencode/blob/148842ef7cb1bc34192b3fff57d0f9721ab9c801/packages/opencode/src/plugin/index.ts), and [CLI inputs](https://github.com/anomalyco/opencode/blob/148842ef7cb1bc34192b3fff57d0f9721ab9c801/packages/opencode/src/cli/cmd/run.ts) corroborate the mechanism. Community [classifier-plugin documentation](https://github.com/lucasliet/opencode-classifier-plugin) independently describes output-message routing and the same-model sticky-intent limitation; its external classifier/auth/provider approach is outside our scope. Official [models](https://opencode.ai/docs/models/) and [SDK](https://opencode.ai/docs/sdk/) docs describe configurable metadata, not a quality ranking or account guarantee.
