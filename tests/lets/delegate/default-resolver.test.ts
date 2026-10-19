import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDefaultResolver } from '../../../lets/src/delegate/default-resolver.ts';
import { buildRequest } from '../../../lets/src/delegate/protocol.ts';
import type { Family } from '../../../lets/src/delegate/protocol.ts';
import { fakeIo } from './fixtures/fake-io.ts';
import type { FakeIo } from './fixtures/fake-io.ts';

const TRICKY = 'Say "hi".\nIt\'s fine.';
const DIR = '/r/.workspace/lets-delegate';

const runRequest = (sourceFamily: Family = 'claude', prompt = 'PROMPT') =>
  buildRequest('run', { cwd: '/r', name: 'x', prompt, sourceFamily, effort: 'high' });
const startRequest = () => buildRequest('start', { cwd: '/r', name: 'fix-login', prompt: TRICKY });
const resolver = (io: FakeIo) => createDefaultResolver(io);

test('probe answers default', async () => {
  assert.deepEqual(await resolver(fakeIo()).handle('probe', { protocol: 1, cwd: '/r' }),
    { code: 0, response: { resolver: 'default' }, stderr: '' });
});

test('run exits 3, answers nothing, and starts nothing, even with every executor on PATH', async () => {
  const io = fakeIo({ commands: ['codex', 'claude', 'agy'] });
  const { code, response } = await resolver(io).handle('run', runRequest('claude'));
  assert.equal(code, 3);
  assert.equal(response, null);
  assert.deepEqual(io.calls, []);
});

test('start writes the prompt file and hands it back with where it is saved', async () => {
  const io = fakeIo();
  const { code, response } = await resolver(io).handle('start', startRequest());
  assert.equal(code, 0);
  assert.deepEqual(response, {
    resolver: 'default',
    handle: null,
    instructions: `Start any agent in /r and give it this prompt, which is also saved in .workspace/lets-delegate/fix-login.prompt.md:\n\n${TRICKY}`,
  });
  assert.equal(io.files.get(`${DIR}/fix-login.prompt.md`), TRICKY);
  assert.deepEqual(io.calls, []);
});

test('finish answers nothing for any handle, and removes no file', async () => {
  const files = { [`${DIR}/x.prompt.md`]: 'P', [`${DIR}/x.last-message.md`]: 'M' };
  const handles = [{ kind: 'process', id: '4242', name: 'x' }, { kind: 'thread', id: 't' }, { kind: 'process', id: '1', name: '../../etc' }];
  for (const handle of handles) {
    for (const ok of [true, false]) {
      const io = fakeIo({ files });
      assert.deepEqual(await resolver(io).handle('finish', buildRequest('finish', { cwd: '/r', handle, ok })),
        { code: 0, response: null, stderr: '' });
      assert.deepEqual(io.removed, []);
    }
  }
});
