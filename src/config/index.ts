export type Profile = "economy" | "balanced" | "quality";
export interface Config {
  mode: "auto" | "off";
  profile: Profile;
}
export type ConfigResult = { ok: true; config: Config } | { ok: false; reason: "invalid_config" };

/** Validating automatic mode does not activate the inert plugin. */
export function parseConfig(input: unknown): ConfigResult {
  if (input === undefined) input = {};
  if (typeof input !== "object" || input === null || Array.isArray(input)) return { ok: false, reason: "invalid_config" };
  const options = input as Record<string, unknown>;
  if (Object.keys(options).some(key => !["mode", "profile"].includes(key))) return { ok: false, reason: "invalid_config" };
  const mode = Object.hasOwn(options, "mode") ? options.mode : "auto";
  const profile = Object.hasOwn(options, "profile") ? options.profile : "balanced";
  if ((mode !== "auto" && mode !== "off") || (profile !== "economy" && profile !== "balanced" && profile !== "quality")) return { ok: false, reason: "invalid_config" };
  return { ok: true, config: { mode, profile } };
}
