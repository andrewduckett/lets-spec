// lets-delegate-cli end to end: the kit's handler with the real cli
// adapter, on a fake io.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildRequest } from '../../../../lets/src/resolvers/kit/protocol.ts';
import { handle } from '../kit/fixtures/handle.ts';
import { createAdapter } from '../../../../lets/src/resolvers/cli/cli.ts';
import { fakeIo } from '../kit/fixtures/fake-io.ts';

const probeRequest = JSON.stringify(buildRequest('probe', { cwd: '/r' }));
const runRequest = JSON.stringify(buildRequest('run', { cwd: '/r', name: 'x', prompt: 'P', sourceFamily: 'claude', effort: 'high', model: 'gpt' }));
const NO_CLI = { code: 75, stdout: '', stderr: 'lets-delegate-cli: none of codex, claude or agy is on PATH\n' };

test('probe answers cli with one family CLI on PATH', async () => {
  assert.deepEqual(await handle('probe', probeRequest, createAdapter(fakeIo({ commands: ['claude'] }))), { code: 0, stdout: '{"resolver":"cli","options":["claude"]}\n', stderr: '' });
});

test('probe answers cli inside another harness', async () => {
  const listing = { stdout: JSON.stringify({ models: [{ slug: 'gpt-6-luna', visibility: 'list' }] }), stderr: '', code: 0 };
  const insideT3 = fakeIo({ commands: ['codex'], env: { PATH: '/bin', T3CODE_HOME: '/home/u/.t3' }, results: [listing] });
  assert.deepEqual(await handle('probe', probeRequest, createAdapter(insideT3)), { code: 0, stdout: '{"resolver":"cli","options":["gpt/gpt-6-luna"]}\n', stderr: '' });
});

test('probe lists the bare family when codex is signed out, and names codex', async () => {
  const io = fakeIo({ commands: ['codex', 'claude'], results: [{ stdout: '', stderr: 'not logged in', code: 1 }] });
  const answer = await handle('probe', probeRequest, createAdapter(io));
  assert.deepEqual([answer.code, answer.stdout], [0, '{"resolver":"cli","options":["gpt","claude"]}\n']);
  assert.match(answer.stderr, /^lets-delegate-cli: .*codex/);
});

test('probe for start declines with every family CLI on PATH, running nothing', async () => {
  const io = fakeIo({ commands: ['codex', 'claude', 'agy'] });
  const request = JSON.stringify(buildRequest('probe', { cwd: '/r', verb: 'start' }));
  assert.deepEqual(await handle('probe', request, createAdapter(io)),
    { code: 75, stdout: '', stderr: 'lets-delegate-cli: this resolver only runs headless\n' });
  assert.deepEqual(io.calls, []);
});

test('probe for run answers cli', async () => {
  const request = JSON.stringify(buildRequest('probe', { cwd: '/r', verb: 'run' }));
  assert.deepEqual(await handle('probe', request, createAdapter(fakeIo({ commands: ['claude'] }))), { code: 0, stdout: '{"resolver":"cli","options":["claude"]}\n', stderr: '' });
});

test('probe declines with no family CLI on PATH', async () => {
  assert.deepEqual(await handle('probe', probeRequest, createAdapter(fakeIo({ commands: ['some-tool'] }))), NO_CLI);
});

test('run declines with no family CLI on PATH, starting nothing', async () => {
  const io = fakeIo({ commands: [] });
  assert.deepEqual(await handle('run', runRequest, createAdapter(io)), NO_CLI);
  assert.deepEqual(io.calls, []);
});

test('start declines with every family CLI on PATH, starting nothing', async () => {
  const io = fakeIo({ commands: ['codex', 'claude', 'agy'] });
  const request = JSON.stringify(buildRequest('start', { cwd: '/r', name: 'fix-login', prompt: 'P', model: 'claude' }));
  assert.deepEqual(await handle('start', request, createAdapter(io)),
    { code: 75, stdout: '', stderr: 'lets-delegate-cli: this resolver only runs headless\n' });
  assert.deepEqual(io.calls, []);
});

test('a review with codex answers codex\'s final message on gpt, with a process handle', async () => {
  const io = fakeIo({ commands: ['codex', 'claude'], results: [(cmd, args) => {
    io.files.set(args[args.indexOf('-o') + 1], 'FINDINGS\n');
    return { stdout: '', stderr: '', code: 0 };
  }] });
  const answer = await handle('run', runRequest, createAdapter(io));
  assert.equal(answer.code, 0);
  assert.deepEqual(JSON.parse(answer.stdout), { resolver: 'cli', text: 'FINDINGS\n', family: 'gpt', model: null, handle: { kind: 'process', id: 'x' } });
});

