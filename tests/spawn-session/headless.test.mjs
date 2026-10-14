import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAdapter, critiqueCommand, handoffCommand } from '../../skills/spawn-session/scripts/adapters/headless.mjs';
import { ReviewerFailed, SpawnError, TimeoutError } from '../../skills/spawn-session/scripts/lib/errors.mjs';
import { codeReviewMessage } from '../../skills/spawn-session/scripts/lib/messages.mjs';
import { fakeIo } from './fixtures/fake-io.mjs';

const TRICKY = 'Say "hi".\nIt\'s fine.';
const DIR = '/r/.workspace/spawn-session';
const base = { model: null, effort: 'high', prompt: 'PROMPT', promptPath: `${DIR}/x.prompt.md`, lastMessagePath: `${DIR}/x.last-message.md`, codeReview: null, timeoutMinutes: 45 };

test('gpt critique with a prompt runs codex exec read-only, prompt on stdin, result from the last-message file', () => {
  assert.deepEqual(critiqueCommand({ ...base, family: 'gpt' }), {
    cmd: 'codex',
    args: ['exec', '-s', 'read-only', '-c', 'model_reasoning_effort="high"', '-o', `${DIR}/x.last-message.md`, '-'],
    stdin: 'PROMPT',
    readResultFrom: `${DIR}/x.last-message.md`,
  });
  assert.deepEqual(critiqueCommand({ ...base, family: 'gpt', model: 'gpt-6.1-sol' }).args,
    ['exec', '-s', 'read-only', '-c', 'model_reasoning_effort="high"', '-m', 'gpt-6.1-sol', '-o', `${DIR}/x.last-message.md`, '-']);
});
test('gpt code review runs codex review against the base', () => {
  assert.deepEqual(critiqueCommand({ ...base, family: 'gpt', codeReview: { base: 'main' } }),
    { cmd: 'codex', args: ['-s', 'read-only', 'review', '--base', 'main'], stdin: null, readResultFrom: 'stdout' });
});
test('claude critique with a prompt runs claude -p in plan mode', () => {
  assert.deepEqual(critiqueCommand({ ...base, family: 'claude', effort: 'low' }),
    { cmd: 'claude', args: ['-p', '--permission-mode', 'plan', '--effort', 'low'], stdin: 'PROMPT', readResultFrom: 'stdout' });
  assert.deepEqual(critiqueCommand({ ...base, family: 'claude', model: 'claude-fable-5-1' }).args,
    ['-p', '--permission-mode', 'plan', '--effort', 'high', '--model', 'claude-fable-5-1']);
});
test('claude code review runs the built-in /code-review', () => {
  assert.deepEqual(critiqueCommand({ ...base, family: 'claude', codeReview: { base: 'main' } }),
    { cmd: 'claude', args: ['-p', '/code-review high main...HEAD', '--permission-mode', 'plan'], stdin: null, readResultFrom: 'stdout' });
});
test('gemini critique runs agy in plan mode with the prompt as an argument', () => {
  assert.deepEqual(critiqueCommand({ ...base, family: 'gemini', model: 'gemini-3.8-flash-high' }), {
    cmd: 'agy',
    args: ['--mode', 'plan', '--effort', 'high', '--model', 'gemini-3.8-flash-high', '--print-timeout', '45m', '-p', 'PROMPT'],
    stdin: null,
    readResultFrom: 'stdout',
  });
  const review = codeReviewMessage({ family: 'gemini', base: 'main', effort: 'medium', harness: 'none' });
  assert.deepEqual(critiqueCommand({ ...base, family: 'gemini', effort: 'medium', timeoutMinutes: 15, codeReview: { base: 'main' } }),
    { cmd: 'agy', args: ['--mode', 'plan', '--effort', 'medium', '--print-timeout', '15m', '-p', review], stdin: null, readResultFrom: 'stdout' });
});
test('handoff commands', () => {
  assert.deepEqual(handoffCommand({ name: 'fix-login', prompt: 'Run it', model: null, attended: true, cwd: '/r', logPath: `${DIR}/fix-login.log` }),
    { cmd: 'gnome-terminal', args: ['--window', '--working-directory=/r', '--', 'claude', '--remote-control', 'fix-login', 'Run it'] });
  assert.deepEqual(handoffCommand({ name: 'fix-login', prompt: 'Run it', model: 'claude-sonnet-5-5', attended: true, cwd: '/r', logPath: `${DIR}/fix-login.log` }).args,
    ['--window', '--working-directory=/r', '--', 'claude', '--remote-control', 'fix-login', '--model', 'claude-sonnet-5-5', 'Run it']);
  assert.deepEqual(handoffCommand({ name: 'fix-login', prompt: 'Run it', model: null, attended: false, cwd: '/r', logPath: `${DIR}/fix-login.log` }),
    { cmd: 'claude', args: ['-p', 'Run it'] });
  assert.deepEqual(handoffCommand({ name: 'fix-login', prompt: 'Run it', model: 'claude-sonnet-5-5', attended: false, cwd: '/r', logPath: `${DIR}/fix-login.log` }).args,
    ['-p', '--model', 'claude-sonnet-5-5', 'Run it']);
});

