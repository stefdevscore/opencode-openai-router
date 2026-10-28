# Draft upstream request: safe model selection at session admission

**Status: submitted as [OpenCode issue #60018](https://github.com/anomalyco/opencode/issues/60018).** The local copy preserves the request; the published issue uses the upstream feature-request format.

## Problem

A V2 plugin can select a session model with `ctx.session.switchModel`, but the `session.prompt` hook runs before inbox admission and does not establish whether a session is idle or has pending work. A steer can arrive while a previous model request is still running. A plugin that switches from this hook can therefore change the session selection while that work is active, or affect a queued input it did not assess.

We need automatic model and variant selection for eligible new coding input, while leaving the current selection unchanged when activity, identity or timing is uncertain. This should use the existing native selection and UI rather than submitting another prompt.

## Reproduction

With OpenCode 2.2.0, start an isolated server and OpenAI-compatible local provider; hold the first provider request open. Submit a second prompt with `delivery: queue`, then a third with `delivery: steer`. A plugin's prompt hook receives the third input as `steer` while the client reports active execution and a queued inbox item. Calling `ctx.session.switchModel` from that hook changes the session selection during the original request. A credential-free local probe reproduced this sequence against `opencode v2.2.0`; it does not establish effects on the already-dispatched request.

## Requested capability

Please consider a host-owned routing point at a safe input/step boundary, or a conditional selection operation whose preconditions include the exact admission, session activity, pending work and current selection. The check and selection need a host-defined ordering against concurrent admissions, delivery, execution and selection changes; independently querying status and inbox is insufficient. A proposal should be computed outside any host lock and applied only if its preconditions still hold. The host should validate the target model and variant and report applied, unchanged, rejected or unknown outcomes without requiring a second prompt.

The key acceptance cases are idle versus active or queued input, concurrent admissions, duplicate IDs, cancellation, competing selection changes and late completion. Applied selection and observed provider dispatch should be reported separately. We are not assuming a particular public API shape, and would welcome guidance on a design compatible with OpenCode's session model.

## Scope and related requests

This asks for safe ordering for V2 session selection and does not request mid-step retry, automatic model ranking or permission to override user settings. Related open requests include [#50729](https://github.com/anomalyco/opencode/issues/50729) for a model hook, [#48356](https://github.com/anomalyco/opencode/issues/48356) for binding selection to queued prompts, and [#56115](https://github.com/anomalyco/opencode/issues/56115) for a busy query. None explicitly requests conditional selection coordinated with V2 activity, queue and admission identity; a busy query alone leaves a race before switching.
