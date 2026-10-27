# v0.1 keyword classifier: adversarial assessment

- **Date:** 27 October 2026
**Verdict:** Reject the proposed keyword classifier for automatic routing until a replacement passes the PRD's paired quality gate.

The proposed rules in [routing policy](specs/routing.md#policy-v010-rejected-automatic-candidate) were manually exercised against 12 synthetic examples. This is an exploratory counterexample exercise, not the frozen 30-task evaluation, a representative sample, or a measure of model quality. Expected labels below are reviewer judgments for testing the heuristic, not objective ground truth.

| Input | Rule result | Concern |
| --- | --- | --- |
| Rename every public symbol across dozens of packages | straightforward | A large cross-package change can be classified as simple from one token. |
| Format the database and delete all records | straightforward | A destructive request can be classified as simple because `format` occurs. |
| Fix the parser crash | unknown | Common debugging has no recognized pattern and will not route. |
| Explain this authentication flow and its security audit | unknown | Mixed simple and complex patterns lead to a conservative keep. |

The other probes covered simple renames and summaries, an architecture request, a security audit, root-cause analysis, a negated request, an ordinary test-writing request, and quoted text. Results showed the expected conservative behavior on some examples, but they do not repair the two unsafe false-simple cases above. No real provider request or paid evaluation was performed.

## Decision

Do not enable policy `v0.1.0` for automatic routing. Its table remains a candidate for reproducibility, not an approved default. Recommendation-only experiments must clearly identify it as unvalidated and must not modify selections. Until a replacement is specified and passes the required host and paired quality gates, the safe behavior is `keep current`.

The replacement must define how it handles destructive or high-impact operations, negation, quoted text, mixed and multi-step requests, ordinary debugging, unknown inputs and task context; include these examples and additional independently designed tasks in its frozen evaluation. It may use local deterministic logic or trusted host-provided structured signals, but must not introduce a paid classifier, infer quality from names, or bypass user controls. A measured quality result requires a separately authorized live connection and the predeclared paired 30-task suite. No result or savings claim is available yet.
