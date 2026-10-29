# Automatic extraction calibration on OpenCode 2.2

The pipeline can now select a text-capable OpenAI candidate without a fixed model list, append synthetic calibration cases to the first pending assessment batch, validate the response and persist its pass. Calibration shares the same reservation and invocation as assessment. A complete malformed response, failed fixture label or explicit provider `invalid_request` rejects that candidate while preserving usage and pending work; another candidate can be tried on a later run. An interrupted or otherwise uncertain request remains unknown and is not automatically repeated.

The checks test grounded extraction and correct abstention on empty evidence. The fixtures are developer-authored synthetic statements, not independently reviewed coding benchmarks. A pass does not establish model-ranking quality. Stored passes are keyed by catalog model settings and prompt/calibration versions. Rejected candidates have a one-day negative cache; expiry alone starts no inference. Replacement runs only for unresolved new-model work.

## Recorded verification

- Unit/integration tests cover malformed responses, provider rejection, wrong labels, shared budgets, persistent reuse and retirement/replacement.
- The [packed host probe](../../scripts/probe-v2-automatic-calibration.mjs) exercised the actual `ctx.experimental.generate.text` path inside OpenCode 2.2 against a loopback provider. The initial baseline and previously indexed model caused no inference; new-model assessment and calibration used one generation/provider request; reopening the pipeline added no request. Session state was unchanged.
- The [explicit live probe](../../scripts/probe-v2-live-calibration.mjs) confirmed an existing connected OpenAI credential and 18 eligible text models. Two manually initiated synthetic QA dispatches were attempted in total, with an advance usage notice in the chat. Both yielded no assessment. The diagnostic attempt exposed only `Generate.ProviderRequestError` and reason `invalid_request`; credentials and raw provider messages were withheld. The request's exact rejection detail was not retained, so its cause is not established. Exact tokens and allowance use are unavailable, and host-internal retries cannot be counted.
- The known-rejection recovery path was added after the live diagnostic and tested locally. No further account call was made to claim it passed. The production plugin remains unregistered for automatic classification. Native automatic usage toasts are still outside this verification.

## Reproduction

Build first. The loopback probe uses temporary HOME/XDG directories and no account. The live probe uses a disposable project on the existing local service; without `--run` it reports connection/candidate counts without generation. `--run` allows at most one plugin dispatch per invocation and consumes ordinary model allowance; host retries are not capped by that count. Repeated manual invocations are additional QA calls, not an automatic retry guarantee. Temporary probe state is removed afterward; do not use this script as production recovery.

Live compatibility is **not verified** until a bounded account-backed calibration succeeds. Investigate the request rejection before another paid QA attempt. Independent assessment-quality evaluation remains a separate acceptance gate.
