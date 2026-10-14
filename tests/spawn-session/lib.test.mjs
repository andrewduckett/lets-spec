import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SESSION_MARKERS, scrubbedEnv } from '../../skills/spawn-session/scripts/lib/env.mjs';
import { isTreeClean, treeStatus } from '../../skills/spawn-session/scripts/lib/git.mjs';
import { pollUntil } from '../../skills/spawn-session/scripts/lib/wait.mjs';
import { SpawnError, TimeoutError } from '../../skills/spawn-session/scripts/lib/errors.mjs';
import { realIo } from '../../skills/spawn-session/scripts/lib/io.mjs';

test('scrubbedEnv removes every session marker, keeps the rest, and leaves its input alone', () => {
  assert.equal(SESSION_MARKERS.length, 9);
  const env = { PATH: '/bin' };
  for (const name of SESSION_MARKERS) env[name] = 'x';
  const before = { ...env };
  assert.deepEqual(scrubbedEnv(env), { PATH: '/bin' });
  assert.deepEqual(env, before);
});

function gitStub(stdout, cwd, code = 0) {
  return async (cmd, args, opts) => {
    assert.equal(cmd, 'git');
    assert.deepEqual(args, ['status', '--porcelain', '-z', '--untracked-files=all']);
    assert.deepEqual(opts, { cwd });
    return { stdout, stderr: 'fatal: index locked', code };
  };
}
const z = (...entries) => entries.map((e) => `${e}\0`).join('');

test('treeStatus lists each entry, keeps paths with spaces whole, and skips a rename source', async () => {
  assert.deepEqual(await treeStatus('/r', { execFile: gitStub('', '/r') }), []);
  assert.deepEqual(await treeStatus('/r', { execFile: gitStub(z(' M a b.md', '?? .workspace/x y', 'R  new', 'old'), '/r') }),
    [' M a b.md', '?? .workspace/x y', 'R  new']);
});
test('treeStatus fails loudly when git fails', async () => {
  await assert.rejects(treeStatus('/r', { execFile: gitStub('', '/r', 128) }), (error) => error instanceof SpawnError && /index locked/.test(error.message));
});
test('isTreeClean ignores .workspace/ and anything that was already there', async () => {
  assert.equal(await isTreeClean('/r', { execFile: gitStub('', '/r') }), true);
  assert.equal(await isTreeClean('/r', { execFile: gitStub(z(' M .workspace/x', '?? .workspace/spawn-session/y z'), '/r') }), true);
  assert.equal(await isTreeClean('/r', { execFile: gitStub(z(' M README.md'), '/r') }), false);
  assert.equal(await isTreeClean('/r', { execFile: gitStub(z(' M README.md', '?? .envrc'), '/r'), before: [' M README.md', '?? .envrc'] }), true);
  assert.equal(await isTreeClean('/r', { execFile: gitStub(z(' M README.md', '?? new.js'), '/r'), before: [' M README.md'] }), false);
});

function clock() {
  const c = { t: 0, sleeps: [] };
  c.now = () => c.t;
  c.sleep = async (ms) => { c.sleeps.push(ms); c.t += ms; };
  return c;
}

test('pollUntil resolves with the first defined value and sleeps the interval between checks', async () => {
  const c = clock();
  let checks = 0;
  const value = await pollUntil(() => (++checks === 3 ? 'done' : undefined), { intervalMs: 5000, timeoutMs: 60000, now: c.now, sleep: c.sleep });
  assert.equal(value, 'done');
  assert.equal(checks, 3);
  assert.deepEqual(c.sleeps, [5000, 5000]);
});
test('pollUntil throws TimeoutError once the deadline passes', async () => {
  const c = clock();
  await assert.rejects(pollUntil(() => undefined, { intervalMs: 5000, timeoutMs: 12000, now: c.now, sleep: c.sleep }), TimeoutError);
});

test('the real execFile survives a command that exits without reading its input', async () => {
  const io = realIo();
  assert.deepEqual(await io.execFile('true', [], { input: 'x'.repeat(1 << 20) }), { stdout: '', stderr: '', code: 0 });
  for (let i = 0; i < 20; i++) assert.equal((await io.execFile('true', [])).code, 0);
  assert.equal((await io.execFile('cat', [], { input: 'it\'s "q"\n' })).stdout, 'it\'s "q"\n');
});