// A run request for model, at effort, from a claude author.
const runOn = (model: string, effort: 'low' | 'medium' | 'high' = 'high') =>
  JSON.stringify(buildRequest('run', { cwd: '/r', name: 'x', prompt: 'P', sourceFamily: 'claude', effort, model }));
// An io with every CLI on PATH, whose one run prints FINDINGS.
const answering = () => {
  const io = fakeIo({ commands: ['codex', 'claude', 'agy'], results: [(cmd, args) => {
    if (cmd === 'codex') io.files.set(args[args.indexOf('-o') + 1], 'FINDINGS\n');
    return { stdout: cmd === 'codex' ? '' : 'FINDINGS\n', stderr: '', code: 0 };
  }] });
  return io;
};
const argsOf = (io: ReturnType<typeof fakeIo>) => io.calls.map(([cmd, args]) => [cmd, args]);

test('a review with codex runs the given model with -m, and answers it', async () => {
  const io = answering();
  const answer = await handle('run', runOn('gpt/gpt-6-luna'), createAdapter(io));
  assert.equal(io.calls.length, 1);
  assert.deepEqual(io.calls[0][1].slice(io.calls[0][1].indexOf('-m'), io.calls[0][1].indexOf('-m') + 2), ['-m', 'gpt-6-luna']);
  assert.deepEqual(JSON.parse(answer.stdout), { resolver: 'cli', text: 'FINDINGS\n', family: 'gpt', model: 'gpt-6-luna', handle: { kind: 'process', id: 'x' } });
});

test('a bare family runs the CLI with no model argument', async () => {
  const io = answering();
  const answer = await handle('run', runOn('claude'), createAdapter(io));
  assert.deepEqual(argsOf(io), [['claude', ['-p', '--permission-mode', 'plan', '--effort', 'high']]]);
  assert.equal(JSON.parse(answer.stdout).family, 'claude');
});

test('a gemini model runs with the review\'s effort added', async () => {
  const io = answering();
  await handle('run', runOn('gemini/gemini-3.8-flash', 'high'), createAdapter(io));
  assert.deepEqual(argsOf(io)[0][1].slice(4, 6), ['--model', 'gemini-3.8-flash-high']);
});

test('a model the CLI never listed is still tried', async () => {
  const io = answering();
  await handle('run', runOn('gpt/gpt-6-astra'), createAdapter(io));
  assert.equal(io.calls.length, 1);
  assert.ok(io.calls[0][1].includes('gpt-6-astra'));
});

test('a run with no model is exit 2, naming it, and starts nothing', async () => {
  const io = fakeIo({ commands: ['claude'] });
  const answer = await handle('run', JSON.stringify({ ...JSON.parse(runOn('claude')), model: undefined }), createAdapter(io));
  assert.deepEqual([answer.code, answer.stdout], [2, '']);
  assert.match(answer.stderr, /model/);
  assert.deepEqual(io.calls, []);
});

test('codex refusing the model is exit 3, with the end of its stderr', async () => {
  const io = fakeIo({ commands: ['codex'], results: [{ stdout: '', stderr: 'error: model gpt-6-astra not available', code: 1 }] });
  const answer = await handle('run', runOn('gpt/gpt-6-astra'), createAdapter(io));
  assert.equal(answer.code, 3);
  assert.match(answer.stderr, /model gpt-6-astra not available/);
});

test('a codex refusal after an earlier run with the same name is exit 3, not 5', async () => {
  const io = fakeIo({ commands: ['codex'], files: { '/r/.workspace/lets-delegate/x.last-message.md': 'OLD FINDINGS\n' },
    results: [{ stdout: '', stderr: 'model not available', code: 1 }] });
  const answer = await handle('run', runOn('gpt/gpt-6-astra'), createAdapter(io));
  assert.equal(answer.code, 3);
});

// A claude review, from a codex author, whose CLI answers with result.
const claudeRun = JSON.stringify(buildRequest('run', { cwd: '/r', name: 'x', prompt: 'P', sourceFamily: 'gpt', effort: 'high', timeoutMinutes: 3, model: 'claude' }));
const reviewWith = (result: NonNullable<Parameters<typeof fakeIo>[0]>['results']) => handle('run', claudeRun, createAdapter(fakeIo({ commands: ['claude'], results: result })));

