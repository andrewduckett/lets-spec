import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { realIo } from '../../../lets/src/io.ts';
import type { Io } from '../../../lets/src/io.ts';
import { SpawnError, UsageError } from '../../../lets/src/delegate/errors.ts';
import { callResolver, candidates, resolve } from '../../../lets/src/delegate/lookup.ts';
import { buildRequest } from '../../../lets/src/delegate/protocol.ts';
import { fakeIo } from './fixtures/fake-io.ts';

const FAKE = fileURLToPath(new URL('fixtures/fake-resolver', import.meta.url));
// Where lets runs from, and the Node that runs it.
const SELF = { packageRoot: '/pkg', nodePath: '/bin/node' };
const SUBAGENT = '/pkg/contrib/lets-delegate-subagent';
// The source tree's lets, whose contrib/ links to the real subagent.
const SOURCE = { packageRoot: fileURLToPath(new URL('../../../lets', import.meta.url)), nodePath: process.execPath };
const runRequest = buildRequest('run', { cwd: '/r', name: 'x', prompt: 'P', sourceFamily: 'claude', effort: 'low' });
const probeRequest = buildRequest('probe', { cwd: '/r' });

// The real io, with the fake resolver's settings added to the env of each
// command it runs, and the commands it finds on PATH.
function ioWith(settings: Record<string, string>, onPath: string[] = []): Io {
  const io = realIo();
  return {
    ...io,
    commandExists: (cmd) => onPath.includes(cmd),
    execFile: (cmd, args, opts = {}) => io.execFile(cmd, args, { ...opts, cwd: undefined, env: { ...process.env, ...settings } }),
  };
}


test('the candidates are the override, the resolver on PATH, then the default', () => {
  const io = fakeIo({ executables: ['/bin/mine'], commands: ['lets-delegate-resolver'] });
  const list = candidates({ env: { LETS_SPEC_RESOLVER: '/bin/mine' }, io, cwd: '/r', ...SELF, config: null });
  assert.deepEqual(list.map((c) => c.name), ['/bin/mine', 'lets-delegate-resolver', SUBAGENT]);
  assert.deepEqual(list.map((c) => c.builtIn === true), [false, false, true]);
});

// A config that names resolver, and no reviewers.
const naming = (resolver: string | null) => ({ version: 1 as const, resolver, reviewers: [] });

test('the config\'s resolver comes after the override and before the resolver on PATH', () => {
  const io = fakeIo({ executables: ['/bin/mine', '/opt/r/resolver'], commands: ['lets-delegate-resolver'] });
  const list = candidates({ env: { LETS_SPEC_RESOLVER: '/bin/mine' }, io, cwd: '/r', ...SELF, config: naming('/opt/r/resolver') });
  assert.deepEqual(list.map((c) => c.name), ['/bin/mine', '/opt/r/resolver', 'lets-delegate-resolver', SUBAGENT]);
});

test('a config whose resolver is null adds no candidate', () => {
  const list = candidates({ env: {}, io: fakeIo(), cwd: '/r', ...SELF, config: naming(null) });
  assert.deepEqual(list.map((c) => c.name), [SUBAGENT]);
});

test('the config\'s resolver is asked once when it is also the resolver on PATH', () => {
  const io = fakeIo({ executables: ['/opt/r/lets-delegate-resolver'], commands: ['lets-delegate-resolver'] });
  const config = naming('/opt/r/lets-delegate-resolver');
  const list = candidates({ env: { PATH: '/usr/bin:/opt/r' }, io, cwd: '/r', ...SELF, config });
  assert.deepEqual(list.map((c) => c.name), ['/opt/r/lets-delegate-resolver', SUBAGENT]);
});

test('a configured resolver that is missing stops the lookup with a usage error naming the path and setup', async () => {
  const io = fakeIo({ commands: ['lets-delegate-resolver'] });
  const config = naming('/nix/store/gone/bin/lets-delegate-resolver');
  await assert.rejects(resolve('probe', probeRequest, { env: {}, io, cwd: '/r', ...SELF, config }),
    (error) => error instanceof UsageError && error.message.includes('/nix/store/gone/bin/lets-delegate-resolver')
      && error.message.includes('lets delegate setup'));
  assert.deepEqual(io.calls, [], 'no later resolver was asked');
});

test('an override that answers is not stopped by a missing configured resolver', async () => {
  const io = ioWith({});
  const { candidate } = await resolve('probe', probeRequest, { env: { LETS_SPEC_RESOLVER: FAKE }, io, cwd: '/r', ...SELF, config: naming('/no/such') });
  assert.equal(candidate.name, FAKE);
});

test('without an override or a resolver on PATH, only the default is a candidate', () => {
  assert.deepEqual(candidates({ env: { LETS_SPEC_RESOLVER: '' }, io: fakeIo(), cwd: '/r', ...SELF, config: null }).map((c) => c.name), [SUBAGENT]);
});

