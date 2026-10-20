import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Adapter, SpawnRequest } from '../../contrib/lets-delegate-resolver/src/adapter.ts';
import { SessionFailed, SpawnError, TimeoutError } from '../../contrib/lets-delegate-resolver/src/errors.ts';
import type { Available } from '../../contrib/lets-delegate-resolver/src/families.ts';
import { buildRequest } from '../../contrib/lets-delegate-resolver/src/protocol.ts';
import type { Handle } from '../../contrib/lets-delegate-resolver/src/protocol.ts';
import { handle } from '../../contrib/lets-delegate-resolver/src/resolver.ts';

type Options = { detects?: boolean; available?: Available; text?: string; spawnError?: Error; waitError?: Error; finishError?: Error };

// An adapter that records its calls and answers as told.
function fakeAdapter(name: string, kind: string, options: Options = {}) {
  const { detects = false, available = { gpt: ['gpt-6.1-sol'], claude: ['claude-fable-5-1'], gemini: [] }, text = 'FINDINGS' } = options;
  const calls: [string, unknown][] = [];
  const adapter: Adapter & { calls: typeof calls } = {
    name,
    calls,
    detect: () => detects,
    availableFamilies: (query) => {
      calls.push(['availableFamilies', query]);
      return available;
    },
    async spawn(request: SpawnRequest) {
      calls.push(['spawn', request]);
      if (options.spawnError) throw options.spawnError;
      return { handle: { kind, id: `${name}-1` }, inProcess: true };
    },
    async waitForResult(session, query) {
      calls.push(['wait', query]);
      if (options.waitError) throw options.waitError;
      return { text };
    },
    async finish(h: Handle, ok: boolean) {
      calls.push(['finish', { h, ok }]);
      if (options.finishError) throw options.finishError;
    },
  };
  return adapter;
}

const adapters = (t3: Options = {}, herdr: Options = {}) => ({ t3: fakeAdapter('t3', 'thread', t3), herdr: fakeAdapter('herdr', 'tab', herdr) });
const json = (request: object) => JSON.stringify(request);
const runRequest = json(buildRequest('run', { cwd: '/r', name: 'x', prompt: 'P', sourceFamily: 'claude', effort: 'high', timeoutMinutes: 3 }));
const startRequest = json(buildRequest('start', { cwd: '/r', name: 'fix-login', prompt: 'P' }));
const probeRequest = json(buildRequest('probe', { cwd: '/r' }));
const finishRequest = (h: Handle, ok = true) => json(buildRequest('finish', { cwd: '/r', handle: h, ok }));

test('probe answers t3 before herdr, herdr alone, and declines with neither', async () => {
  assert.deepEqual(await handle('probe', probeRequest, adapters({ detects: true }, { detects: true })), { code: 0, stdout: '{"resolver":"t3"}\n', stderr: '' });
  assert.equal((await handle('probe', probeRequest, adapters({}, { detects: true }))).stdout, '{"resolver":"herdr"}\n');
  const declined = await handle('probe', probeRequest, adapters());
  assert.equal(declined.code, 75);
  assert.equal(declined.stdout, '');
});

test('run and start decline outside T3 and herdr, before starting anything', async () => {
  for (const [verb, request] of [['run', runRequest], ['start', startRequest]]) {
    const all = adapters();
    assert.equal((await handle(verb, request, all)).code, 75);
    assert.deepEqual([...all.t3.calls, ...all.herdr.calls].filter(([call]) => call === 'spawn'), []);
  }
});

test('run picks a family other than the source, spawns read-only, and waits the timeout', async () => {
  const all = adapters({ detects: true });
  const answer = await handle('run', runRequest, all);
  assert.equal(answer.code, 0);
  assert.deepEqual(JSON.parse(answer.stdout), { resolver: 't3', text: 'FINDINGS', family: 'gpt', model: 'gpt-6.1-sol', handle: { kind: 'thread', id: 't3-1' } });
  assert.deepEqual(all.t3.calls, [
    ['availableFamilies', { effort: 'high' }],
    ['spawn', { kind: 'run', name: 'x', prompt: 'P', cwd: '/r', family: 'gpt', model: 'gpt-6.1-sol', effort: 'high', readOnly: true }],
    ['wait', { timeoutMs: 3 * 60000 }],
  ]);
});

test('start spawns an interactive claude session and returns its handle', async () => {
  const all = adapters({}, { detects: true });
  const answer = await handle('start', startRequest, all);
  assert.deepEqual(JSON.parse(answer.stdout), { resolver: 'herdr', handle: { kind: 'tab', id: 'herdr-1' } });
  assert.deepEqual(all.herdr.calls, [['spawn', { kind: 'start', name: 'fix-login', prompt: 'P', cwd: '/r', family: 'claude', model: null, effort: null, readOnly: false }]]);
});

