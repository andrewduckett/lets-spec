// lets-delegate-t3 end to end: the kit's handler with the real T3 adapter,
// on a fake io.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildRequest } from '../../contrib/resolver-kit/src/protocol.ts';
import { handle } from '../../contrib/resolver-kit/src/resolver.ts';
import { createAdapter } from '../../contrib/t3-resolver/src/t3.ts';
import { fakeIo } from '../resolver-kit/fixtures/fake-io.ts';

const RUNTIME = '/home/u/.t3/userdata/server-runtime.json';
// This process is 100, and the T3 server is 7.
const io = (parents: Record<number, number>) => fakeIo({
  files: { [RUNTIME]: JSON.stringify({ pid: 7, origin: 'http://127.0.0.1:3773' }) },
  pid: 100,
  parentPid: (pid) => parents[pid] ?? null,
  processAlive: (pid) => pid === 7,
  env: {},
});
const insideT3 = () => io({ 100: 50, 50: 7, 7: 1 });
const probeRequest = JSON.stringify(buildRequest('probe', { cwd: '/r' }));

test('probe inside T3 Code answers t3', async () => {
  assert.deepEqual(await handle('probe', probeRequest, createAdapter(insideT3())), { code: 0, stdout: '{"resolver":"t3"}\n', stderr: '' });
});

test('probe declines when the running T3 server is not an ancestor', async () => {
  const elsewhere = io({ 100: 50, 50: 1 });
  assert.deepEqual(await handle('probe', probeRequest, createAdapter(elsewhere)), { code: 75, stdout: '', stderr: 'lets-delegate-t3: not inside T3 Code\n' });
});

test('finish refuses a tab handle with exit 4', async () => {
  const request = JSON.stringify(buildRequest('finish', { cwd: '/r', handle: { kind: 'tab', id: 'tab-3' }, ok: true }));
  const answer = await handle('finish', request, createAdapter(insideT3()));
  assert.equal(answer.code, 4);
  assert.equal(answer.stdout, '');
});
