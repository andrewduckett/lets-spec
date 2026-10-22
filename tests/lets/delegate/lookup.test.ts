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


// A config whose chain is resolvers.
const chain = (...resolvers: string[]) => ({ version: 2 as const, resolvers });

test('with no config, the candidates are the override, then the default', () => {
  const io = fakeIo({ executables: ['/bin/mine'] });
  const list = candidates({ env: { LETS_SPEC_RESOLVER: '/bin/mine' }, io, cwd: '/r', ...SELF, config: null });
  assert.deepEqual(list.map((c) => c.name), ['/bin/mine', SUBAGENT]);
  assert.deepEqual(list.map((c) => c.builtIn === true), [false, true]);
});

test('the config\'s chain follows the override, in the order listed', () => {
  const io = fakeIo({ executables: ['/bin/mine'] });
  const list = candidates({ env: { LETS_SPEC_RESOLVER: '/bin/mine' }, io, cwd: '/r', ...SELF, config: chain('/a', 'subagent', '/b') });
  assert.deepEqual(list.map((c) => c.name), ['/bin/mine', '/a', SUBAGENT, '/b']);
});

test('the subagent entry is the default beside lets, run with lets\'s own Node', () => {
  const [candidate] = candidates({ env: {}, io: fakeIo(), cwd: '/r', ...SELF, config: chain('subagent') });
  assert.deepEqual(candidate, { name: SUBAGENT, command: '/bin/node', args: [SUBAGENT], builtIn: true });
});

test('a listed path is never the default, even when it is a copy of lets-delegate-subagent', () => {
  const [candidate] = candidates({ env: {}, io: fakeIo(), cwd: '/r', ...SELF, config: chain('/opt/r/lets-delegate-subagent') });
  assert.equal(candidate.builtIn, undefined);
  assert.equal(candidate.command, '/opt/r/lets-delegate-subagent');
});

test('an empty chain has no candidates', () => {
  assert.deepEqual(candidates({ env: {}, io: fakeIo(), cwd: '/r', ...SELF, config: chain() }), []);
});

test('a resolver on PATH is never a candidate', () => {
  const io = fakeIo({ executables: ['/usr/bin/lets-delegate-resolver'], commands: ['lets-delegate-resolver'] });
  const env = { PATH: '/usr/bin' };
  assert.deepEqual(candidates({ env, io, cwd: '/r', ...SELF, config: null }).map((c) => c.name), [SUBAGENT]);
  assert.deepEqual(candidates({ env, io, cwd: '/r', ...SELF, config: chain('/a') }).map((c) => c.name), ['/a']);
});

const CONFIG_FILE = '/home/u/.config/lets-delegate/config.yaml';
const decline = { stdout: '', stderr: '', code: 75 };
const answer = (resolver: string) => ({ stdout: JSON.stringify({ resolver }), stderr: '', code: 0 });

test('when the first listed resolver declines, the next one answers', async () => {
  const io = fakeIo({ executables: ['/a', '/b'], results: [decline, answer('b')] });
  const { candidate, outcome } = await resolve('probe', probeRequest, { env: {}, io, cwd: '/r', ...SELF, config: chain('/a', '/b') });
  assert.equal(candidate.name, '/b');
  assert.deepEqual(outcome.response, { resolver: 'b' });
});

test('when the first listed resolver answers, the next one is never run', async () => {
  const io = fakeIo({ executables: ['/a', '/b'], results: [answer('a'), answer('b')] });
  await resolve('probe', probeRequest, { env: {}, io, cwd: '/r', ...SELF, config: chain('/a', '/b') });
  assert.deepEqual(io.calls.map(([cmd]) => cmd), ['/a']);
});

test('a listed resolver that is missing stops the lookup with a usage error naming the path and the config file', async () => {
  const io = fakeIo();
  const config = chain('/nix/store/gone/bin/lets-delegate-t3', 'subagent');
  await assert.rejects(resolve('probe', probeRequest, { env: {}, io, cwd: '/r', ...SELF, config }),
    (error) => error instanceof UsageError && error.message.includes('/nix/store/gone/bin/lets-delegate-t3')
      && error.message.includes(CONFIG_FILE) && !error.message.includes('setup'));
  assert.deepEqual(io.calls, [], 'no later resolver was asked');
});

test('a listed resolver that answers is not stopped by a missing path later in the chain', async () => {
  const io = fakeIo({ executables: ['/a'], results: [answer('a')] });
  const { candidate } = await resolve('probe', probeRequest, { env: {}, io, cwd: '/r', ...SELF, config: chain('/a', '/no/such') });
  assert.equal(candidate.name, '/a');
});

test('an override that answers is not stopped by a missing listed resolver', async () => {
  const io = ioWith({});
  const { candidate } = await resolve('probe', probeRequest, { env: { LETS_SPEC_RESOLVER: FAKE }, io, cwd: '/r', ...SELF, config: chain('/no/such') });
  assert.equal(candidate.name, FAKE);
});

test('an empty override is no candidate', () => {
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
  const io = ioWith({ FAKE_RESOLVER_LOG: log });
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

test('a listed resolver is run by its path', async () => {
  const io = fakeIo({ executables: ['/opt/r/lets-delegate-t3'], results: [{ stdout: '{"resolver":"t3"}', stderr: '', code: 0 }] });
  const { candidate, outcome } = await resolve('probe', probeRequest, { env: {}, io, cwd: '/r', ...SELF, config: chain('/opt/r/lets-delegate-t3') });
  assert.equal(candidate.name, '/opt/r/lets-delegate-t3');
  assert.deepEqual(outcome.response, { resolver: 't3' });
  const [[cmd, args, opts]] = io.calls;
  assert.equal(cmd, '/opt/r/lets-delegate-t3');
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
  const io = fakeIo({ executables: ['/opt/r/lets-delegate-t3'], results: [{ stdout: '', stderr: 'spawn EACCES', code: null }] });
  const { outcome } = await resolve('probe', probeRequest, { env: {}, io, cwd: '/r', ...SELF, config: chain('/opt/r/lets-delegate-t3') });
  assert.equal(outcome.code, 4);
  assert.match(outcome.stderr, /cannot run \/opt\/r\/lets-delegate-t3: spawn EACCES/);
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
  const io = fakeIo({ executables: ['/opt/r/lets-delegate-t3'], results: [new Promise(() => {})] });
  const { outcome } = await resolve('run', runRequest, { env: {}, io, cwd: '/r', ...SELF, config: chain('/opt/r/lets-delegate-t3') });
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
