# Catalog normalization

Status: planned v0.1 contract. Existing research and scaffold utilities do not establish full acceptance.

## Source and schema

Read v2 model inventory using `ctx.model.list()` and determine provider availability through the pinned v2 provider contract. The local v2 fixture confirms model listing, but does not establish real OpenAI entitlement or the exact connection-status semantics; verify these against the pinned host. Use only provider ID `openai` under the host's normal connection/configuration. Compatible endpoints in research are fixtures; generic providers are not production candidates.

Normalize exact provider/model IDs, connected status, tool/input capabilities, effective host limits, the bounded variant facts needed to validate semantics and retrieval time/config generation. Keep unknown fields explicit. Preserve model disabled state if exposed and distinguish complete versus incomplete/error responses. Do not persist credentials or inspect auth files. Host-reported availability and catalog membership do not prove remote quota, account entitlement or subscription allowance.

## Freshness and selection

Refresh on initialization, relevant observed config/provider changes and before a selection if the snapshot is older than 60 seconds. Use one in-flight refresh per plugin instance; wait only within the turn budget and discard late results for that turn. Errors must not replace a valid snapshot with an apparently complete empty list. A stale or disconnected snapshot cannot authorize a new model/variant choice. Read-only inspection can show stale status.

Validate the proposed pair against the newest snapshot available at the verified v2 application boundary. There is no transaction with a remote account; provider-side changes after validation are normal host errors. Do not probe credentials, quotas or make a test inference during discovery. Added models become visible on refresh without a release; schedule the [evidence lookup](model-evidence.md) to derive quality roles when reliable evidence becomes available.

Preserve full custom variant settings: a variant can change more than reasoning effort. Known `reasoningEffort` settings or explicit user mappings establish semantics; a label alone does not. Never carry a variant to another model just because its name matches. A variant with additional unrelated settings is not selected automatically unless explicitly mapped by the user.

For model changes require supported tools/input modalities and known target host-effective limits. Equal-or-larger context is the default admissible case; smaller context requires a reliable request estimate, output reserve and specified safety margin. Unknown facts keep current. An effort-only choice retains host limits and requires a valid variant without unrelated option changes.

## Tests

Cover complete/incomplete/error snapshots, connected/disconnected OpenAI, disabled/removed/new models, malformed limits and option types, stale refresh, config invalidation, unknown capabilities, custom variants and connection errors. Missing from a partial list is unknown. No callback may modify a turn after timeout. Tests must not assert catalog data is proof of remote availability.
