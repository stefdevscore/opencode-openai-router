# Verification and release

## Evidence layers

1. Unit/fixture: normalized catalog, config validation, reason ordering, policy decisions, unknowns, variants and context constraints.
2. Pinned-host integration: original message identity, real local-provider model and effort lowering, explicit input preservation, agent pins, sequential turns, tool loops, cancellation, late promises, concurrent sessions and later-plugin changes.
3. Quality: frozen live paired task corpus before automatic policy release. Synthetic dispatch alone cannot establish coding quality or real ChatGPT auth.
4. Packaging/release: clean build, typecheck, tests/audit, archive contents, installation/removal and rollback, source/artifact binding and approval.

The [probe](../../scripts/probe-host.mjs) and [evidence](../evidence/host-1.19.4.json) establish the basic 1.19.4 mechanism with a local fixture. Its synthetic marker-based decisions are not the production assessment policy; its minimal explicit-input guard still needs the full adapter acceptance matrix. Run it manually with a pinned binary; it must not use provider credentials or user config. Ordinary CI runs unit/fixture checks; an optional integration job may install the pinned host and run the local probe after its OS is tested. No claim about TUI, desktop, auth or quality follows.

## Performance and quality gates

Use at least 100 paired warmed trials on a recorded reference machine plus cold/timeout paths. Measure local decision and added dispatch median/p95 including discovery/control work; target local p95 <50 ms and added dispatch p95 <250 ms. Observe the 200 ms work budget and discard late reads. A plugin timer is not a real-time host deadline. Investigate misses before automatic release.

Freeze the PRD's 30 independent synthetic tasks before evaluation; at least five each of straightforward, multi-file, debugging and long-context/ambiguity, with predeclared high-impact cases and automated outcomes. Compare a fixed baseline and each profile under equivalent limits with recorded randomized/alternating order. Publish all paired results, retries, changes, exclusions and attempts. No high-impact baseline pass may regress, and at most one other baseline pass may regress per profile without offsetting gains. Each profile must actually change a pair; missing pairs/access are incomplete. Changes to a failed candidate require rerunning the entire frozen suite under predeclared rules. This small sample is a provisional gate, not proof of universal non-inferiority or savings.

Live evaluation needs an explicitly authorized test connection/budget and sanitized public fixtures. It is not ordinary CI. Recommendation development can proceed without it; automatic release cannot claim the gate passed without actual measurements. Distinguish resource-routing errors from permission enforcement, which remains OpenCode's job.

## Proportionate release design

Keep the existing release job disabled until implemented and dry-run. Build the package once from the exact protected-main candidate SHA after checks. Record package/version, source SHA, lockfile SHA-256, package SHA-256, CI run, host compatibility and quality/performance report references in an evidence manifest. Upload the archive and manifest as run-scoped artifacts with recorded IDs/digests; missing/expired/deleted artifacts fail closed. Do not trust names alone.

Require maintainer approval in a GitHub environment for the same run/candidate before publication. A solo maintainer may self-approve; do not call it independent review. Show the candidate and digests before approval; record GitHub's approval/run identity separately from the manifest. Download the same archive, recheck digests and tag-to-source SHA, then publish the exact bytes. No rebuild after approval. A matching version or ancestor commit alone is insufficient.

Use minimal job permissions and reviewed/pinned actions; untrusted PR code gets no release credentials. Environment settings and trusted maintainer administration are part of the trust boundary. GitHub artifact attestations are recommended for provenance and independent verification; they do not prove test quality. A custom approval ledger, host-transaction proof and multi-party signature system are deferred. See official [environment protection](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments), [artifact behavior](https://github.com/actions/upload-artifact), and [attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations).

Dry-run a passing candidate and reject wrong source/digest, missing approval, missing evidence and unavailable artifacts. Do not publish v0.1 as a release test. Document supported surfaces, preview limitations and install/rollback before release.
