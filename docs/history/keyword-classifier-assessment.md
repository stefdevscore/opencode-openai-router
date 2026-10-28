# v0.1 keyword classifier: adversarial assessment

- Date: 27 October 2026.
- Verdict: historical keyword policy rejected for automatic routing.

The former keyword rules were exercised against 12 synthetic examples with a standalone transcription. This is an exploratory counterexample exercise, not the frozen 30-task evaluation, a representative sample, or a measure of model quality. Expected labels below are reviewer judgments, not objective ground truth. The [current routing spec](../specs/routing.md) requires a replacement assessment design and evaluated recommendations before automatic release.

The rejected rules matched normalized ASCII token sequences: straightforward triggers included `rename`, `typo`, `format`, `spelling`, `explain this` and `summarize this`; complex triggers included `architecture`, `security audit`, `root cause`, `multi file`, `cross service` and `migration plan`. Both classes or neither meant unknown, and a quote/negation guard abstained. That guard did not address unrelated or multi-step uses of a simple token. The rules are recorded here solely to explain the counterexamples; they are not production implementation instructions.

| Input | Rule result | Concern |
| --- | --- | --- |
| Rename every public symbol across dozens of packages | straightforward | A large cross-package change can be classified as simple from one token. |
| Format the database and delete all records | straightforward | A destructive request can be classified as simple because `format` occurs. |
| Fix the parser crash | unknown | Common debugging has no recognized pattern and will not route. |
| Explain this authentication flow and its security audit | unknown | Mixed simple and complex patterns lead to a conservative keep. |

The other probes covered simple renames and summaries, an architecture request, a security audit, root-cause analysis, a negated request, an ordinary test-writing request, and quoted text. Results showed the expected conservative behavior on some examples, but they do not repair the two unsafe false-simple cases above. No real provider request or paid evaluation was performed.

## Decision

Do not enable the historical keyword policy for automatic routing. Recommendation-only experiments must identify any unvalidated policy and must not modify selections. Until a replacement is specified and passes host and paired quality gates, retain current. A false-simple routing label is a resource-allocation/quality defect; it must not be confused with command approval, which belongs to OpenCode.

The replacement must define how it handles destructive or high-impact operations, negation, quoted text, mixed and multi-step requests, ordinary debugging, unknown inputs and task context; include these examples and additional independently designed tasks in its frozen evaluation. It may use local deterministic logic or trusted host-provided structured signals, but must not introduce a paid classifier, infer quality from names, or bypass user controls. A measured quality result requires a separately authorized live connection and the predeclared paired 30-task suite. No result or savings claim is available yet.
