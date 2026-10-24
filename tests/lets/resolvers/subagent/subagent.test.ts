// lets-delegate-subagent: the kit's verb layer with the subagent's answers,
// on a fake io.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildRequest } from '../../../../lets/src/resolvers/kit/protocol.ts';
import type { Verb } from '../../../../lets/src/resolvers/kit/protocol.ts';
import { respond } from '../../../../lets/src/resolvers/kit/verbs.ts';
import { Refused } from '../../../../lets/src/resolvers/kit/errors.ts';
import { createAdapter, createAnswer, PROGRAM } from '../../../../lets/src/resolvers/subagent/subagent.ts';
import { fakeIo } from '../kit/fixtures/fake-io.ts';
import type { FakeIo } from '../kit/fixtures/fake-io.ts';

const ask = (io: FakeIo, verb: Verb, request: object) => respond(PROGRAM, verb, JSON.stringify(request), createAnswer(io));
const runRequest = () => buildRequest('run', { cwd: '/r', name: 'x', prompt: 'PROMPT', sourceFamily: 'claude', effort: 'high', model: 'gpt' });

test('probe outside any harness answers subagent with no options', async () => {
  const io = fakeIo({ env: {} });
  assert.deepEqual(await ask(io, 'probe', buildRequest('probe', { cwd: '/r' })), { code: 0, stdout: '{"resolver":"subagent","options":[]}\n', stderr: '' });
});

test('probe for start answers subagent with no options', async () => {
  const io = fakeIo({ env: {} });
  assert.deepEqual(await ask(io, 'probe', buildRequest('probe', { cwd: '/r', verb: 'start' })), { code: 0, stdout: '{"resolver":"subagent","options":[]}\n', stderr: '' });
});

test('probe for an unknown verb exits 2 with nothing on stdout, naming verb', async () => {
  const answer = await ask(fakeIo({ env: {} }), 'probe', { protocol: 2, cwd: '/r', verb: 'finish' });
  assert.equal(answer.code, 2);
  assert.equal(answer.stdout, '');
  assert.match(answer.stderr, /verb/);
});

test('run exits 3 with nothing on stdout', async () => {
  const answer = await ask(fakeIo(), 'run', runRequest());
  assert.equal(answer.code, 3);
  assert.equal(answer.stdout, '');
});

test('run says no resolver started a session, and to use a subagent', async () => {
  const { stderr } = await ask(fakeIo(), 'run', runRequest());
  assert.match(stderr, /^lets-delegate-subagent: /);
  assert.match(stderr, /no resolver/);
  assert.match(stderr, /subagent\./);
  assert.doesNotMatch(stderr, /installed/);
});

test('run starts no process, even with every executor on PATH', async () => {
  const io = fakeIo({ commands: ['codex', 'claude', 'agy'] });
  await ask(io, 'run', runRequest());
  assert.deepEqual(io.calls, []);
});

const TRICKY = 'Say "hi".\nIt\'s fine.';
const DIR = '/r/.workspace/lets-delegate';
const startRequest = (model = 'claude') => buildRequest('start', { cwd: '/r', name: 'fix-login', prompt: TRICKY, model });

test('start saves the prompt in .workspace/lets-delegate under the cwd', async () => {
  const io = fakeIo();
  await ask(io, 'start', startRequest());
  assert.equal(io.files.get(`${DIR}/fix-login.prompt.md`), TRICKY);
});

test('start hands the prompt back with where it is saved, and no handle', async () => {
  const answer = await ask(fakeIo(), 'start', startRequest());
  assert.equal(answer.code, 0);
  assert.deepEqual(JSON.parse(answer.stdout), {
    resolver: 'subagent',
    handle: null,
    instructions: `Start any agent in /r and give it this prompt, which is also saved in .workspace/lets-delegate/fix-login.prompt.md:\n\n${TRICKY}`,
  });
});

test('start answers the same whichever valid model it is given', async () => {
  const bare = await ask(fakeIo(), 'start', startRequest());
  for (const model of ['gpt/gpt-6-luna', 'gemini']) assert.deepEqual(await ask(fakeIo(), 'start', startRequest(model)), bare, model);
});

test('start with an unknown family is exit 2, naming model', async () => {
  const answer = await ask(fakeIo(), 'start', startRequest('llama/llama-4'));
  assert.equal(answer.code, 2);
  assert.equal(answer.stdout, '');
  assert.match(answer.stderr, /model/);
});

test('start answers the same, and starts no process, whichever CLIs are on PATH', async () => {
  const bare = await ask(fakeIo({ commands: [] }), 'start', startRequest());
  const io = fakeIo({ commands: ['codex', 'claude', 'agy', 't3', 'some-tool'] });
  assert.deepEqual(await ask(io, 'start', startRequest()), bare);
  assert.deepEqual(io.calls, []);
});

test('finish exits 0 and prints nothing for any handle, removing no file', async () => {
  const files = { [`${DIR}/x.prompt.md`]: 'P' };
  const handles = [{ kind: 'process', id: '4242', name: 'x' }, { kind: 'thread', id: 't' }, { kind: 'process', id: '1', name: '../../etc' }];
  for (const handle of handles) {
    for (const ok of [true, false]) {
      const io = fakeIo({ files });
      assert.deepEqual(await ask(io, 'finish', buildRequest('finish', { cwd: '/r', handle, ok })), { code: 0, stdout: '', stderr: '' });
      assert.deepEqual(io.removed, []);
    }
  }
});

// createAdapter: the same answers, called in process.
const startInput = { cwd: '/r', name: 'fix-login', prompt: TRICKY, family: 'claude', model: null } as const;

test('the adapter is named subagent, always detects and lists no models', async () => {
  const adapter = createAdapter(fakeIo({ env: {} }));
  assert.equal(adapter.name, 'subagent');
  assert.equal(adapter.detect(), true);
  assert.deepEqual(await adapter.options(() => assert.fail('no warning')), []);
});

test('the adapter refuses run with the same message as the program, and starts no process', async () => {
  const io = fakeIo({ commands: ['codex', 'claude', 'agy'] });
  const { stderr } = await ask(fakeIo(), 'run', runRequest());
  await assert.rejects(createAdapter(io).run({ ...startInput, effort: 'high' }, { timeoutMs: 1000 }),
    (error) => error instanceof Refused && stderr === `lets-delegate-subagent: ${error.message}\n`);
  assert.deepEqual(io.calls, []);
});

test('the adapter\'s start saves the prompt and gives the program\'s instructions', async () => {
  const io = fakeIo();
  const { instructions } = JSON.parse((await ask(fakeIo(), 'start', startRequest())).stdout);
  assert.deepEqual(await createAdapter(io).start!(startInput), { instructions });
  assert.equal(io.files.get(`${DIR}/fix-login.prompt.md`), TRICKY);
  assert.deepEqual(io.calls, []);
});

test('the adapter\'s finish does nothing', async () => {
  const io = fakeIo({ files: { [`${DIR}/x.prompt.md`]: 'P' } });
  await createAdapter(io).finish({ kind: 'process', id: '1' }, true, { cwd: '/r' });
  assert.deepEqual(io.removed, []);
  assert.deepEqual(io.calls, []);
});
