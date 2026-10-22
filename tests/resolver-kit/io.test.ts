import assert from 'node:assert/strict';
import { test } from 'node:test';
import { realIo } from '../../contrib/resolver-kit/src/io.ts';

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
