import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RunInput } from '../../../../lets/src/resolvers/kit/adapter.ts';
import { createAdapter, runCommand } from '../../../../lets/src/resolvers/cli/cli.ts';
import type { ExecResult } from '../../../../lets/src/resolvers/kit/io.ts';
import { fakeIo } from '../kit/fixtures/fake-io.ts';

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

// What codex debug models and agy models print, trimmed to the fields read.
const codexModels = (...models: [string, string][]) => JSON.stringify({ models: models.map(([slug, visibility]) => ({ slug, visibility })) });
const agyModels = (...ids: string[]) => `Fetching available models...\n${ids.map((id) => `${id}\t${id.toUpperCase()}`).join('\n')}\n`;
type Listing = ExecResult | Error;
// An io with the CLIs on PATH, whose listings answer as given.
function listingIo(commands: string[], listings: Record<string, Listing>) {
  const io = fakeIo({ commands, execFile: async (cmd, args, options = {}) => {
    io.calls.push([cmd, args, options]);
    const listing = listings[cmd] ?? OK;
    if (listing instanceof Error) throw listing;
    return listing;
  } });
  return io;
}
const options = async (io: ReturnType<typeof fakeIo>) => {
  const warnings: string[] = [];
  return { options: await createAdapter(io).options((message) => warnings.push(message)), warnings };
};

test('claude is listed as its bare family, with no listing run', async () => {
  const io = listingIo(['claude'], {});
  assert.deepEqual(await options(io), { options: ['claude'], warnings: [] });
  assert.deepEqual(io.calls, []);
});

test('codex lists the slugs it shows, in its order', async () => {
  const io = listingIo(['codex'], { codex: { ...OK, stdout: codexModels(['gpt-reserve', 'hide'], ['gpt-6-luna', 'list'], ['gpt-6.1-sol', 'list']) } });
  assert.deepEqual((await options(io)).options, ['gpt/gpt-6-luna', 'gpt/gpt-6.1-sol']);
  assert.deepEqual(io.calls.map(([cmd, args]) => [cmd, args]), [['codex', ['debug', 'models']]]);
});

test('agy lists each gemini model once, without its effort', async () => {
  const io = listingIo(['agy'], { agy: { ...OK, stdout: agyModels('gemini-3.8-flash-high', 'gemini-3.8-flash-low', 'claude-sonnet-4-6', 'gemini-3.8-pro-medium') } });
  assert.deepEqual((await options(io)).options, ['gemini/gemini-3.8-flash', 'gemini/gemini-3.8-pro']);
  assert.deepEqual(io.calls.map(([cmd, args]) => [cmd, args]), [['agy', ['models']]]);
});

test('the families are listed gpt, claude, gemini', async () => {
  const io = listingIo(['agy', 'claude', 'codex'], {
    codex: { ...OK, stdout: codexModels(['gpt-6-luna', 'list']) }, agy: { ...OK, stdout: agyModels('gemini-3.8-flash-high') },
  });
  assert.deepEqual((await options(io)).options, ['gpt/gpt-6-luna', 'claude', 'gemini/gemini-3.8-flash']);
});

test('each listing has 20 seconds, and runs without the session markers', async () => {
  const io = listingIo(['codex', 'agy'], { codex: { ...OK, stdout: codexModels() }, agy: { ...OK, stdout: agyModels() } });
  await options(io);
  for (const [, , { timeoutMs, env }] of io.calls) {
    assert.equal(timeoutMs, 20_000);
    assert.equal(env?.CLAUDECODE, undefined);
  }
});

test('the listings run at the same time', async () => {
  const started: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const io = fakeIo({ commands: ['codex', 'agy'], execFile: async (cmd) => {
    started.push(cmd);
    if (started.length === 2) release();
    await gate;
    return { ...OK, stdout: cmd === 'codex' ? codexModels(['gpt-6-luna', 'list']) : agyModels('gemini-3.8-flash-high') };
  } });
  assert.deepEqual((await options(io)).options, ['gpt/gpt-6-luna', 'gemini/gemini-3.8-flash']);
});

test('a listing that fails lists the bare family, and warns naming the CLI', async () => {
  const failures: [string, Listing][] = [
    ['exits non-zero', { stdout: '', stderr: 'not logged in', code: 1 }],
    ['runs too long', { stdout: '', stderr: '', code: 1, timedOut: true }],
    ['prints what cannot be read', { ...OK, stdout: 'not json' }],
    ['cannot start', new Error('cannot run codex: spawn codex EACCES')],
  ];
  for (const [what, codex] of failures) {
    const { options: listed, warnings } = await options(listingIo(['codex', 'claude'], { codex }));
    assert.deepEqual(listed, ['gpt', 'claude'], what);
    assert.equal(warnings.length, 1, what);
    assert.match(warnings[0], /codex/, what);
  }
});

const run: RunInput = { name: 'x', prompt: TRICKY, cwd: '/r', family: 'gpt', model: null, effort: 'high' };

test('a run\'s handle is a process named after the session', async () => {
  const io = fakeIo({ commands: ['claude'], results: [{ stdout: 'FINDINGS\n', stderr: '', code: 0 }] });
  const { handle } = await createAdapter(io).run({ ...run, family: 'claude' }, { timeoutMs: 60000 });
  assert.deepEqual(handle, { kind: 'process', id: 'x' });
});

test('a codex run answers with the last message codex wrote', async () => {
  const io = fakeIo({ commands: ['codex'], results: [(cmd, args) => {
    io.files.set(args[args.indexOf('-o') + 1], 'FINDINGS\n');
    return OK;
  }] });
  const { text } = await createAdapter(io).run(run, { timeoutMs: 45 * 60000 });
  assert.equal(text, 'FINDINGS\n');
  assert.ok(io.dirs.includes('/r/.workspace/lets-delegate'), 'the scratch folder exists before codex writes to it');
});

test('the CLI runs in the request\'s folder, with the prompt, the timeout and no session markers', async () => {
  const io = fakeIo({ commands: ['claude'], results: [{ stdout: 'FINDINGS\n', stderr: '', code: 0 }] });
  const { text } = await createAdapter(io).run({ ...run, family: 'claude' }, { timeoutMs: 15 * 60000 });
  assert.equal(text, 'FINDINGS\n');
  const [cmd, , options] = io.calls[0];
  assert.equal(cmd, 'claude');
  assert.deepEqual([options.cwd, options.input, options.timeoutMs], ['/r', TRICKY, 15 * 60000]);
  assert.equal(options.env?.CLAUDECODE, undefined);
  assert.equal(options.env?.PATH, '/bin');
});