const critiqueRequest = (over = {}) => ({ kind: 'critique', name: 'x', prompt: 'PROMPT', cwd: '/r', family: 'gpt', model: null, effort: 'high', attended: false, readOnly: true, codeReview: null, timeoutMinutes: 45, ...over });

test('detect is always true and availability follows the executors on PATH', () => {
  const adapter = createAdapter(fakeIo({ commands: ['claude'] }));
  assert.equal(adapter.name, 'none');
  assert.equal(adapter.detect({}), true);
  assert.deepEqual(adapter.availableFamilies({ effort: 'low' }), { gpt: [], claude: [null], gemini: [] });
});
test('a gpt critique scrubs the env, runs in cwd, and reads the last-message file', async () => {
  const io = fakeIo({ results: [(cmd, args) => { io.files.set(args[args.indexOf('-o') + 1], 'FINDINGS'); return { stdout: 'noise', stderr: '', code: 0 }; }] });
  const adapter = createAdapter(io);
  const handle = await adapter.spawn(critiqueRequest());
  assert.equal(handle.id, '4242');
  assert.equal(handle.kind, 'process');
  assert.equal(io.files.get(`${DIR}/x.prompt.md`), 'PROMPT');
  const [[cmd, , opts]] = io.calls;
  assert.equal(cmd, 'codex');
  assert.equal(opts.cwd, '/r');
  assert.deepEqual(opts.env, { PATH: '/bin' });
  assert.equal(opts.input, 'PROMPT');
  assert.deepEqual(await adapter.waitForResult(handle, { timeoutMs: 1000 }), { text: 'FINDINGS' });
  await adapter.finish(handle, true);
  assert.deepEqual(io.removed.sort(), [`${DIR}/x.last-message.md`, `${DIR}/x.prompt.md`]);
});
test('a prompt with quotes, an apostrophe and a newline arrives unchanged', async () => {
  const agy = fakeIo();
  await createAdapter(agy).spawn(critiqueRequest({ family: 'gemini', prompt: TRICKY }));
  const [[, agyArgs]] = agy.calls;
  assert.equal(agyArgs[agyArgs.indexOf('-p') + 1], TRICKY);
  const codex = fakeIo();
  await createAdapter(codex).spawn(critiqueRequest({ family: 'gpt', prompt: TRICKY }));
  assert.equal(codex.calls[0][2].input, TRICKY);
});
test('a non-zero exit is a reviewer failure carrying the stderr tail', async () => {
  const io = fakeIo({ results: [{ stdout: '', stderr: `${'x'.repeat(600)}model refused`, code: 1 }] });
  const adapter = createAdapter(io);
  const handle = await adapter.spawn(critiqueRequest({ family: 'claude' }));
  await assert.rejects(adapter.waitForResult(handle, { timeoutMs: 1000 }), (error) =>
    error instanceof ReviewerFailed && /^exit 1: /.test(error.message) && error.message.endsWith('model refused'));
});
test('a process that outlives the timeout is killed and is a TimeoutError', async () => {
  const io = fakeIo({ results: [new Promise(() => {})] });
  const adapter = createAdapter(io);
  const handle = await adapter.spawn(critiqueRequest({ family: 'claude' }));
  await assert.rejects(adapter.waitForResult(handle, { timeoutMs: 1000 }), TimeoutError);
  assert.deepEqual(io.killed, [4242]);
});
test('an attended handoff needs gnome-terminal and opens a window in cwd', async () => {
  const request = { kind: 'handoff', name: 'fix-login', prompt: TRICKY, cwd: '/r', family: 'claude', model: null, effort: null, attended: true, readOnly: false };
  await assert.rejects(createAdapter(fakeIo()).spawn(request), SpawnError);
  const io = fakeIo({ commands: ['gnome-terminal'] });
  assert.deepEqual(await createAdapter(io).spawn(request), { id: null, kind: 'window' });
  const [[cmd, args, opts]] = io.calls;
  assert.equal(cmd, 'gnome-terminal');
  assert.deepEqual(args, ['--window', '--working-directory=/r', '--', 'claude', '--remote-control', 'fix-login', TRICKY]);
  assert.deepEqual(opts.env, { PATH: '/bin' });
});
test('an unattended handoff runs claude -p detached with its output logged under .workspace', async () => {
  const io = fakeIo();
  const handle = await createAdapter(io).spawn({ kind: 'handoff', name: 'fix-login', prompt: 'Run it', cwd: '/r', family: 'claude', model: null, effort: null, attended: false, readOnly: false });
  assert.deepEqual(handle, { id: '4242', kind: 'process' });
  assert.deepEqual(io.detached, [['claude', ['-p', 'Run it'], { cwd: '/r', env: { PATH: '/bin' }, stdoutPath: `${DIR}/fix-login.log` }]]);
  assert.ok(io.dirs.includes(DIR));
});