test('a relative override is taken from the working directory', () => {
  const io = fakeIo({ executables: ['/r/bin/mine'] });
  assert.equal(candidates({ env: { LETS_SPEC_RESOLVER: 'bin/mine' }, io, cwd: '/r', ...SELF, config: null })[0].name, '/r/bin/mine');
});

test('an override that is missing or not executable is a usage error that names the path', () => {
  assert.throws(() => candidates({ env: { LETS_SPEC_RESOLVER: '/no/such' }, io: fakeIo(), cwd: '/r', ...SELF, config: null }),
    (error) => error instanceof UsageError && error.message.includes('/no/such') && error.message.includes('LETS_SPEC_RESOLVER'));
});

test('the override answers when it does not decline, and is passed the verb and the request on stdin', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lets-lookup-'));
  const log = join(dir, 'log');
  const io = ioWith({ FAKE_RESOLVER_LOG: log }, ['lets-delegate-resolver']);
  const { candidate, outcome } = await resolve('run', runRequest, { env: { LETS_SPEC_RESOLVER: FAKE }, io, cwd: '/r', ...SELF, config: null });
  assert.equal(candidate.name, FAKE);
  assert.equal(outcome.code, 0);
  assert.deepEqual(outcome.response, { resolver: 'fake', text: 'FINDINGS', family: 'gpt', model: 'fake-model', handle: { kind: 'fake', id: 'f-1', extra: 'kept' } });
  assert.equal(readFileSync(log, 'utf8'), `run\t${JSON.stringify(runRequest)}\n`);
});

test('a decline passes the request to the next candidate', async () => {
  const io = ioWith({ FAKE_RESOLVER_EXIT: '75', FAKE_RESOLVER_STDOUT: '' });
  const { candidate, outcome } = await resolve('probe', probeRequest, { env: { LETS_SPEC_RESOLVER: FAKE }, io, cwd: '/r', ...SOURCE, config: null });
  assert.equal(candidate.name, join(SOURCE.packageRoot, 'contrib/lets-delegate-subagent'));
  assert.deepEqual(outcome.response, { resolver: 'subagent' });
});

test('the resolver on PATH is run by name', async () => {
  const io = fakeIo({ commands: ['lets-delegate-resolver'], results: [{ stdout: '{"resolver":"t3"}', stderr: '', code: 0 }] });
  const { candidate, outcome } = await resolve('probe', probeRequest, { env: {}, io, cwd: '/r', ...SELF, config: null });
  assert.equal(candidate.name, 'lets-delegate-resolver');
  assert.deepEqual(outcome.response, { resolver: 't3' });
  const [[cmd, args, opts]] = io.calls;
  assert.equal(cmd, 'lets-delegate-resolver');
  assert.deepEqual(args, ['probe']);
  assert.equal(opts.cwd, '/r');
  assert.equal(opts.env, undefined, 'a resolver inherits the real env');
  assert.equal(opts.input, JSON.stringify(probeRequest));
});

test('the default is lets-delegate-subagent beside lets, run with lets\'s own Node', async () => {
  const io = fakeIo({ files: { [SUBAGENT]: '' }, results: [{ stdout: '', stderr: 'no resolver started a session here', code: 3 }] });
  const { candidate, outcome } = await resolve('run', runRequest, { env: {}, io, cwd: '/r', ...SELF, config: null });
  assert.equal(candidate.name, SUBAGENT);
  assert.equal(outcome.code, 3);
  const [[cmd, args]] = io.calls;
  assert.equal(cmd, '/bin/node');
  assert.deepEqual(args, [SUBAGENT, 'run']);
});

test('a valid response with a non-zero exit: the exit code wins', async () => {
  const io = ioWith({ FAKE_RESOLVER_EXIT: '5', FAKE_RESOLVER_STDERR: 'session stopped to ask' });
  const { outcome } = await resolve('run', runRequest, { env: { LETS_SPEC_RESOLVER: FAKE }, io, cwd: '/r', ...SELF, config: null });
  assert.equal(outcome.code, 5);
  assert.equal(outcome.response, null);
  assert.match(outcome.stderr, /session stopped to ask/);
});

test('a decline after printing to stdout is a bug: exit 4', async () => {
  const io = ioWith({ FAKE_RESOLVER_EXIT: '75' });
  const { candidate, outcome } = await resolve('run', runRequest, { env: { LETS_SPEC_RESOLVER: FAKE }, io, cwd: '/r', ...SELF, config: null });
  assert.equal(candidate.name, FAKE);
  assert.equal(outcome.code, 4);
  assert.match(outcome.stderr, /declined after printing/);
});

