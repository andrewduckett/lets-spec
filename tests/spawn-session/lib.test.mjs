import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SESSION_MARKERS, scrubbedEnv } from '../../skills/spawn-session/scripts/lib/env.mjs';
import { isTreeClean } from '../../skills/spawn-session/scripts/lib/git.mjs';
import { pollUntil } from '../../skills/spawn-session/scripts/lib/wait.mjs';
import { TimeoutError } from '../../skills/spawn-session/scripts/lib/errors.mjs';
import { realIo } from '../../skills/spawn-session/scripts/lib/io.mjs';

test('scrubbedEnv removes every session marker, keeps the rest, and leaves its input alone', () => {
  assert.equal(SESSION_MARKERS.length, 9);
  const env = { PATH: '/bin' };
  for (const name of SESSION_MARKERS) env[name] = 'x';
  const before = { ...env };
  assert.deepEqual(scrubbedEnv(env), { PATH: '/bin' });
  assert.deepEqual(env, before);
});

function gitStub(stdout, cwd) {
  return async (cmd, args, opts) => {
    assert.equal(cmd, 'git');
    assert.deepEqual(args, ['status', '--porcelain', '--untracked-files=all']);
    assert.deepEqual(opts, { cwd });
    return { stdout, stderr: '', code: 0 };
  };
}

test('isTreeClean ignores changes under .workspace/ and nothing else', async () => {
  assert.equal(await isTreeClean('/r', { execFile: gitStub('', '/r') }), true);
  assert.equal(await isTreeClean('/r', { execFile: gitStub(' M .workspace/x\n?? .workspace/spawn-session/y\n', '/r') }), true);
  assert.equal(await isTreeClean('/r', { execFile: gitStub(' M README.md\n', '/r') }), false);
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
