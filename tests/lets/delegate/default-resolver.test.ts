import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDefaultResolver, runCommand } from '../../../lets/src/delegate/default-resolver.ts';
import { SESSION_MARKERS } from '../../../lets/src/delegate/env.ts';
import { buildRequest } from '../../../lets/src/delegate/protocol.ts';
import type { Family } from '../../../lets/src/delegate/protocol.ts';
import { fakeIo } from './fixtures/fake-io.ts';
import type { FakeIo } from './fixtures/fake-io.ts';

const TRICKY = 'Say "hi".\nIt\'s fine.';
const DIR = '/r/.workspace/lets-delegate';
const LAST = `${DIR}/x.last-message.md`;
const base = { effort: 'high', prompt: 'PROMPT', lastMessagePath: LAST, timeoutMinutes: 45 } as const;

// An env with every session marker set.
const markedEnv = () => Object.fromEntries([['PATH', '/bin'], ...SESSION_MARKERS.map((name) => [name, 'x'])]);

const runRequest = (sourceFamily: Family = 'claude', prompt = 'PROMPT') =>
  buildRequest('run', { cwd: '/r', name: 'x', prompt, sourceFamily, effort: 'high' });
const startRequest = () => buildRequest('start', { cwd: '/r', name: 'fix-login', prompt: TRICKY });
const resolver = (io: FakeIo) => createDefaultResolver(io, markedEnv());

test('gpt runs codex exec read-only, prompt on stdin, result from the last-message file', () => {
  assert.deepEqual(runCommand({ ...base, family: 'gpt' }), {
    cmd: 'codex',
    args: ['exec', '-s', 'read-only', '-c', 'model_reasoning_effort="high"', '-o', LAST, '-'],
    input: 'PROMPT',
    readResultFrom: LAST,
  });
});

test('claude runs claude -p in plan mode, prompt on stdin', () => {
  assert.deepEqual(runCommand({ ...base, family: 'claude', effort: 'low' }),
    { cmd: 'claude', args: ['-p', '--permission-mode', 'plan', '--effort', 'low'], input: 'PROMPT', readResultFrom: 'stdout' });
});

test('gemini runs agy in plan mode with the prompt as an argument', () => {
  assert.deepEqual(runCommand({ ...base, family: 'gemini', effort: 'medium', timeoutMinutes: 15 }), {
    cmd: 'agy',
    args: ['--mode', 'plan', '--effort', 'medium', '--print-timeout', '15m', '-p', 'PROMPT'],
    input: undefined,
    readResultFrom: 'stdout',
  });
});

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

test('start writes the prompt file and returns instructions naming the first of claude, codex, agy', async () => {
  const io = fakeIo({ commands: ['agy', 'codex'] });
  const { code, response } = await resolver(io).handle('start', startRequest());
  assert.equal(code, 0);
  assert.deepEqual(response, {
    resolver: 'default',
    handle: null,
    instructions: 'Open a terminal in /r and run: codex "$(cat .workspace/lets-delegate/fix-login.prompt.md)"',
  });
  assert.equal(io.files.get(`${DIR}/fix-login.prompt.md`), TRICKY);
  assert.deepEqual(io.calls, []);
});

test('start with no executor on PATH says to install one', async () => {
  const { code, response } = await resolver(fakeIo()).handle('start', startRequest());
  assert.equal(code, 0);
  assert.equal(response?.handle, null);
  assert.match((response as { instructions: string }).instructions, /^Install claude, codex or agy/);
  assert.match((response as { instructions: string }).instructions, /\.workspace\/lets-delegate\/fix-login\.prompt\.md/);
});

test('finish removes the scratch files when ok, and keeps them when not', async () => {
  const files = { [`${DIR}/x.prompt.md`]: 'P', [`${DIR}/x.last-message.md`]: 'M' };
  const handle = { kind: 'process', id: '4242', name: 'x' };
  const kept = fakeIo({ files });
  assert.deepEqual(await resolver(kept).handle('finish', buildRequest('finish', { cwd: '/r', handle, ok: false })),
    { code: 0, response: {}, stderr: '' });
  assert.deepEqual(kept.removed, []);
  const io = fakeIo({ files });
  assert.deepEqual(await resolver(io).handle('finish', buildRequest('finish', { cwd: '/r', handle, ok: true })),
    { code: 0, response: {}, stderr: '' });
  assert.deepEqual(io.removed.sort(), [`${DIR}/x.last-message.md`, `${DIR}/x.prompt.md`]);
});

test('finish with a handle the default never issued does nothing and answers nothing', async () => {
  for (const handle of [{ kind: 'thread', id: 't' }, { kind: 'process', id: '1' }, { kind: 'process', id: '1', name: '../../etc' }]) {
    const io = fakeIo();
    assert.deepEqual(await resolver(io).handle('finish', buildRequest('finish', { cwd: '/r', handle, ok: true })),
      { code: 0, response: null, stderr: '' });
    assert.deepEqual(io.removed, []);
  }
});
