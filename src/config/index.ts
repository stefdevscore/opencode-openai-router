export type Profile = "economy" | "balanced" | "quality";
export type Role = "economy" | "general" | "complex";
export interface Config {
  mode: "recommend" | "off";
  profile: Profile;
  roles: Readonly<Record<Role, readonly string[]>>;
}
export type ConfigResult = { ok: true; config: Config } | { ok: false; reason: "invalid_config" };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Automatic mode is deliberately unavailable until host and quality gates pass. */
export function parseConfig(input: unknown): ConfigResult {
  if (input === undefined) input = {};
  if (!record(input) || Object.keys(input).some(key => !["mode", "profile", "roles"].includes(key))) return { ok: false, reason: "invalid_config" };
  const mode = input.mode ?? "recommend";
  const profile = input.profile ?? "balanced";
  if ((mode !== "recommend" && mode !== "off") || (profile !== "economy" && profile !== "balanced" && profile !== "quality")) return { ok: false, reason: "invalid_config" };
  const rawRoles = input.roles ?? {};
  if (!record(rawRoles) || Object.keys(rawRoles).some(key => !["economy", "general", "complex"].includes(key))) return { ok: false, reason: "invalid_config" };
  const roles: Record<Role, readonly string[]> = { economy: [], general: [], complex: [] };
  for (const role of ["economy", "general", "complex"] as const) {
    const ids = rawRoles[role] ?? [];
    if (!Array.isArray(ids) || ids.length > 16 || !ids.every(id => typeof id === "string" && id.length > 0 && id.length <= 128) || new Set(ids).size !== ids.length) return { ok: false, reason: "invalid_config" };
    roles[role] = [...ids];
  }
  return { ok: true, config: { mode, profile, roles } };
}
