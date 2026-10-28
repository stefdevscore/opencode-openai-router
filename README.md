# opencode-openai-router

An OpenCode v2 plugin in development for selecting an available OpenAI model and reasoning effort appropriate to coding work. It uses OpenCode's existing authentication, model catalog and coding engine.

## Status and intended behavior

The package is a development scaffold. User configuration and a server-side status command are implemented, but no automatic routing or observation collection runs from the plugin.

The accepted design uses native session switching. With automatic routing enabled, the plugin may replace a manual model or variant choice, update the picker and leave that selection in place for later turns. Disable routing for manual control; disabling will not restore an earlier selection or reverse a switch already issued. The planned profiles are Economy, Balanced and Quality, with optional local observations. There is no recommendation-only mode.

The initial target is OpenCode desktop **2.1.4**. Basic session switching has been observed in a desktop/local-provider fixture. Safe admission ordering, effective controls, policy quality and production compatibility remain implementation and release work. Catalog discovery does not establish model quality, account entitlement or subscription allowance savings. Planned background evidence lookup and optional budgeted model classification supply provisional capability assessments; coding-task assessment stays local and users do not assign model roles.

## Documentation

Start with the [documentation index](docs/README.md). The [architecture abstract](docs/architecture.md) describes the design, the [PRD](docs/prd-v0.1.md) defines v0.1, and the [development plan](docs/development-plan.md) sequences the work. The [review synthesis](docs/review-synthesis.md) records development readiness, while the [feasibility assessment](docs/v2-product-feasibility.md) distinguishes experiments from product guarantees.

The v1 report and earlier research are retained under [history](docs/history/README.md). v1 support is outside scope; legacy runtime code and dependencies have been removed.

## Development

Use Node.js 24 and npm, matching CI:

```sh
npm ci
npm run typecheck
npm run check:docs
npm test
```

The compiled entry is `dist/index.js`; `server.js` exposes it to the 2.1.4 local-directory loader. No routing hook is registered yet. See the [v2 plugin documentation](https://opencode.ai/v2/docs/build/plugins/) for host loading; validate APIs against the pinned SDK and binary because current online documentation may describe a newer contract.

## Controls under development

For the pinned macOS target, settings are read from `$XDG_CONFIG_HOME/opencode-openai-router/config.json` when `XDG_CONFIG_HOME` is absolute, otherwise `~/.config/opencode-openai-router/config.json`. Create the file yourself if you want settings other than the automatic Balanced default:

```json
{ "mode": "off", "profile": "balanced" }
```

`mode` accepts `auto` or `off`; `profile` accepts `economy`, `balanced` or `quality`. Unknown fields and invalid values are rejected. The plugin does not create or rewrite this file and ignores project plugin options. In this cut neither mode switches models. The registered `openai-router-status` server command refreshes the file and emits bounded JSON to the server log. Isolated host API tests verified the command without a coding prompt or provider request. The desktop discovers the command, but does not display its result; desktop inspection remains incomplete. See the [controls specification](docs/specs/controls.md) for reload and failure behavior.

After building, an optional credential-free probe can exercise a pinned host with a local provider:

```sh
npm run probe:v2 -- /absolute/path/to/opencode-2.1.4
node scripts/probe-v2-package.mjs /absolute/path/to/opencode-2.1.4
node scripts/probe-v2-inspection.mjs /absolute/path/to/opencode-2.1.4
```

The probe uses temporary directories and local provider fixtures. It has been exercised on macOS arm64 and is separate from ordinary CI. Run it without externally managed plugins or providers. Research scripts have different scopes, including explicitly live account tests; consult the [evidence guide](docs/evidence/README.md) before running them.

## CI and releases

CI installs locked dependencies, audits high/critical advisories, checks types and documentation, and runs the Node.js tests for pushes and pull requests targeting `main` and `development`. The tests pack and import the actual plugin entries from an extracted archive; the optional host probe additionally checks the pinned OpenCode loader. Add tests under `test/`. The foundation tests do not establish v2 routing acceptance.

The v1 plugin dependency and its overrides were removed. The remaining v2 dependency graph contains no `toml` package, so the legacy v1 TOML compatibility test is no longer applicable. Reassess dependencies and parser compatibility when future implementation introduces them.

The package remains private at `0.1.0-dev.0`. The release-readiness workflow explicitly fails instead of publishing until the [release gates](docs/specs/verification.md) are implemented and verified.
