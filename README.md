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
npm run build
```

The compiled plugin entry point is `dist/index.js`. For local experimentation, copy it into an OpenCode project's `.opencode/plugins/` directory and restart OpenCode. It is intentionally inert at this stage. See the [OpenCode plugin documentation](https://opencode.ai/docs/plugins/) for plugin loading and API details.
