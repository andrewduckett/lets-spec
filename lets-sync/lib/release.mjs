// Find and validate the release: the folder of files lets-sync copies from.
import { join } from 'node:path';
import { UsageError } from './main.mjs';

export const SKILLS_DST = '.agents/skills';
export const SCHEMAS_DST = 'openspec/schemas';
export const AGENTS = 'AGENTS.md';

// Where the release is: WORKFLOW_RELEASE when set, else the release this
// package ships for the flow and backlog.
export function findRelease(env, packageRoot, io) {
  if ((env.WORKFLOW_RELEASE ?? '') !== '') return env.WORKFLOW_RELEASE;
  const flow = env.LETS_SPEC_FLOW || 'standard';
  const backlog = env.LETS_SPEC_BACKLOG || 'github-labels';
  const release = join(packageRoot, 'releases', `${flow}-${backlog}`);
  if (!io.isDir(release)) {
    throw new UsageError(`there is no release for flow '${flow}' and backlog '${backlog}' at ${release}. Set LETS_SPEC_FLOW and LETS_SPEC_BACKLOG to a pair this release ships, or WORKFLOW_RELEASE to a release folder.`);
  }
  return release;
}

const VERSION = /\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?/;

// A warning when the OpenSpec CLI on PATH differs from the one that generated
// the release's openspec-* skills. Null when either version is unknown.
export async function openspecVersionWarning({ release, io }) {
  const text = io.readFile(join(release, '..', '..', 'release.json'));
  if (text === null) return null;
  let pinned;
  try {
    pinned = String(JSON.parse(text)?.openspec ?? '').match(VERSION)?.[0];
  } catch {
    return null;
  }
  if (pinned === undefined) return null;
  const result = await io.execFile('openspec', ['--version'], { cwd: release });
  if (result.code !== 0) return null;
  const found = result.stdout.match(VERSION)?.[0];
  if (found === undefined || found === pinned) return null;
  return `the OpenSpec CLI on PATH is ${found}, but this release's openspec-* skills were generated from ${pinned}. Pin the CLI to ${pinned}.`;
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
