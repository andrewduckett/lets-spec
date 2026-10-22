// lets-delegate-cli end to end: the kit's handler with the real cli
// adapter, on a fake io.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildRequest } from '../../contrib/resolver-kit/src/protocol.ts';
import { handle } from '../../contrib/resolver-kit/src/resolver.ts';
import { createAdapter } from '../../contrib/cli-resolver/src/cli.ts';
import { fakeIo } from '../resolver-kit/fixtures/fake-io.ts';

const probeRequest = JSON.stringify(buildRequest('probe', { cwd: '/r' }));
const runRequest = JSON.stringify(buildRequest('run', { cwd: '/r', name: 'x', prompt: 'P', sourceFamily: 'claude', effort: 'high' }));
const NO_CLI = { code: 75, stdout: '', stderr: 'lets-delegate-cli: none of codex, claude or agy is on PATH\n' };

test('probe answers cli with one family CLI on PATH', async () => {
  assert.deepEqual(await handle('probe', probeRequest, createAdapter(fakeIo({ commands: ['claude'] }))), { code: 0, stdout: '{"resolver":"cli"}\n', stderr: '' });
});

test('probe answers cli inside another harness', async () => {
  const insideT3 = fakeIo({ commands: ['codex'], env: { PATH: '/bin', T3CODE_HOME: '/home/u/.t3' } });
  assert.deepEqual(await handle('probe', probeRequest, createAdapter(insideT3)), { code: 0, stdout: '{"resolver":"cli"}\n', stderr: '' });
});

test('probe declines with no family CLI on PATH', async () => {
  assert.deepEqual(await handle('probe', probeRequest, createAdapter(fakeIo({ commands: ['herdr'] }))), NO_CLI);
});

test('run declines with no family CLI on PATH, starting nothing', async () => {
  const io = fakeIo({ commands: [] });
  assert.deepEqual(await handle('run', runRequest, createAdapter(io)), NO_CLI);
  assert.deepEqual(io.calls, []);
});

test('start declines with every family CLI on PATH, starting nothing', async () => {
  const io = fakeIo({ commands: ['codex', 'claude', 'agy'] });
  const request = JSON.stringify(buildRequest('start', { cwd: '/r', name: 'fix-login', prompt: 'P' }));
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

test('a reviewer whose CLI is not on PATH is skipped, and says so', async () => {
  const request = JSON.stringify({ ...JSON.parse(runRequest), reviewers: [{ family: 'gpt', model: 'gpt-6-luna' }] });
  const io = fakeIo({ commands: ['claude'] });
  const answer = await handle('run', request, createAdapter(io));
  assert.equal(answer.code, 3);
  assert.match(answer.stderr, /gpt\/gpt-6-luna: codex is not on PATH/);
  assert.deepEqual(io.calls, []);
});

// A claude review, from a codex author, whose CLI answers with result.
const claudeRun = JSON.stringify(buildRequest('run', { cwd: '/r', name: 'x', prompt: 'P', sourceFamily: 'gpt', effort: 'high', timeoutMinutes: 3 }));
const reviewWith = (result: NonNullable<Parameters<typeof fakeIo>[0]>['results']) => handle('run', claudeRun, createAdapter(fakeIo({ commands: ['claude'], results: result })));

test('a CLI that exits non-zero is exit 5, with its exit and stderr', async () => {
  const answer = await reviewWith([{ stdout: '', stderr: 'rate limited', code: 2 }]);
  assert.equal(answer.code, 5);
  assert.equal(answer.stdout, '');
  assert.match(answer.stderr, /claude failed: exit 2: rate limited/);
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

test('a CLI that cannot start is exit 4, naming the CLI', async () => {
  const io = fakeIo({ commands: ['claude'], execFile: async (cmd) => {
    throw new Error(`cannot run ${cmd}: spawn ${cmd} EACCES`);
  } });
  const answer = await handle('run', claudeRun, createAdapter(io));
  assert.equal(answer.code, 4);
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
