// The tripwire after a read-only session: did it change anything outside
// .workspace/, where scratch files belong? Compare the tree before and
// after, so the user's own uncommitted work does not count.
import type { Io } from '../io.ts';
import { SpawnError, UsageError } from '../resolvers/kit/errors.ts';

// The root of the repo cwd is in.
export async function repoRoot(cwd: string, io: Io): Promise<string> {
  const { stdout, code } = await io.execFile('git', ['rev-parse', '--show-toplevel'], { cwd });
  if (code !== 0) throw new UsageError(`${cwd} is not inside a git repo. Run lets delegate from the repo root.`);
  return stdout.trim();
}

// Each entry of `git status`: two status letters, a space, then the path.
// -z keeps a path with spaces whole; a rename adds its source as a second
// entry, which is skipped.
export async function treeStatus(cwd: string, io: Io): Promise<string[]> {
  const { stdout, stderr, code } = await io.execFile('git', ['status', '--porcelain', '-z', '--untracked-files=all'], { cwd });
  if (code !== 0) throw new SpawnError(`git status failed in ${cwd}: ${stderr.trim()}`);
  const tokens = stdout.split('\0').filter((token) => token !== '');
  const entries = [];
  for (let i = 0; i < tokens.length; i++) {
    entries.push(tokens[i]);
    if (tokens[i][0] === 'R' || tokens[i][0] === 'C') i++;
  }
  return entries;
}

// True when every entry was already there before, or is under .workspace/.
export async function isTreeClean(cwd: string, io: Io, before: string[] = []): Promise<boolean> {
  const after = await treeStatus(cwd, io);
  return after.every((entry) => before.includes(entry) || entry.slice(3).startsWith('.workspace/'));
}
