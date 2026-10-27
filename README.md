# opencode-openai-router

A planned OpenCode plugin for selecting an available OpenAI model and reasoning effort appropriate to each coding task. It is intended to work with OpenCode's existing model catalog, authentication, and coding workflow.

## Status

This is a bare scaffold. The plugin loads an empty set of hooks and **does not route models, collect data, or change OpenCode's behavior yet**. Model discovery, routing controls, manual overrides, safe fallbacks, and local performance measurement are future work. The OpenCode plugin API's support for each of these behaviors needs to be verified before implementation.

The intended profiles are Economy, Balanced, and Quality. The design should avoid unnecessary model switches, respect user choices, and prioritize successful outcomes over token minimization. It should not require a separate paid classification service or manage credentials. Subscription allowance savings should only be claimed when reliably measurable.

## Development

Requires Node.js and npm.

```sh
npm install
npm run typecheck
npm test
```

The compiled plugin entry point is `dist/index.js`. For local experimentation, copy it into an OpenCode project's `.opencode/plugins/` directory and restart OpenCode. It is intentionally inert at this stage. See the [OpenCode plugin documentation](https://opencode.ai/docs/plugins/) for plugin loading and API details.

## CI and releases

CI installs locked dependencies, checks types, builds, and runs the Node.js test suite on pushes and pull requests to `main` and `development`. Add new tests under `test/` using the built-in test runner. Changes reach `main` through a pull request with a passing CI check.

To create a GitHub release, update the package version on `main`, then push a matching tag such as `v0.1.0` pointing to a commit on `main`. The release workflow checks the tag and ancestry, repeats the checks, and attaches an npm package archive to the GitHub release. It does not publish to an npm registry; the package remains private while the plugin is a scaffold.