test('each error class is its exit code, with nothing on stdout', async () => {
  const cases: [Options, number, RegExp][] = [
    [{ available: { gpt: [], claude: [], gemini: [] } }, 3, /no family is available/],
    [{ spawnError: new SpawnError('t3 has no project') }, 4, /t3 has no project/],
    [{ waitError: new SessionFailed('the session stopped to ask') }, 5, /stopped to ask \(thread t3-1\)/],
    [{ waitError: new TimeoutError('no result') }, 6, /no result \(thread t3-1\)/],
    [{ text: ' \n' }, 5, /empty final message \(thread t3-1\)/],
  ];
  for (const [options, code, message] of cases) {
    const answer = await handle('run', runRequest, adapters({ detects: true, ...options }));
    assert.equal(answer.code, code, message.source);
    assert.equal(answer.stdout, '');
    assert.match(answer.stderr, message);
  }
});

test('a malformed request or an unknown verb is exit 2', async () => {
  for (const [verb, request] of [['run', 'not json'], ['run', json({ protocol: 99, cwd: '/r' })], ['review', probeRequest]]) {
    const answer = await handle(verb, request, adapters({ detects: true }));
    assert.equal(answer.code, 2, `${verb} ${request}`);
    assert.equal(answer.stdout, '');
  }
});

test('finish goes to the harness the handle names, even outside it', async () => {
  const all = adapters();
  assert.deepEqual(await handle('finish', finishRequest({ kind: 'tab', id: 'tab-3' }, false), all), { code: 0, stdout: '{}\n', stderr: '' });
  assert.deepEqual(all.herdr.calls, [['finish', { h: { kind: 'tab', id: 'tab-3' }, ok: false }]]);
  await handle('finish', finishRequest({ kind: 'thread', id: 'T', origin: 'http://x' }), all);
  assert.deepEqual(all.t3.calls, [['finish', { h: { kind: 'thread', id: 'T', origin: 'http://x' }, ok: true }]]);
});

test('a finish that fails is reported, and the exit is still 0', async () => {
  const answer = await handle('finish', finishRequest({ kind: 'thread', id: 'T' }), adapters({ finishError: new SpawnError('t3 is not running') }));
  assert.equal(answer.code, 0);
  assert.equal(answer.stdout, '{}\n');
  assert.match(answer.stderr, /could not finish thread T: t3 is not running/);
});

test('finish with a handle no harness makes is exit 4, with nothing on stdout', async () => {
  const answer = await handle('finish', finishRequest({ kind: 'conformance', id: 'never-issued' }), adapters());
  assert.equal(answer.code, 4);
  assert.equal(answer.stdout, '');
});

// A run request from a claude author, with reviewers.
const runWith = (reviewers: object[]) => json({ ...JSON.parse(runRequest), reviewers });
const spawned = (adapter: { calls: [string, unknown][] }) => adapter.calls.filter(([call]) => call === 'spawn').map(([, request]) => request as SpawnRequest);

test('run takes the first reviewer from another family that the harness can run', async () => {
  const all = adapters({ detects: true });
  const answer = await handle('run', runWith([{ family: 'claude', model: null }, { family: 'gpt', model: 'gpt-6-luna' }]), all);
  assert.equal(answer.code, 0);
  assert.equal(spawned(all.t3)[0].model, 'gpt-6-luna');
  assert.equal(JSON.parse(answer.stdout).family, 'gpt');
});

test('run passes over a reviewer the harness cannot run', async () => {
  const all = adapters({ detects: true });
  await handle('run', runWith([{ family: 'gemini', model: 'gemini-3.8-flash' }, { family: 'gpt', model: null }]), all);
  assert.deepEqual([spawned(all.t3)[0].family, spawned(all.t3)[0].model], ['gpt', null]);
});

test('run takes the author\'s family when no other reviewer can run', async () => {
  const all = adapters({ detects: true });
  const answer = await handle('run', runWith([{ family: 'claude', model: null }]), all);
  assert.equal(answer.code, 0);
  assert.equal(JSON.parse(answer.stdout).family, 'claude');
});

test('run exits 3 when the harness can run no reviewer, naming each one and why', async () => {
  const all = adapters({ detects: true, available: { gpt: [], claude: [], gemini: [] } });
  const answer = await handle('run', runWith([{ family: 'gpt', model: 'gpt-6-luna' }, { family: 'gemini', model: null }]), all);
  assert.equal(answer.code, 3);
  assert.match(answer.stderr, /gpt\/gpt-6-luna: t3 cannot run gpt/);
  assert.match(answer.stderr, /gemini\/default: t3 cannot run gemini/);
  assert.deepEqual(spawned(all.t3), []);
});

test('run exits 3 on an empty reviewers list, starting nothing', async () => {
  const all = adapters({ detects: true });
  const answer = await handle('run', runWith([]), all);
  assert.equal(answer.code, 3);
  assert.match(answer.stderr, /no reviewers/);
  assert.deepEqual(spawned(all.t3), []);
});
