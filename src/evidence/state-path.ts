import { closeSync, constants, lstatSync, mkdirSync, openSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

/** User-scoped, shared between projects; project settings never choose this location. */
export function evidenceStateDirectory(env: NodeJS.ProcessEnv = process.env, home = homedir()): string {
  const root = env.XDG_STATE_HOME && path.isAbsolute(env.XDG_STATE_HOME) ? env.XDG_STATE_HOME : path.join(home, '.local', 'state');
  return path.join(root, 'opencode-openai-router');
}

/** Return an existing private state file without creating files or directories. */
export function existingEvidenceState(directory: string): string | null {
  if (!path.isAbsolute(directory)) throw new Error('state directory must be absolute');
  const file = path.join(directory, 'evidence.sqlite');
  try {
    for (const entry of [directory, file]) {
      const info = lstatSync(entry);
      if (info.isSymbolicLink() || (entry === directory ? !info.isDirectory() : !info.isFile()) || (info.mode & 0o077) !== 0 || (typeof process.getuid === 'function' && info.uid !== process.getuid())) throw new Error('unsafe state path');
    }
    return file;
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}

/** Prepare a private plugin directory and database file. Not yet used by the installed plugin. */
export function prepareEvidenceState(directory: string): string {
  if (!path.isAbsolute(directory)) throw new Error('state directory must be absolute');
  const parent = path.dirname(directory);
  mkdirSync(parent, { recursive: true, mode: 0o700 });
  try { mkdirSync(directory, { mode: 0o700 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  const dir = lstatSync(directory);
  if (!dir.isDirectory() || dir.isSymbolicLink() || (dir.mode & 0o077) !== 0 || (typeof process.getuid === 'function' && dir.uid !== process.getuid())) throw new Error('unsafe state directory');
  const file = path.join(directory, 'evidence.sqlite');
  try {
    const fd = openSync(file, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | (constants.O_NOFOLLOW ?? 0), 0o600);
    closeSync(fd);
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  const info = lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) !== 0 || (typeof process.getuid === 'function' && info.uid !== process.getuid())) throw new Error('unsafe state file');
  for (const suffix of ['-journal', '-wal', '-shm']) {
    try {
      const sidecar = lstatSync(file + suffix);
      if (!sidecar.isFile() || sidecar.isSymbolicLink() || (sidecar.mode & 0o077) !== 0 || (typeof process.getuid === 'function' && sidecar.uid !== process.getuid())) throw new Error('unsafe state sidecar');
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  return file;
}
