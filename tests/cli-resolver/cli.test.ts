import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SpawnRequest } from '../../contrib/resolver-kit/src/adapter.ts';
import { createAdapter, runCommand } from '../../contrib/cli-resolver/src/cli.ts';
import { fakeIo } from '../resolver-kit/fixtures/fake-io.ts';

const TRICKY = 'Say "hi".\nIt\'s fine.';
const LAST = '/r/.workspace/lets-delegate/x.last-message.md';
const OK = { stdout: '', stderr: '', code: 0 };

const command = (over: Partial<Parameters<typeof runCommand>[0]>) =>
  runCommand({ family: 'gpt', model: null, effort: 'high', prompt: TRICKY, lastMessagePath: LAST, timeoutMinutes: 45, ...over });

test('codex runs exec in its read-only sandbox, with the prompt on stdin and its last message in a file', () => {
  assert.deepEqual(command({}), {
    cmd: 'codex',
    args: ['exec', '-s', 'read-only', '-c', 'model_reasoning_effort="high"', '-o', LAST, '-'],
    input: TRICKY,
    readResultFrom: LAST,
  });
});
test('codex takes the reviewer\'s model with -m', () => {
  assert.deepEqual(command({ model: 'gpt-6.1-sol' }).args,
    ['exec', '-s', 'read-only', '-c', 'model_reasoning_effort="high"', '-m', 'gpt-6.1-sol', '-o', LAST, '-']);
});
test('claude runs -p in plan mode, with the prompt on stdin and its answer on stdout', () => {
  assert.deepEqual(command({ family: 'claude', effort: 'low' }),
    { cmd: 'claude', args: ['-p', '--permission-mode', 'plan', '--effort', 'low'], input: TRICKY, readResultFrom: 'stdout' });
});
test('claude takes the reviewer\'s model with --model', () => {
  assert.deepEqual(command({ family: 'claude', effort: 'low', model: 'claude-fable-5-1' }).args,
    ['-p', '--permission-mode', 'plan', '--effort', 'low', '--model', 'claude-fable-5-1']);
});
test('agy runs in plan mode, with the prompt as the argument of -p', () => {
  assert.deepEqual(command({ family: 'gemini', effort: 'medium', timeoutMinutes: 15 }), {
    cmd: 'agy',
    args: ['--mode', 'plan', '--effort', 'medium', '--print-timeout', '15m', '-p', TRICKY],
    input: undefined,
    readResultFrom: 'stdout',
  });
});
test('agy takes the reviewer\'s model with the effort added', () => {
  assert.deepEqual(command({ family: 'gemini', effort: 'high', model: 'gemini-3.8-flash' }).args,
    ['--mode', 'plan', '--effort', 'high', '--model', 'gemini-3.8-flash-high', '--print-timeout', '45m', '-p', TRICKY]);
});

test('a family is available when its CLI is on PATH', () => {
  assert.deepEqual(createAdapter(fakeIo({ commands: ['herdr', 'codex'] })).availableFamilies({ effort: 'low' }), { gpt: [null], claude: [], gemini: [] });
});
test('a family that is not available is one whose CLI is not on PATH', () => {
  assert.equal(createAdapter(fakeIo({ commands: ['claude'] })).whyNot?.('gpt'), 'codex is not on PATH');
});

const run: SpawnRequest = { kind: 'run', name: 'x', prompt: TRICKY, cwd: '/r', family: 'gpt', model: null, effort: 'high', readOnly: true };

test('a run\'s handle is a process named after the session', async () => {
  const session = await createAdapter(fakeIo({ commands: ['codex'] })).spawn(run);
  assert.deepEqual(session.handle, { kind: 'process', id: 'x' });
});

test('a codex run answers with the last message codex wrote', async () => {
  const io = fakeIo({ commands: ['codex'], results: [(cmd, args) => {
    io.files.set(args[args.indexOf('-o') + 1], 'FINDINGS\n');
    return OK;
  }] });
  const adapter = createAdapter(io);
  assert.deepEqual(await adapter.waitForResult(await adapter.spawn(run), { timeoutMs: 45 * 60000 }), { text: 'FINDINGS\n' });
  assert.ok(io.dirs.includes('/r/.workspace/lets-delegate'), 'the scratch folder exists before codex writes to it');
});

test('the CLI runs in the request\'s folder, with the prompt, the timeout and no session markers', async () => {
  const io = fakeIo({ commands: ['claude'], results: [{ stdout: 'FINDINGS\n', stderr: '', code: 0 }] });
  const adapter = createAdapter(io);
  const { text } = await adapter.waitForResult(await adapter.spawn({ ...run, family: 'claude' }), { timeoutMs: 15 * 60000 });
  assert.equal(text, 'FINDINGS\n');
  const [cmd, , options] = io.calls[0];
  assert.equal(cmd, 'claude');
  assert.deepEqual([options.cwd, options.input, options.timeoutMs], ['/r', TRICKY, 15 * 60000]);
  assert.equal(options.env?.CLAUDECODE, undefined);
  assert.equal(options.env?.PATH, '/bin');
});
