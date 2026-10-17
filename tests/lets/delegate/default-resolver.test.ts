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

test('run picks the first other family on PATH, scrubs the env, and reads the last-message file', async () => {
  const io = fakeIo({
    commands: ['claude', 'codex'],
    results: [(cmd, args) => {
      io.files.set(args[args.indexOf('-o') + 1], 'FINDINGS');
      return { stdout: 'noise', stderr: '', code: 0 };
    }],
  });
  const { code, response } = await resolver(io).handle('run', runRequest('claude'));
  assert.equal(code, 0);
  assert.deepEqual(response, { resolver: 'default', text: 'FINDINGS', family: 'gpt', handle: { kind: 'process', id: '4242', name: 'x' } });
  assert.equal(io.files.get(`${DIR}/x.prompt.md`), 'PROMPT');
  const [[cmd, , opts]] = io.calls;
  assert.equal(cmd, 'codex');
  assert.equal(opts.cwd, '/r');
  assert.deepEqual(opts.env, { PATH: '/bin' });
  assert.equal(opts.input, 'PROMPT');
});

test('run falls back to the source family when no other is on PATH', async () => {
  const io = fakeIo({ commands: ['claude'], results: [{ stdout: 'FINDINGS', stderr: '', code: 0 }] });
  const { code, response } = await resolver(io).handle('run', runRequest('claude'));
  assert.equal(code, 0);
  assert.equal(response?.family, 'claude');
  assert.equal(io.calls[0][0], 'claude');
});

test('run with no executor on PATH exits 3 and starts nothing', async () => {
  const io = fakeIo();
  const { code, response, stderr } = await resolver(io).handle('run', runRequest('gpt'));
  assert.equal(code, 3);
  assert.equal(response, null);
  assert.match(stderr, /no family is available/);
  assert.deepEqual(io.calls, []);
});

test('a prompt with quotes, an apostrophe and a newline arrives unchanged', async () => {
  const agy = fakeIo({ commands: ['agy'], results: [{ stdout: 'ok', stderr: '', code: 0 }] });
  await resolver(agy).handle('run', runRequest('claude', TRICKY));
  const [[, agyArgs]] = agy.calls;
  assert.equal(agyArgs[agyArgs.indexOf('-p') + 1], TRICKY);
  const claude = fakeIo({ commands: ['claude'], results: [{ stdout: 'ok', stderr: '', code: 0 }] });
  await resolver(claude).handle('run', runRequest('gpt', TRICKY));
  assert.equal(claude.calls[0][2].input, TRICKY);
});

test('a non-zero executor is code 5 with the tail of stderr, and leaves the prompt file', async () => {
  const io = fakeIo({ commands: ['claude'], results: [{ stdout: '', stderr: `${'x'.repeat(600)}model refused`, code: 1 }] });
  const { code, stderr } = await resolver(io).handle('run', runRequest('gpt'));
  assert.equal(code, 5);
  assert.match(stderr, /exit 1: x+model refused/);
  assert.ok(stderr.length < 600);
  assert.ok(io.files.has(`${DIR}/x.prompt.md`));
});

test('an empty final message is code 5', async () => {
  const io = fakeIo({ commands: ['claude'], results: [{ stdout: ' \n', stderr: '', code: 0 }] });
  const { code, stderr } = await resolver(io).handle('run', runRequest('gpt'));
  assert.equal(code, 5);
  assert.match(stderr, /empty final message/);
});

test('an executor that cannot start is code 4', async () => {
  const io = fakeIo({ commands: ['claude'], results: [{ stdout: '', stderr: 'spawn claude ENOENT', code: null }] });
  const { code, stderr } = await resolver(io).handle('run', runRequest('gpt'));
  assert.equal(code, 4);
  assert.match(stderr, /ENOENT/);
});

test('past timeoutMinutes the child is killed and the code is 6', async () => {
  const io = fakeIo({ commands: ['claude'], results: [new Promise(() => {})] });
  const { code, stderr } = await resolver(io).handle('run', runRequest('gpt'));
  assert.equal(code, 6);
  assert.match(stderr, /45 minutes/);
  assert.deepEqual(io.killed, [4242]);
  assert.deepEqual(io.sleeps, [45 * 60000]);
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