test('a CLI that prints and then exits non-zero is exit 5, with its exit and stderr', async () => {
  const answer = await reviewWith([{ stdout: 'half a review', stderr: 'rate limited', code: 2 }]);
  assert.equal(answer.code, 5);
  assert.equal(answer.stdout, '');
  assert.match(answer.stderr, /claude failed: exit 2: rate limited/);
});

test('a CLI that exits non-zero having printed nothing is a refusal, exit 3, with the end of its stderr', async () => {
  const answer = await reviewWith([{ stdout: '', stderr: 'model not found', code: 1 }]);
  assert.equal(answer.code, 3);
  assert.equal(answer.stdout, '');
  assert.match(answer.stderr, /claude refused: exit 1: model not found/);
});

test('a CLI that ends with an empty message is exit 5', async () => {
  const answer = await reviewWith([{ stdout: '\n', stderr: '', code: 0 }]);
  assert.equal(answer.code, 5);
  assert.match(answer.stderr, /empty final message/);
});

test('a codex run that writes no last message is exit 5', async () => {
  const answer = await handle('run', runRequest, createAdapter(fakeIo({ commands: ['codex'] })));
  assert.equal(answer.code, 5);
  assert.match(answer.stderr, /empty final message/);
});

test('a CLI that cannot start is a refusal, exit 3, naming the CLI', async () => {
  const io = fakeIo({ commands: ['claude'], execFile: async (cmd) => {
    throw new Error(`cannot run ${cmd}: spawn ${cmd} EACCES`);
  } });
  const answer = await handle('run', claudeRun, createAdapter(io));
  assert.equal(answer.code, 3);
  assert.match(answer.stderr, /^lets-delegate-cli: cannot run claude: /);
});

test('a CLI that runs past the timeout is stopped, and is exit 6', async () => {
  const answer = await reviewWith([{ stdout: '', stderr: '', code: 1, timedOut: true }]);
  assert.equal(answer.code, 6);
  assert.match(answer.stderr, /claude did not finish in 3 minutes/);
});

const LAST_MESSAGE = '/r/.workspace/lets-delegate/cli-resolver.last-message.md';
const finishCodex = (ok: boolean) => JSON.stringify(buildRequest('finish', { cwd: '/r', handle: { kind: 'process', id: 'cli-resolver' }, ok }));

test('finishing a review that succeeded removes its files', async () => {
  const io = fakeIo({ commands: ['codex'], files: { [LAST_MESSAGE]: 'FINDINGS\n' } });
  assert.deepEqual(await handle('finish', finishCodex(true), createAdapter(io)), { code: 0, stdout: '{}\n', stderr: '' });
  assert.equal(io.exists(LAST_MESSAGE), false);
});

test('finishing a review that failed keeps its files', async () => {
  const io = fakeIo({ commands: ['codex'], files: { [LAST_MESSAGE]: 'FINDINGS\n' } });
  assert.equal((await handle('finish', finishCodex(false), createAdapter(io))).code, 0);
  assert.equal(io.exists(LAST_MESSAGE), true);
});

test('finishing a review that wrote no files removes nothing', async () => {
  const io = fakeIo({ commands: ['claude'] });
  assert.deepEqual(await handle('finish', finishCodex(true), createAdapter(io)), { code: 0, stdout: '{}\n', stderr: '' });
  assert.deepEqual(io.removed, []);
});

test('finish removes nothing for a process handle whose id is not a session name', async () => {
  const io = fakeIo({ commands: ['codex'], files: { '/r/.workspace/lets-delegate/../x.last-message.md': 'X' } });
  const request = JSON.stringify(buildRequest('finish', { cwd: '/r', handle: { kind: 'process', id: '../x' }, ok: true }));
  const answer = await handle('finish', request, createAdapter(io));
  assert.equal(answer.code, 0);
  assert.match(answer.stderr, /could not finish process \.\.\/x/);
  assert.deepEqual(io.removed, []);
});

test('finish refuses a thread handle with exit 4', async () => {
  const request = JSON.stringify(buildRequest('finish', { cwd: '/r', handle: { kind: 'thread', id: 'T' }, ok: true }));
  const answer = await handle('finish', request, createAdapter(fakeIo({ commands: ['claude'] })));
  assert.equal(answer.code, 4);
  assert.equal(answer.stdout, '');
});
