// subagent, the default resolver, on a fake io.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Refused } from '../../../../lets/src/resolvers/kit/errors.ts';
import { createAdapter } from '../../../../lets/src/resolvers/subagent/subagent.ts';
import { fakeIo } from '../kit/fixtures/fake-io.ts';

const TRICKY = 'Say "hi".\nIt\'s fine.';
const DIR = '/r/.workspace/lets-delegate';
const startInput = { cwd: '/r', name: 'fix-login', prompt: TRICKY, family: 'claude', model: null } as const;

test('the adapter is named subagent, always detects and lists no models', async () => {
  const adapter = createAdapter(fakeIo({ env: {} }));
  assert.equal(adapter.name, 'subagent');
  assert.equal(adapter.detect(), true);
  assert.deepEqual(await adapter.options(() => assert.fail('no warning')), []);
});

test('run is refused: no resolver started a session, so use a subagent', async () => {
  await assert.rejects(createAdapter(fakeIo()).run({ ...startInput, effort: 'high' }, { timeoutMs: 1000 }), (error) => {
    assert.ok(error instanceof Refused);
    assert.match(error.message, /no resolver/);
    assert.match(error.message, /subagent\./);
    assert.doesNotMatch(error.message, /installed/);
    return true;
  });
});

test('run starts no process, even with every executor on PATH', async () => {
  const io = fakeIo({ commands: ['codex', 'claude', 'agy'] });
  await assert.rejects(createAdapter(io).run({ ...startInput, effort: 'high' }, { timeoutMs: 1000 }), Refused);
  assert.deepEqual(io.calls, []);
});

test('start saves the prompt in .workspace/lets-delegate under the cwd, and hands it back with where it is saved', async () => {
  const io = fakeIo();
  assert.deepEqual(await createAdapter(io).start!(startInput), {
    instructions: `Start any agent in /r and give it this prompt, which is also saved in .workspace/lets-delegate/fix-login.prompt.md:\n\n${TRICKY}`,
  });
  assert.equal(io.files.get(`${DIR}/fix-login.prompt.md`), TRICKY);
});

test('start answers the same whichever model it is given', async () => {
  const bare = await createAdapter(fakeIo()).start!(startInput);
  for (const model of [{ family: 'gpt', model: 'gpt-6-luna' }, { family: 'gemini', model: null }] as const) {
    assert.deepEqual(await createAdapter(fakeIo()).start!({ ...startInput, ...model }), bare, model.family);
  }
});

test('start answers the same, and starts no process, whichever CLIs are on PATH', async () => {
  const bare = await createAdapter(fakeIo({ commands: [] })).start!(startInput);
  const io = fakeIo({ commands: ['codex', 'claude', 'agy', 't3', 'some-tool'] });
  assert.deepEqual(await createAdapter(io).start!(startInput), bare);
  assert.deepEqual(io.calls, []);
});

test('finish does nothing for any handle, removing no file', async () => {
  const handles = [{ kind: 'process', id: '4242', name: 'x' }, { kind: 'thread', id: 't' }, { kind: 'process', id: '1', name: '../../etc' }];
  for (const handle of handles) {
    for (const ok of [true, false]) {
      const io = fakeIo({ files: { [`${DIR}/x.prompt.md`]: 'P' } });
      await createAdapter(io).finish(handle, ok, { cwd: '/r' });
      assert.deepEqual(io.removed, []);
      assert.deepEqual(io.calls, []);
    }
  }
});
