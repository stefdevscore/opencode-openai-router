# Catalog normalization

Status: cut 4 implemented for review. The in-memory catalog and inspection action are implemented. The installed OpenCode 2.2 desktop displayed the connected provider and host-reported models; selecting a model displayed its variants. This is a read-only inspection check, not proof of model entitlement or a live routing test. No routing hook consumes the catalog.

The 2.2 provider list is a host availability view, not proof of connection: a provider configured as enabled can appear without a connection. The implementation checks the provider's associated integration for connection presence separately and retains only a boolean. This does not resolve credentials, check quota or prove entitlement. Available provider and model reads are separate host calls, not an atomic host snapshot; provider/model/integration/config events invalidate the in-memory cache, but startup and event delivery cannot establish an atomic authorization boundary. A future adapter must independently revalidate through a proven host boundary.

The desktop command palette action reads a bounded list of model IDs, context limits, tool support, input modalities and variant names. It never exposes variant settings or credentials. It reports when the host provider is absent, the connection is missing or needs authentication, results are incomplete or stale, or the list is truncated. The local fixture verifies that an enabled, disconnected OpenAI provider can expose model metadata without inference or session mutation; it does not test the user's account.

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
