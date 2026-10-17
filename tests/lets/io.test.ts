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
  assert.equal(typeof started.child?.pid, 'number');
  started.child!.kill();
  assert.notEqual((await result).code, 0);
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
