import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Adapter, SpawnRequest } from '../../contrib/resolver-kit/src/adapter.ts';
import { SessionFailed, SpawnError, TimeoutError } from '../../contrib/resolver-kit/src/errors.ts';
import type { Available } from '../../contrib/resolver-kit/src/families.ts';
import { buildRequest } from '../../contrib/resolver-kit/src/protocol.ts';
import type { Handle } from '../../contrib/resolver-kit/src/protocol.ts';
import { handle } from '../../contrib/resolver-kit/src/resolver.ts';

type Options = { detects?: boolean; whyDeclined?: string; available?: Available; text?: string; spawnError?: Error; waitError?: Error; finishError?: Error };

// An adapter for a harness called Pond, which makes handles of kind pad.
// It records its calls and answers as told.
function fakeAdapter(options: Options = {}) {
  const { detects = true, available = { gpt: ['gpt-6.1-sol'], claude: ['claude-fable-5-1'], gemini: [] }, text = 'FINDINGS' } = options;
  const calls: [string, unknown][] = [];
  const adapter: Adapter & { calls: typeof calls } = {
    name: 'pond',
    program: 'lets-delegate-pond',
    harness: 'Pond',
    handleKind: 'pad',
    calls,
    detect: () => detects,
    ...(options.whyDeclined === undefined ? {} : { whyDeclined: () => options.whyDeclined! }),
    availableFamilies: (query) => {
      calls.push(['availableFamilies', query]);
      return available;
    },
    async spawn(request: SpawnRequest) {
      calls.push(['spawn', request]);
      if (options.spawnError) throw options.spawnError;
      return { handle: { kind: 'pad', id: 'pad-1' }, inProcess: true };
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

const json = (request: object) => JSON.stringify(request);
const runRequest = json(buildRequest('run', { cwd: '/r', name: 'x', prompt: 'P', sourceFamily: 'claude', effort: 'high', timeoutMinutes: 3 }));
const startRequest = json(buildRequest('start', { cwd: '/r', name: 'fix-login', prompt: 'P' }));
const probeRequest = json(buildRequest('probe', { cwd: '/r' }));

test('outside its harness, the resolver declines each session verb with its own decline message', async () => {
  for (const [verb, request] of [['probe', probeRequest], ['run', runRequest], ['start', startRequest]]) {
    const adapter = fakeAdapter({ detects: false });
    const answer = await handle(verb, request, adapter);
    assert.deepEqual(answer, { code: 75, stdout: '', stderr: 'lets-delegate-pond: not inside Pond\n' }, verb);
    assert.deepEqual(adapter.calls, [], verb);
  }
});

test('outside its harness, the resolver declines with the adapter\'s own reason when it gives one', async () => {
  const answer = await handle('probe', probeRequest, fakeAdapter({ detects: false, whyDeclined: 'no pond on PATH' }));
  assert.deepEqual(answer, { code: 75, stdout: '', stderr: 'lets-delegate-pond: no pond on PATH\n' });
});

const finishRequest = (h: Handle, ok = true) => json(buildRequest('finish', { cwd: '/r', handle: h, ok }));

test('finish refuses a handle of a kind the adapter never makes, with exit 4', async () => {
  const adapter = fakeAdapter();
  const answer = await handle('finish', finishRequest({ kind: 'thread', id: 'T' }), adapter);
  assert.equal(answer.code, 4);
  assert.equal(answer.stdout, '');
  assert.deepEqual(adapter.calls, []);
});

test('finish goes to the adapter outside its harness', async () => {
  const adapter = fakeAdapter({ detects: false });
  assert.deepEqual(await handle('finish', finishRequest({ kind: 'pad', id: 'pad-3' }, false), adapter), { code: 0, stdout: '{}\n', stderr: '' });
  assert.deepEqual(adapter.calls, [['finish', { h: { kind: 'pad', id: 'pad-3' }, ok: false }]]);
});

test('a finish that fails is reported under the program\'s name, and the exit is still 0', async () => {
  const answer = await handle('finish', finishRequest({ kind: 'pad', id: 'P' }), fakeAdapter({ finishError: new SpawnError('pond is not running') }));
  assert.deepEqual(answer, { code: 0, stdout: '{}\n', stderr: 'lets-delegate-pond: could not finish pad P: pond is not running\n' });
});

test('probe inside the harness answers the adapter\'s name', async () => {
  assert.deepEqual(await handle('probe', probeRequest, fakeAdapter()), { code: 0, stdout: '{"resolver":"pond"}\n', stderr: '' });
});

test('run picks a family other than the source, spawns read-only, and waits the timeout', async () => {
  const adapter = fakeAdapter();
  const answer = await handle('run', runRequest, adapter);
  assert.equal(answer.code, 0);
  assert.deepEqual(JSON.parse(answer.stdout), { resolver: 'pond', text: 'FINDINGS', family: 'gpt', model: 'gpt-6.1-sol', handle: { kind: 'pad', id: 'pad-1' } });
  assert.deepEqual(adapter.calls, [
    ['availableFamilies', { effort: 'high' }],
    ['spawn', { kind: 'run', name: 'x', prompt: 'P', cwd: '/r', family: 'gpt', model: 'gpt-6.1-sol', effort: 'high', readOnly: true }],
    ['wait', { timeoutMs: 3 * 60000 }],
  ]);
});

test('start spawns an interactive claude session and returns its handle', async () => {
  const adapter = fakeAdapter();
  const answer = await handle('start', startRequest, adapter);
  assert.deepEqual(JSON.parse(answer.stdout), { resolver: 'pond', handle: { kind: 'pad', id: 'pad-1' } });
  assert.deepEqual(adapter.calls, [['spawn', { kind: 'start', name: 'fix-login', prompt: 'P', cwd: '/r', family: 'claude', model: null, effort: null, readOnly: false }]]);
});

test('each error class is its exit code, with nothing on stdout', async () => {
  const cases: [Options, number, string][] = [
    [{ available: { gpt: [], claude: [], gemini: [] } }, 3, 'lets-delegate-pond: no family is available for a source of claude\n'],
    [{ spawnError: new SpawnError('pond has no project') }, 4, 'lets-delegate-pond: pond has no project\n'],
    [{ waitError: new SessionFailed('the session stopped to ask') }, 5, 'lets-delegate-pond: the session stopped to ask (pad pad-1)\n'],
    [{ waitError: new TimeoutError('no result') }, 6, 'lets-delegate-pond: no result (pad pad-1)\n'],
    [{ text: ' \n' }, 5, 'lets-delegate-pond: empty final message (pad pad-1)\n'],
  ];
  for (const [options, code, stderr] of cases) {
    assert.deepEqual(await handle('run', runRequest, fakeAdapter(options)), { code, stdout: '', stderr });
  }
});

test('a malformed request or an unknown verb is exit 2', async () => {
  for (const [verb, request] of [['run', 'not json'], ['run', json({ protocol: 99, cwd: '/r' })], ['review', probeRequest]]) {
    const answer = await handle(verb, request, fakeAdapter());
    assert.equal(answer.code, 2, `${verb} ${request}`);
    assert.equal(answer.stdout, '');
  }
});

// A run request from a claude author, with reviewers.
const runWith = (reviewers: object[]) => json({ ...JSON.parse(runRequest), reviewers });
const spawned = (adapter: { calls: [string, unknown][] }) => adapter.calls.filter(([call]) => call === 'spawn').map(([, request]) => request as SpawnRequest);

test('run takes the first reviewer from another family that the harness can run', async () => {
  const adapter = fakeAdapter();
  const answer = await handle('run', runWith([{ family: 'claude', model: null }, { family: 'gpt', model: 'gpt-6-luna' }]), adapter);
  assert.equal(answer.code, 0);
  assert.equal(spawned(adapter)[0].model, 'gpt-6-luna');
  assert.equal(JSON.parse(answer.stdout).family, 'gpt');
});

test('run passes over a reviewer the harness cannot run', async () => {
  const adapter = fakeAdapter();
  await handle('run', runWith([{ family: 'gemini', model: 'gemini-3.8-flash' }, { family: 'gpt', model: null }]), adapter);
  assert.deepEqual([spawned(adapter)[0].family, spawned(adapter)[0].model], ['gpt', null]);
});

test('run takes the author\'s family when no other reviewer can run', async () => {
  const answer = await handle('run', runWith([{ family: 'claude', model: null }]), fakeAdapter());
  assert.equal(answer.code, 0);
  assert.equal(JSON.parse(answer.stdout).family, 'claude');
});

test('run exits 3 when the harness can run no reviewer, naming each one and why', async () => {
  const adapter = fakeAdapter({ available: { gpt: [], claude: [], gemini: [] } });
  const answer = await handle('run', runWith([{ family: 'gpt', model: 'gpt-6-luna' }, { family: 'gemini', model: null }]), adapter);
  assert.equal(answer.code, 3);
  assert.match(answer.stderr, /gpt\/gpt-6-luna: pond cannot run gpt/);
  assert.match(answer.stderr, /gemini\/default: pond cannot run gemini/);
  assert.deepEqual(spawned(adapter), []);
});

test('run exits 3 on an empty reviewers list, starting nothing', async () => {
  const adapter = fakeAdapter();
  const answer = await handle('run', runWith([]), adapter);
  assert.equal(answer.code, 3);
  assert.match(answer.stderr, /no reviewers/);
  assert.deepEqual(spawned(adapter), []);
});
