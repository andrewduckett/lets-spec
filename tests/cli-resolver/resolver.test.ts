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

test('finish refuses a thread handle with exit 4', async () => {
  const request = JSON.stringify(buildRequest('finish', { cwd: '/r', handle: { kind: 'thread', id: 'T' }, ok: true }));
  const answer = await handle('finish', request, createAdapter(fakeIo({ commands: ['claude'] })));
  assert.equal(answer.code, 4);
  assert.equal(answer.stdout, '');
});
