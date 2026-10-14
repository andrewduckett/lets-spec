// Find and validate the release: the folder of files lets-sync copies from.
import { join } from 'node:path';
import { UsageError } from './main.mjs';

export const SKILLS_DST = '.agents/skills';
export const SCHEMAS_DST = 'openspec/schemas';
export const AGENTS = 'AGENTS.md';

// Where the release is. For now only WORKFLOW_RELEASE names it.
export function findRelease(env, _packageRoot) {
  const release = env.WORKFLOW_RELEASE ?? '';
  if (release === '') throw new UsageError('WORKFLOW_RELEASE is not set. Run lets-sync from the lets-spec flake.');
  return release;
}

// Fail unless the folder holds a release of lets-spec.
export function requireRelease(release, io) {
  if (!io.isDir(join(release, 'overlay', SKILLS_DST)) || !io.isDir(join(release, 'init')) ||
    io.readFile(join(release, 'fragments', AGENTS)) === null) {
    throw new UsageError(`${release} is not a release of lets-spec: it lacks overlay/${SKILLS_DST}/, init/ or fragments/${AGENTS}.`);
  }
}

// The name of the one schema folder the release holds.
export function releaseSchema(release, io) {
  const dir = join(release, 'overlay', SCHEMAS_DST);
  const names = io.isDir(dir) ? io.listDirs(dir) : [];
  if (names.length !== 1) {
    throw new UsageError(`${release} holds ${names.length} schemas in overlay/${SCHEMAS_DST}/; a release holds one.`);
  }
  return names[0];
}