test('a malformed request, a bad response or an unknown exit is exit 4 with the reason', async () => {
  const cases: [Record<string, string>, RegExp][] = [
    [{ FAKE_RESOLVER_EXIT: '2', FAKE_RESOLVER_STDOUT: '', FAKE_RESOLVER_STDERR: 'unknown protocol' }, /unknown protocol/],
    [{ FAKE_RESOLVER_STDOUT: '{"resolver":"fake","text":"T"}' }, /broke the contract.*family/],
    [{ FAKE_RESOLVER_STDOUT: 'not json' }, /broke the contract.*not JSON/],
    [{ FAKE_RESOLVER_EXIT: '9', FAKE_RESOLVER_STDOUT: '' }, /exited 9/],
  ];
  for (const [settings, message] of cases) {
    const { outcome } = await resolve('run', runRequest, { env: { LETS_SPEC_RESOLVER: FAKE }, io: ioWith(settings), cwd: '/r', ...SELF, config: null });
    assert.equal(outcome.code, 4, JSON.stringify(settings));
    assert.match(outcome.stderr, message);
  }
});

test('a resolver that cannot start is exit 4', async () => {
  const io = fakeIo({ commands: ['lets-delegate-resolver'], results: [{ stdout: '', stderr: 'spawn EACCES', code: null }] });
  const { outcome } = await resolve('probe', probeRequest, { env: {}, io, cwd: '/r', ...SELF, config: null });
  assert.equal(outcome.code, 4);
  assert.match(outcome.stderr, /cannot run lets-delegate-resolver: spawn EACCES/);
});

test('a resolver past the timeout is killed and reported as exit 6', async () => {
  const [candidate] = candidates({ env: { LETS_SPEC_RESOLVER: FAKE }, io: ioWith({}), cwd: '/r', ...SELF, config: null });
  const started = Date.now();
  const outcome = await callResolver(candidate, 'probe', probeRequest, { io: ioWith({ FAKE_RESOLVER_SLEEP_MS: '30000' }), timeoutMs: 200 });
  assert.equal(outcome?.code, 6);
  assert.match(outcome!.stderr, /did not answer probe/);
  assert.ok(Date.now() - started < 10000, 'the resolver was killed, not waited for');
});

test('the backstop for run is the session timeout plus one minute', async () => {
  const io = fakeIo({ commands: ['lets-delegate-resolver'], results: [new Promise(() => {})] });
  const { outcome } = await resolve('run', runRequest, { env: {}, io, cwd: '/r', ...SELF, config: null });
  assert.equal(outcome.code, 6);
  assert.deepEqual(io.sleeps, [16 * 60000]);
  assert.deepEqual(io.killed, [4242]);
});

test('a missing default stops the lookup with exit 4, naming the path and an incomplete install', async () => {
  const io = fakeIo();
  await assert.rejects(resolve('run', runRequest, { env: {}, io, cwd: '/r', ...SELF, config: null }),
    (error) => error instanceof SpawnError && error.message.includes(SUBAGENT) && error.message.includes('incomplete'));
  assert.deepEqual(io.calls, [], 'nothing was run');
});

test('a default that fails puts the install message before its own stderr', async () => {
  const cases = [{ stdout: '', stderr: 'SyntaxError: Unexpected token', code: 1 }, { stdout: '', stderr: 'spawn ENOENT', code: null }];
  for (const result of cases) {
    const io = fakeIo({ files: { [SUBAGENT]: 'garbage' }, results: [result] });
    const { outcome } = await resolve('run', runRequest, { env: {}, io, cwd: '/r', ...SELF, config: null });
    assert.equal(outcome.code, 4, JSON.stringify(result));
    assert.match(outcome.stderr, new RegExp(`^lets cannot run its default resolver at ${SUBAGENT}, so this lets install is incomplete\\. Reinstall lets\\.\n`));
    assert.ok(outcome.stderr.includes(result.stderr), JSON.stringify(result));
  }
});

test('a default that exits 3 gets no install message', async () => {
  const io = fakeIo({ files: { [SUBAGENT]: '' }, results: [{ stdout: '', stderr: 'run it in a subagent', code: 3 }] });
  const { outcome } = await resolve('run', runRequest, { env: {}, io, cwd: '/r', ...SELF, config: null });
  assert.equal(outcome.stderr, 'run it in a subagent');
});

test('a default that exits other than 0, 3 or 4 is exit 4 with the install message', async () => {
  for (const code of [5, 6, 75]) {
    const io = fakeIo({ files: { [SUBAGENT]: '' }, results: [{ stdout: '', stderr: 'odd', code }] });
    const { outcome } = await resolve('run', runRequest, { env: {}, io, cwd: '/r', ...SELF, config: null });
    assert.equal(outcome.code, 4, `exit ${code}`);
    assert.equal(outcome.response, null, `exit ${code}`);
    assert.match(outcome.stderr, /^lets cannot run its default resolver at .*incomplete/, `exit ${code}`);
  }
});

test('a failing default is named by its path, not by the Node that runs it', async () => {
  const io = fakeIo({ files: { [SUBAGENT]: '' }, results: [{ stdout: 'not json', stderr: '', code: 0 }] });
  const { outcome } = await resolve('start', buildRequest('start', { cwd: '/r', name: 'x', prompt: 'P' }), { env: {}, io, cwd: '/r', ...SELF, config: null });
  assert.match(outcome.stderr, new RegExp(`\n${SUBAGENT} broke the contract`));
  assert.doesNotMatch(outcome.stderr, /\/bin\/node/);
});
