import { lstat, open, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { parseConfig, type Config } from "../config/index.js";

export type ControlDiagnostic = "invalid_config" | "unreadable_config" | "disposed";
export type ControlState = Readonly<{
  status: "ready" | ControlDiagnostic;
  /** Last valid settings, retained for diagnosis only when status is not ready. */
  config: Readonly<Config> | null;
  generation: number;
}>;
export type ControlRead = { status: "ready"; config: Config } | { status: "invalid_config" | "unreadable_config" };
export type ControlReader = () => Promise<ControlRead>;
export type Issuance<T> = { readonly issued: false } | { readonly issued: true; readonly completion: Promise<T> };

/** Distinguish a genuinely absent file from a dangling link in any path component. */
async function genuinelyAbsent(file: string): Promise<boolean> {
  let current = path.resolve(file);
  while (true) {
    try {
      const entry = await lstat(current);
      if (current === path.resolve(file)) return false;
      if (entry.isSymbolicLink()) await stat(current);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") return false;
      // A dangling symlink itself exists even though stat of its target fails.
      try { if ((await lstat(current)).isSymbolicLink()) return false; }
      catch (checkError) { if ((checkError as NodeJS.ErrnoException).code !== "ENOENT") return false; }
      const parent = path.dirname(current);
      if (parent === current) return false;
      current = parent;
    }
  }
}

/** Project options never choose this path. Relative XDG paths are ignored. */
export function userConfigPath(env: NodeJS.ProcessEnv = process.env, home = homedir()): string {
  const root = env.XDG_CONFIG_HOME && path.isAbsolute(env.XDG_CONFIG_HOME) ? env.XDG_CONFIG_HOME : path.join(home, ".config");
  return path.join(root, "opencode-openai-router", "config.json");
}

/** Missing initial user configuration uses defaults; no files are created or rewritten. */
export function fileControlReader(file: string): ControlReader {
  let seenFile = false;
  return async () => {
    let handle;
    try {
      handle = await open(file, constants.O_RDONLY | constants.O_NONBLOCK);
      seenFile = true;
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > 65536) return { status: "invalid_config" };
      const buffer = Buffer.alloc(65537);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
        if (bytesRead === 0) break;
        length += bytesRead;
      }
      if (length > 65536) return { status: "invalid_config" };
      let value: unknown;
      try { value = JSON.parse(buffer.subarray(0, length).toString("utf8")); }
      catch { return { status: "invalid_config" }; }
      const parsed = parseConfig(value);
      return parsed.ok ? { status: "ready", config: parsed.config } : { status: "invalid_config" };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT" && !seenFile) {
        if (await genuinelyAbsent(file)) {
          const parsed = parseConfig();
          if (parsed.ok) return { status: "ready", config: parsed.config };
        }
        seenFile = true;
      }
      return { status: "unreadable_config" };
    } finally {
      await handle?.close().catch(() => {});
    }
  };
}

/** Serializes reads; callers must refresh immediately before any future mutation. */
export class ControlStore {
  private state: ControlState = { status: "unreadable_config", config: null, generation: 0 };
  private tail: Promise<void> = Promise.resolve();
  private disposed = false;
  constructor(private readonly reader: ControlReader) {}

  snapshot(): ControlState {
    return { ...this.state, config: this.state.config ? { ...this.state.config } : null };
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const operation = this.tail.then(work);
    this.tail = operation.then(() => {}, () => {});
    return operation;
  }

  private async read(): Promise<ControlState> {
    if (this.disposed) return this.snapshot();
    let result: ControlRead;
    try { result = await this.reader(); }
    catch { result = { status: "unreadable_config" }; }
    if (this.disposed) return this.snapshot();
    const nextConfig = result.status === "ready" ? result.config : this.state.config;
    const changed = result.status !== this.state.status || nextConfig?.mode !== this.state.config?.mode || nextConfig?.profile !== this.state.config?.profile;
    this.state = { status: result.status, config: nextConfig ? { ...nextConfig } : null, generation: this.state.generation + Number(changed) };
    return this.snapshot();
  }

  refresh(): Promise<ControlState> {
    return this.enqueue(() => this.read());
  }

  /** start must synchronously issue the host operation before returning its promise. */
  issue<T>(generation: number, start: () => Promise<T>): Promise<Issuance<T>> {
    return this.enqueue(async () => {
      const state = await this.read();
      if (this.disposed || state.status !== "ready" || state.config?.mode !== "auto" || state.generation !== generation) return { issued: false };
      // No await separates the last control check from starting the operation.
      return { issued: true, completion: start() };
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.state = { ...this.state, status: "disposed", generation: this.state.generation + 1 };
  }
}
