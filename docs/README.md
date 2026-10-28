# Documentation guide

Updated 28 October 2026. This is the current v2-only development baseline.

## Accepted behavior

Automatic mode may change a manually selected model or reasoning variant through OpenCode's native session controls. The picker can change and the selection can persist to later turns. Users disable routing for manual control; disabling stops new router switches after it is effective and does not restore prior selections or cancel an already-issued host operation. There is no recommendation-only mode or manual model pin. Optional model classification runs only in the background on changed model/evidence information and requires explicit enablement and an allowance budget. User controls are under development; automatic routing is not yet active.

## Reading order and authority

| Document | Purpose |
| --- | --- |
| [Architecture abstract](architecture.md) | High-level design and product boundaries. |
| [v0.1 PRD](prd-v0.1.md) | Product scope and release acceptance. |
| [ADR 0002](decisions/0002-opencode-v2-desktop.md) | Accepted native session-switching decision; supersedes v1 turn-local routing. |
| [Domain specifications](specs/README.md) | Contracts and tests for each domain. |
| [Development plan](development-plan.md) | Implementation order and milestone exits. |
| [Review synthesis](review-synthesis.md) | Current readiness decision and known implementation gaps. |
| [Feasibility assessment](v2-product-feasibility.md) | Observed results and their limits. |
| [Initial host probe](host-feasibility-v2.1.4.md) | Narrow v2 loader/catalog evidence. |
| [Evidence guide](evidence/README.md) | Recorded results, reproducible research and live-test scope. |
| [Historical material](history/README.md) | Superseded proposals and v1 evidence. |

The PRD defines product requirements; ADR 0002 defines the chosen host mechanism; domain specs turn these into contracts. Research reports describe observations and do not override that authority. User-approved scope changes must be reflected in the active documents before implementation.

## Status vocabulary

- **Implemented:** present in the source and exercised by relevant tests. Initial pure utilities qualify only within their current limited contracts.
- **Observed:** demonstrated by a specific research fixture or live smoke test. This is not general host compatibility or release acceptance.
- **Planned:** required by the PRD/specs but not implemented or verified yet.
- **Historical:** retained for context and regression cases; not an active requirement.

Development is ready to begin. Automatic routing, trustworthy controls, an evaluated policy, observations and release acceptance remain planned. The release workflow does not publish.
