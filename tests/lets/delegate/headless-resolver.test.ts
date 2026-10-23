import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const RESOLVER = fileURLToPath(new URL('../../../contrib/headless-resolver', import.meta.url));

// Sends the example resolver a probe and resolves with what it did.
function probe(request: object): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((done) => {
    const child = execFile(RESOLVER, ['probe'], (error, stdout, stderr) => {
      done({ code: error ? (error.code as number) : 0, stdout, stderr });
    });
    child.stdin?.end(JSON.stringify(request));
  });
}

test('the example declines a probe for start', async () => {
  const result = await probe({ protocol: 2, cwd: '/repo', verb: 'start' });
  assert.deepEqual(result, { code: 75, stdout: '', stderr: 'headless-resolver: this resolver only runs headless\n' });
});

test('the example answers a probe for run', async () => {
  const result = await probe({ protocol: 2, cwd: '/repo', verb: 'run' });
  assert.deepEqual(result, { code: 0, stdout: '{"resolver":"headless-sh","options":["claude"]}\n', stderr: '' });
});

test('the example answers a probe with no verb', async () => {
  const result = await probe({ protocol: 2, cwd: '/repo' });
  assert.deepEqual(result, { code: 0, stdout: '{"resolver":"headless-sh","options":["claude"]}\n', stderr: '' });
});
