// The source tree's lets, run as a process, finds its default through the
// committed lets/contrib/ symlink. The fakes in the other tests cannot see a
// missing or dangling link.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const LETS = fileURLToPath(new URL('../../../lets/bin/lets', import.meta.url));
// The git on this PATH. The Nix sandbox has no sh to ask.
const GIT = (process.env.PATH ?? '').split(delimiter).map((dir) => join(dir, 'git')).find((path) => existsSync(path))!;

// A git repository, and a PATH that holds git alone, so no other resolver is
// installed. HOME and XDG_CONFIG_HOME are empty, so no delegate config exists.
function bareRepo() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'lets-source-tree-')));
  const repo = join(root, 'repo');
  const bin = join(root, 'bin');
  mkdirSync(repo);
  mkdirSync(bin);
  symlinkSync(GIT, join(bin, 'git'));
  const env = { PATH: bin, HOME: root, XDG_CONFIG_HOME: join(root, 'config') };
  execFileSync('git', ['init', '--quiet'], { cwd: repo, env });
  return { repo, env };
}

test('the source tree\'s lets delegate handoff answers with subagent', () => {
  const { repo, env } = bareRepo();
  writeFileSync(join(repo, 'p.md'), 'Run lets-build on branch build-x');
  const result = spawnSync(process.execPath, [LETS, 'delegate', 'handoff', '--name', 'build-x', '--prompt-file', 'p.md'], { cwd: repo, env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).resolver, 'subagent');
  assert.equal(readFileSync(join(repo, '.workspace/lets-delegate/build-x.prompt.md'), 'utf8'), 'Run lets-build on branch build-x');
});
