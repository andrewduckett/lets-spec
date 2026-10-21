// lets-delegate-herdr end to end: the kit's handler with the real herdr
// adapter, on a fake io.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildRequest } from '../../contrib/resolver-kit/src/protocol.ts';
import { handle } from '../../contrib/resolver-kit/src/resolver.ts';
import { createAdapter } from '../../contrib/herdr-resolver/src/herdr.ts';
import { fakeIo } from '../resolver-kit/fixtures/fake-io.ts';

const insideHerdr = () => fakeIo({ commands: ['herdr'], env: { HERDR_ENV: '1' } });
const probeRequest = JSON.stringify(buildRequest('probe', { cwd: '/r' }));
const DECLINED = { code: 75, stdout: '', stderr: 'lets-delegate-herdr: not inside herdr\n' };

test('probe inside herdr answers herdr', async () => {
  assert.deepEqual(await handle('probe', probeRequest, createAdapter(insideHerdr())), { code: 0, stdout: '{"resolver":"herdr"}\n', stderr: '' });
});

test('probe declines when HERDR_ENV is unset', async () => {
  assert.deepEqual(await handle('probe', probeRequest, createAdapter(fakeIo({ commands: ['herdr'], env: {} }))), DECLINED);
});

test('probe declines when herdr is not on PATH', async () => {
  assert.deepEqual(await handle('probe', probeRequest, createAdapter(fakeIo({ commands: [], env: { HERDR_ENV: '1' } }))), DECLINED);
});

test('finish refuses a thread handle with exit 4', async () => {
  const request = JSON.stringify(buildRequest('finish', { cwd: '/r', handle: { kind: 'thread', id: 'T' }, ok: true }));
  const answer = await handle('finish', request, createAdapter(insideHerdr()));
  assert.equal(answer.code, 4);
  assert.equal(answer.stdout, '');
});
