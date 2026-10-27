# opencode-openai-router

A planned OpenCode plugin for selecting an available OpenAI model and reasoning effort appropriate to each coding task. It is intended to work with OpenCode's existing model catalog, authentication, and coding workflow.

## Status

This is a bare scaffold. The plugin loads an empty set of hooks and **does not route models, collect data, or change OpenCode's behavior yet**. Model discovery, routing controls, manual overrides, safe fallbacks, and local performance measurement are future work. The OpenCode plugin API's support for each of these behaviors needs to be verified before implementation.

The intended profiles are Economy, Balanced, and Quality. The design should avoid unnecessary model switches, respect user choices, and prioritize successful outcomes over token minimization. It should not require a separate paid classification service or manage credentials. Subscription allowance savings should only be claimed when reliably measurable.

See the [architecture abstract](docs/architecture.md) for the intended design and the [research note](docs/research.md) for supporting findings and implementation questions.

The [v0.1 product requirements](docs/prd-v0.1.md) define the release scope, acceptance criteria, and host compatibility gates. The [domain specifications](docs/specs/README.md) describe the planned contracts and verification for each part of the plugin.

The [host source review](docs/host-feasibility-v1.19.4.md) and [classifier assessment](docs/classifier-assessment.md) currently block an automatic v0.1 release.

## Development

Use Node.js 24 and npm for development, matching CI. Other Node.js versions have not been verified.

```sh
npm install
npm run typecheck
npm test
```

The compiled plugin entry point is `dist/index.js`. For local experimentation, copy it into an OpenCode project's `.opencode/plugins/` directory and restart OpenCode. It is intentionally inert at this stage. See the [OpenCode plugin documentation](https://opencode.ai/docs/plugins/) for plugin loading and API details.

## CI and releases

CI installs locked dependencies, audits for high or critical advisories, checks types, builds, and runs the Node.js test suite on pushes and pull requests to `main` and `development`. Add new tests under `test/` using the built-in test runner. Changes reach `main` through a pull request with a passing CI check.

Development dependency overrides patch advisories in the OpenCode plugin package's transitive `zod` and `toml` dependencies. An integration test exercises Effect's TOML file parser with valid and invalid input. The `toml` override crosses a major version: version 5 rejects integers outside JavaScript's safe range by default, so the test does not establish compatibility for every TOML document. These dependencies are not included in the compiled plugin. Revisit the overrides when upgrading the OpenCode plugin package or using its runtime APIs.

The tagged release workflow is disabled while the required release-evidence and approval gates are designed and verified. It does not publish to an npm registry; the package remains private while the plugin is a scaffold. See the [verification specification](docs/specs/verification.md) before enabling releases.
