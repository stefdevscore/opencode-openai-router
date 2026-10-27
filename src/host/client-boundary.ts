/**
 * Conservative candidate boundary for the tested standalone 1.19.4 binary.
 * This is not wired to the plugin and must not enable automatic routing yet.
 */
export function isTestedStandaloneRun(hostVersion: string | undefined, argv: readonly string[]): boolean {
  if (hostVersion !== "1.19.4" || argv[2] !== "run") return false;
  return !argv.slice(3).some(arg =>
    arg === "--attach" || arg.startsWith("--attach=") ||
    arg === "--interactive" || arg.startsWith("--interactive=") ||
    arg === "--mini" || arg.startsWith("--mini=") ||
    arg === "--command" || arg.startsWith("--command=") ||
    arg.startsWith("-i"),
  );
}
