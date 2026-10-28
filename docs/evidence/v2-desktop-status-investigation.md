# Desktop status investigation: OpenCode 2.1.4

Update: OpenCode 2.2.0's experimental GUI plugin API now provides a command-palette action and native status dialog. The action has been observed in the installed desktop, and the isolated 2.2 server fixture checks its RPC without model requests or session changes. It is not exposed as a slash command because the desktop applies the composer's selection before running client slash commands. Switching compatibility and the rest of the release gates still need 2.2 verification.

The existing server command runs, but a user cannot see its result in the desktop conversation. In the pinned SDK, a server command executor returns `Promise<void>`; the [pinned command implementation](https://github.com/anomalyco/opencode/blob/68bc26b7da1990ce10ffecfbc1e09eb13aa5d824/packages/core/src/session/command.ts) delegates execution without a result payload. The [desktop composer](https://github.com/anomalyco/opencode/blob/68bc26b7da1990ce10ffecfbc1e09eb13aa5d824/packages/app/src/composer/submit.ts) sends the command and handles errors, but does not display a successful command result. Writing to the server's stderr therefore does not create a desktop message or toast.

## Experiments

- In the [recorded desktop check](v2-desktop-controls-2.1.4.json), the actual 2.1.4 desktop offered and ran the packed plugin's slash command in a disposable project, but showed no status result.
- A synthetic session input with `resume: false` appeared as an inbox update. The [pinned implementation](https://github.com/anomalyco/opencode/blob/68bc26b7da1990ce10ffecfbc1e09eb13aa5d824/packages/core/src/session/session.ts) admits it to the session inbox. It can affect later input, so it is not an appropriate read-only status surface.
- A prototype put bounded mode/profile data in the command description and reloaded the server command registry after refresh. The independent server API fixture saw the updated description without model requests. In the desktop, the menu first displayed `off`/`quality`; after the isolated file changed to `auto`/`balanced` and the command ran, reopening the menu still displayed `off`/`quality`. This cannot be trusted as a current status surface and the prototype was removed. This observation does not establish the exact internal cache invalidation mechanism.
- Source inspection also shows the pinned desktop composer can apply its selected model before sending a server command. A future inspection entry point must be tested for session selection effects, not only for the absence of inference.

The installed 2.1.4 plugin SDK had no desktop GUI export, and its desktop bundle did not expose a `gui-experimental` entry. The upstream [GUI documentation](https://opencode.ai/v2/docs/build/plugins/gui/) describes a newer experimental GUI surface that was not available on that desktop. A newer SDK archive alone did not establish runtime support; the subsequent 2.2 desktop check did.

## Disposition

Do not expose a stale command description, use synthetic inputs as status, claim a success result from an error notification, or submit a model prompt for inspection. The 2.1.4 server command was not a usable desktop inspection interface.

The 2.2 implementation uses the native GUI plugin surface and a typed server RPC for current control state. The isolated server tests cover fresh, invalid and off settings, no session/model mutation, no inference and packaging. GUI unload/reload and the complete 2.2 switching and release matrix remain work for later cuts. Automatic routing and release remain gated independently.
