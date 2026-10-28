# opencode-openai-router

An OpenCode v2 plugin in development for selecting an available OpenAI model and reasoning effort appropriate to coding work. It uses OpenCode's existing authentication, model catalog and coding engine.

## Status and intended behavior

The package is an **inert scaffold**. Initial catalog, configuration and effort-recommendation utilities exist, but no routing, controls or observation collection runs from the plugin.

The accepted design uses native session switching. With automatic routing enabled, the plugin may replace a manual model or variant choice, update the picker and leave that selection in place for later turns. Disable routing for manual control; disabling will not restore an earlier selection or reverse a switch already issued. The planned profiles are Economy, Balanced and Quality, with optional router pins and local observations.

The initial target is OpenCode desktop **2.1.4**. Basic session switching has been observed in a desktop/local-provider fixture. Safe admission ordering, effective controls, policy quality and production compatibility remain implementation and release work. Catalog discovery does not establish model quality, account entitlement or subscription allowance savings.

## Documentation

Start with the [documentation index](docs/README.md). The [architecture abstract](docs/architecture.md) describes the design, the [PRD](docs/prd-v0.1.md) defines v0.1, and the [development plan](docs/development-plan.md) sequences the work. The [review synthesis](docs/review-synthesis.md) records development readiness, while the [feasibility assessment](docs/v2-product-feasibility.md) distinguishes experiments from product guarantees.

The v1 report and earlier research are retained under [history](docs/history/README.md). v1 support is outside scope; removing legacy source and dependencies is the first implementation task.

## Development

Use Node.js 24 and npm, matching CI:

```sh
npm ci
npm run typecheck
npm run check:docs
npm test
```

The compiled entry is `dist/index.js`. It is intentionally inert. See the [v2 plugin documentation](https://opencode.ai/v2/docs/build/plugins/) for host loading; validate APIs against the pinned SDK and binary because current online documentation may describe a newer contract.

After building, an optional credential-free probe can exercise a pinned host with a local provider:

```sh
npm run probe:v2 -- /absolute/path/to/opencode-2.1.4
```

The probe uses temporary directories and local provider fixtures. It has been exercised on macOS arm64 and is separate from ordinary CI. Run it without externally managed plugins or providers. Research scripts have different scopes, including explicitly live account tests; consult the [evidence guide](docs/evidence/README.md) before running them.

## CI and releases

CI installs locked dependencies, audits high/critical advisories, checks types and documentation, and runs the Node.js tests for pushes and pull requests targeting `main` and `development`. Add tests under `test/`. Existing tests include legacy v1 checks and do not establish v2 routing acceptance.

The current scaffold still carries a v1 plugin dependency with overrides for transitive `zod` and `toml` advisories. Its TOML compatibility test exercises Effect's parser, including the newer parser's safe-integer behavior. Review and retire these dependencies and their tests during v2-only cleanup. They are not bundled into the compiled entry.

The package remains private at `0.1.0-dev.0`. The release-readiness workflow explicitly fails instead of publishing until the [release gates](docs/specs/verification.md) are implemented and verified.
