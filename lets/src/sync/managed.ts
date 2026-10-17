// What lets-sync owns: the skills and schemas the release ships, and the
// project paths with the same names. It touches nothing else.
import { join } from 'node:path';
import type { Io } from '../io.ts';
import { UsageError } from './main.ts';
import { releaseSchemas, SCHEMAS_DST, SKILLS_DST } from './release.ts';

const MANAGED = [
  new RegExp(`^${SKILLS_DST.replace('.', '\\.')}/(lets|openspec)-[^/]+$`),
  new RegExp(`^${SCHEMAS_DST}/lets-[^/]+$`),
];

// True for a path relative to the project that lets-sync owns.
export function isManaged(path: string) {
  return MANAGED.some((pattern) => pattern.test(path));
}

// What the release ships: where each folder goes in the project (dst) and
// where it is in the release (src). Every dst must be one lets-sync owns.
export function releasePaths({ release, io }: { release: string; io: Io }) {
  const skills = join(release, 'overlay', SKILLS_DST);
  const paths = io.listDirs(skills).map((name) => ({ dst: `${SKILLS_DST}/${name}`, src: join(skills, name) }));
  for (const schema of releaseSchemas(release, io)) {
    paths.push({ dst: `${SCHEMAS_DST}/${schema}`, src: join(release, 'overlay', SCHEMAS_DST, schema) });
  }
  for (const { dst } of paths) {
    if (!isManaged(dst)) throw new UsageError(`${release} ships ${dst}, which lets sync does not own.`);
  }
  return paths;
}

// The managed paths that exist in the project, sorted. A link counts, even
// one whose target is gone.
export function projectPaths({ root, io }: { root: string; io: Io }) {
  const found = [];
  for (const parent of [SKILLS_DST, SCHEMAS_DST]) {
    for (const name of io.listNames(join(root, parent))) {
      const path = `${parent}/${name}`;
      if (isManaged(path)) found.push(path);
    }
  }
  return found.sort();
}
