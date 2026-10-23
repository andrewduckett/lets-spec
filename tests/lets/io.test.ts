import assert from 'node:assert/strict';
import { test } from 'node:test';
import { realIo } from '../../lets/src/io.ts';
import type { Child } from '../../lets/src/io.ts';

test('the real execFile survives a command that exits without reading its input', async () => {
  const io = realIo();
  assert.deepEqual(await io.execFile('true', [], { input: 'x'.repeat(1 << 20) }), { stdout: '', stderr: '', code: 0 });
  for (let i = 0; i < 20; i++) assert.equal((await io.execFile('true', [])).code, 0);
  assert.equal((await io.execFile('cat', [], { input: 'it\'s "q"\n' })).stdout, 'it\'s "q"\n');
});

test('the real execFile reports the child so a caller can kill it', async () => {
  const io = realIo();
  const started: { child?: Child } = {};
  const result = io.execFile('sleep', ['30'], { started: (child) => { started.child = child; } });
  assert.ok(started.child);
  started.child!.kill();
  assert.notEqual((await result).code, 0);
});

test('the real execFile stops a command that runs past its deadline', async () => {
  const began = Date.now();
  const result = await realIo().execFile('sleep', ['30'], { timeoutMs: 200 });
  assert.equal(result.timedOut, true);
  assert.ok(Date.now() - began < 10000);
});

test('the real execFile returns at its deadline when a child of the command keeps its output open', async () => {
  const began = Date.now();
  const result = await realIo().execFile('sh', ['-c', '(sleep 30) & sleep 30'], { timeoutMs: 200 });
  assert.equal(result.timedOut, true);
  assert.ok(Date.now() - began < 10000);
});

test('the real execFile reports no timeout for a command that finishes in time', async () => {
  assert.deepEqual(await realIo().execFile('echo', ['hi'], { timeoutMs: 10000 }), { stdout: 'hi\n', stderr: '', code: 0 });
});

test('the real execFile runs in the env it is given', async () => {
  const { stdout } = await realIo().execFile('sh', ['-c', 'echo "$ONLY"'], { env: { ONLY: 'this', PATH: process.env.PATH } });
  assert.equal(stdout, 'this\n');
});

test('the real sleep rejects when its signal aborts', async () => {
  const cancel = new AbortController();
  const slept = realIo().sleep(60000, cancel.signal);
  cancel.abort();
  await assert.rejects(slept, { name: 'AbortError' });
});
