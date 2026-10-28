# v0.1 domain specifications

Authority: [PRD](../prd-v0.1.md) → [ADR 0002](../decisions/0002-opencode-v2-desktop.md) → these specs. The v1 ADR and evidence are historical, not active compatibility requirements. Planned behavior is distinct from [v2 runtime evidence](../host-feasibility-v2.1.4.md).

| Domain | Responsibility | PRD |
| --- | --- | --- |
| [Host](host.md) | v2 session switching, bounded work and dispatch observation | FR-1, FR-4 |
| [Catalog](catalog.md) | Host inventory, connected status, variants, effective limits and freshness | FR-2 |
| [Model evidence](model-evidence.md) | Background lookup, budgeted classification and evidence-backed ranking | FR-2, FR-4, FR-7 |
| [Routing](routing.md) | Assessment contract, profile decisions and switching | FR-3, FR-4 |
| [Controls](controls.md) | Configuration, mode, generation and inspection | FR-5 |
| [Observations](observations.md) | Optional local aggregates, bounds, deletion and privacy | FR-6 |
| [Verification](verification.md) | Fixtures, real-host tests, evaluation and release evidence | Section 7 |

## Shared contracts

- Selection: exact provider/model IDs and optional host variant; omitted means the host's documented default, never an invented effort.
- Turn: verified session/message identity, host selection and agent context where exposed; unavailable facts remain unknown. Auto mode owns the selection; off disables switching.
- Catalog snapshot: connected providers, model/variant data, completeness, retrieved time and configuration generation; not a remote entitlement proof.
- Decision: `keep` or `select`, original/proposed pair, reasons, policy version and captured configuration generation. A selection is a proposal, not an applied outcome.
- Outcome: `kept`, `proposed`, `observed` or `mismatch/unknown`. Definitive dispatch evidence is distinct from task success. Never label an unknown dispatch as applied or replay it.

The adapter owns SDK/filesystem/UI interactions. Pure policy consumes validated data. All optional unknowns are explicit, never zero or false by default. A native session switch is the selected mechanism; automatic application remains disabled until host safety and policy acceptance tests pass. Configuration generation and cooldown are local session state, not distributed transactions. Other plugins and normal provider failures remain host concerns; routing must not submit an extra coding turn or retry on another model. Isolated model-classifier generation is governed separately by the model-evidence spec.

The [development plan](../development-plan.md) defines sequence and exit evidence. Policies or APIs absent from current evidence are implementation tests, not invented host guarantees.
