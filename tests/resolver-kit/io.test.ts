import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parentPid, realIo } from '../../contrib/resolver-kit/src/io.ts';

test('execFile writes its input to the command\'s stdin', async () => {
  const { stdout, code } = await realIo().execFile('cat', [], { input: 'Say "hi".\nIt\'s fine.' });
  assert.deepEqual([stdout, code], ['Say "hi".\nIt\'s fine.', 0]);
});

test('execFile stops a command that runs past its timeout, and says it timed out', async () => {
  const started = Date.now();
  const result = await realIo().execFile('sleep', ['30'], { timeoutMs: 100 });
  assert.equal(result.timedOut, true);
  assert.ok(Date.now() - started < 10000, 'the command was stopped');
});

test('a command that ends in time has not timed out', async () => {
  const result = await realIo().execFile('true', [], { timeoutMs: 10000 });
  assert.deepEqual(result, { stdout: '', stderr: '', code: 0, timedOut: false });
});

// A fake system for parentPid: files maps a path to its text, and ps is
// what `ps` prints. calls records each command it runs.
function fakeSys({ files = {}, ps = '' }: { files?: Record<string, string>; ps?: string }) {
  const calls: string[][] = [];
  return {
    calls,
    readFileSync(path: string) {
      if (!(path in files)) throw new Error(`ENOENT: ${path}`);
      return files[path];
    },
    existsSync: (path: string) => path in files,
    spawnSync(cmd: string, args: string[]) {
      calls.push([cmd, ...args]);
      return { stdout: ps };
    },
  };
}

test('parentPid reads the PPid from /proc, and runs no ps', () => {
  const sys = fakeSys({ files: { '/proc/self': '', '/proc/42/status': 'Name:\tnode\nPPid:\t7\n' } });
  assert.equal(parentPid(42, sys), 7);
  assert.deepEqual(sys.calls, []);
});

test('with no /proc, parentPid asks ps, and trims what it prints', () => {
  const sys = fakeSys({ ps: '   7\n' });
  assert.equal(parentPid(42, sys), 7);
  assert.deepEqual(sys.calls, [['ps', '-o', 'ppid=', '-p', '42']]);
});

test('with /proc, parentPid gives null for a process that has exited, and runs no ps', () => {
  const sys = fakeSys({ files: { '/proc/self': '' }, ps: '7\n' });
  assert.equal(parentPid(42, sys), null);
  assert.deepEqual(sys.calls, []);
});

test('parentPid gives null when ps prints nothing, or something that is not a number', () => {
  for (const ps of ['', '\n', 'ppid\n', '7 8\n', '-1\n']) assert.equal(parentPid(42, fakeSys({ ps })), null, JSON.stringify(ps));
});
