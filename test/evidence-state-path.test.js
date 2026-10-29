import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, lstat, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { evidenceStateDirectory, prepareEvidenceState } from '../dist/evidence/state-path.js';
import { EvidenceStore } from '../dist/evidence/store.js';

test('state path is user-scoped, creates private files, and can be reopened', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'router-path-'));
  try {
    assert.equal(evidenceStateDirectory({ XDG_STATE_HOME: 'relative' }, root), path.join(root, '.local/state/opencode-openai-router'));
    assert.equal(evidenceStateDirectory({ XDG_STATE_HOME: path.join(root, 'custom') }, root), path.join(root, 'custom/opencode-openai-router'));
    const directory = path.join(root, 'state/router'); const file = prepareEvidenceState(directory);
    assert.equal((await lstat(directory)).mode & 0o077, 0); assert.equal((await lstat(file)).mode & 0o077, 0);
    const store = new EvidenceStore(file); store.observe({ complete: true, modelIDs: ['a'] }); store.close();
    assert.equal(prepareEvidenceState(directory), file);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('unsafe state directories, database links and exposed permissions are rejected', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'router-path-'));
  try {
    assert.throws(() => prepareEvidenceState('relative'));
    const directory = path.join(root, 'router'); await mkdir(directory, { mode: 0o700 });
    const target = path.join(root, 'target'); await writeFile(target, 'x'); await symlink(target, path.join(directory, 'evidence.sqlite'));
    assert.throws(() => prepareEvidenceState(directory), /unsafe state file/);
    await rm(path.join(directory, 'evidence.sqlite')); await chmod(directory, 0o755);
    assert.throws(() => prepareEvidenceState(directory), /unsafe state directory/);
    await chmod(directory, 0o700); await symlink(target, path.join(directory, 'evidence.sqlite-wal'));
    assert.throws(() => prepareEvidenceState(directory), /unsafe state sidecar/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
