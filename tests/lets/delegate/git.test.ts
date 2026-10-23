import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SpawnError, UsageError } from '../../../contrib/resolver-kit/src/errors.ts';
import { isTreeClean, repoRoot, treeStatus } from '../../../lets/src/delegate/git.ts';
import { fakeIo } from './fixtures/fake-io.ts';

// An io whose git status answers stdout, with the exit code given.
function gitIo(stdout: string, code = 0) {
  return fakeIo({
    results: [(cmd, args, opts) => {
      assert.equal(cmd, 'git');
      assert.deepEqual(args, ['status', '--porcelain', '-z', '--untracked-files=all']);
      assert.deepEqual(opts, { cwd: '/r' });
      return { stdout, stderr: 'fatal: index locked', code };
    }],
  });
}
const z = (...entries: string[]) => entries.map((e) => `${e}\0`).join('');

test('repoRoot is the top level, and outside a repo it is a usage error', async () => {
  assert.equal(await repoRoot('/r/sub', fakeIo({ results: [{ stdout: '/r\n', stderr: '', code: 0 }] })), '/r');
  await assert.rejects(repoRoot('/tmp', fakeIo({ results: [{ stdout: '', stderr: 'fatal', code: 128 }] })), UsageError);
});

test('treeStatus lists each entry, keeps paths with spaces whole, and skips a rename source', async () => {
  assert.deepEqual(await treeStatus('/r', gitIo('')), []);
  assert.deepEqual(await treeStatus('/r', gitIo(z(' M a b.md', '?? .workspace/x y', 'R  new', 'old'))),
    [' M a b.md', '?? .workspace/x y', 'R  new']);
});

test('treeStatus fails loudly when git fails', async () => {
  await assert.rejects(treeStatus('/r', gitIo('', 128)), (error) => error instanceof SpawnError && /index locked/.test(error.message));
});

test('isTreeClean ignores .workspace/ and anything that was already there', async () => {
  assert.equal(await isTreeClean('/r', gitIo('')), true);
  assert.equal(await isTreeClean('/r', gitIo(z(' M .workspace/x', '?? .workspace/lets-delegate/y z'))), true);
  assert.equal(await isTreeClean('/r', gitIo(z(' M README.md'))), false);
  assert.equal(await isTreeClean('/r', gitIo(z(' M README.md', '?? .envrc')), [' M README.md', '?? .envrc']), true);
  assert.equal(await isTreeClean('/r', gitIo(z(' M README.md', '?? new.js')), [' M README.md']), false);
});
