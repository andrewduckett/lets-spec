// lets-delegate-subagent: the kit's verb layer with the subagent's answers,
// on a fake io.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildRequest } from '../../contrib/resolver-kit/src/protocol.ts';
import type { Verb } from '../../contrib/resolver-kit/src/protocol.ts';
import { respond } from '../../contrib/resolver-kit/src/verbs.ts';
import { createAnswer, PROGRAM } from '../../contrib/subagent-resolver/src/subagent.ts';
import { fakeIo } from '../resolver-kit/fixtures/fake-io.ts';
import type { FakeIo } from '../resolver-kit/fixtures/fake-io.ts';

const ask = (io: FakeIo, verb: Verb, request: object) => respond(PROGRAM, verb, JSON.stringify(request), createAnswer(io));
const runRequest = () => buildRequest('run', { cwd: '/r', name: 'x', prompt: 'PROMPT', sourceFamily: 'claude', effort: 'high' });

test('probe outside any harness answers subagent', async () => {
  const io = fakeIo({ env: {} });
  assert.deepEqual(await ask(io, 'probe', buildRequest('probe', { cwd: '/r' })), { code: 0, stdout: '{"resolver":"subagent"}\n', stderr: '' });
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
