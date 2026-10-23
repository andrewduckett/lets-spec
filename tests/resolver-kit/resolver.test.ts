import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Adapter, SpawnRequest } from '../../contrib/resolver-kit/src/adapter.ts';
import { Refused, SessionFailed, SpawnError, TimeoutError } from '../../contrib/resolver-kit/src/errors.ts';
import { buildRequest } from '../../contrib/resolver-kit/src/protocol.ts';
import type { Handle } from '../../contrib/resolver-kit/src/protocol.ts';
import { handle } from '../../contrib/resolver-kit/src/resolver.ts';

type Options = { verbs?: readonly ('run' | 'start')[]; detects?: boolean; whyDeclined?: string; options?: string[]; text?: string; spawnError?: Error; waitError?: Error; finishError?: Error };

// An adapter for a harness called Pond, which makes handles of kind pad.
// It records its calls and answers as told.
function fakeAdapter(options: Options = {}) {
  const { detects = true, text = 'FINDINGS' } = options;
  const calls: [string, unknown][] = [];
  const adapter: Adapter & { calls: typeof calls } = {
    name: 'pond',
    program: 'lets-delegate-pond',
    harness: 'Pond',
    handleKind: 'pad',
    calls,
    ...(options.verbs === undefined ? {} : { verbs: options.verbs }),
    detect: () => detects,
    ...(options.whyDeclined === undefined ? {} : { whyDeclined: () => options.whyDeclined! }),
    async options(warn) {
      calls.push(['options', null]);
      warn('pond lists slowly');
      return options.options ?? ['gpt/gpt-6.1-sol', 'claude'];
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
    async finish(h: Handle, ok: boolean, { cwd }: { cwd: string }) {
      calls.push(['finish', { h, ok, cwd }]);
      if (options.finishError) throw options.finishError;
    },
  };
  return adapter;
}

const json = (request: object) => JSON.stringify(request);
const runFields = { cwd: '/r', name: 'x', prompt: 'P', sourceFamily: 'claude', effort: 'high', timeoutMinutes: 3, model: 'gpt/gpt-6.1-sol' } as const;
const runRequest = json(buildRequest('run', runFields));
const startRequest = json(buildRequest('start', { cwd: '/r', name: 'fix-login', prompt: 'P', model: 'gemini/gemini-3.8-flash' }));
const probeRequest = json(buildRequest('probe', { cwd: '/r' }));

const probeFor = (verb: 'run' | 'start') => json(buildRequest('probe', { cwd: '/r', verb }));
const DECLINED = (why: string) => ({ code: 75, stdout: '', stderr: `lets-delegate-pond: ${why}\n` });

test('an adapter that declares no verbs answers a probe for start', async () => {
  const answer = await handle('probe', probeFor('start'), fakeAdapter());
  assert.equal(answer.code, 0);
  assert.equal(JSON.parse(answer.stdout).resolver, 'pond');
});

test('an adapter that takes only run declines a probe for start, listing nothing', async () => {
  const adapter = fakeAdapter({ verbs: ['run'] });
  assert.deepEqual(await handle('probe', probeFor('start'), adapter), DECLINED('this resolver only runs headless'));
  assert.deepEqual(adapter.calls, []);
});

test('an adapter that takes only run declines start, starting nothing', async () => {
  const adapter = fakeAdapter({ verbs: ['run'] });
  assert.deepEqual(await handle('start', startRequest, adapter), DECLINED('this resolver only runs headless'));
  assert.deepEqual(adapter.calls, []);
});

test('an adapter that takes only run answers a probe for run', async () => {
  const answer = await handle('probe', probeFor('run'), fakeAdapter({ verbs: ['run'] }));
  assert.equal(answer.code, 0);
});

test('an adapter that takes only start declines every request for run', async () => {
  for (const [verb, request] of [['probe', probeFor('run')], ['run', runRequest]]) {
    const adapter = fakeAdapter({ verbs: ['start'] });
    const answer = await handle(verb, request, adapter);
    assert.deepEqual([answer.code, answer.stdout], [75, ''], verb);
    assert.deepEqual(adapter.calls, [], verb);
  }
});

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

test('finish goes to the adapter outside its harness, with the request\'s folder', async () => {
  const adapter = fakeAdapter({ detects: false });
  assert.deepEqual(await handle('finish', finishRequest({ kind: 'pad', id: 'pad-3' }, false), adapter), { code: 0, stdout: '{}\n', stderr: '' });
  assert.deepEqual(adapter.calls, [['finish', { h: { kind: 'pad', id: 'pad-3' }, ok: false, cwd: '/r' }]]);
});

test('a finish that fails is reported under the program\'s name, and the exit is still 0', async () => {
  const answer = await handle('finish', finishRequest({ kind: 'pad', id: 'P' }), fakeAdapter({ finishError: new SpawnError('pond is not running') }));
  assert.deepEqual(answer, { code: 0, stdout: '{}\n', stderr: 'lets-delegate-pond: could not finish pad P: pond is not running\n' });
});

test('probe inside the harness answers the adapter\'s name and options', async () => {
  assert.deepEqual(await handle('probe', probeRequest, fakeAdapter({ options: ['gpt/gpt-6-luna', 'claude'] })), {
    code: 0, stdout: '{"resolver":"pond","options":["gpt/gpt-6-luna","claude"]}\n', stderr: 'lets-delegate-pond: pond lists slowly\n',
  });
});

test('run spawns the request\'s model read-only, and waits the timeout', async () => {
  const adapter = fakeAdapter();
  const answer = await handle('run', runRequest, adapter);
  assert.equal(answer.code, 0);
  assert.deepEqual(JSON.parse(answer.stdout), { resolver: 'pond', text: 'FINDINGS', family: 'gpt', model: 'gpt-6.1-sol', handle: { kind: 'pad', id: 'pad-1' } });
  assert.deepEqual(adapter.calls, [
    ['spawn', { kind: 'run', name: 'x', prompt: 'P', cwd: '/r', family: 'gpt', model: 'gpt-6.1-sol', effort: 'high', readOnly: true }],
    ['wait', { timeoutMs: 3 * 60000 }],
  ]);
});

test('run passes a null model for a bare family', async () => {
  const adapter = fakeAdapter();
  const answer = await handle('run', json(buildRequest('run', { ...runFields, model: 'claude' })), adapter);
  assert.deepEqual([JSON.parse(answer.stdout).family, JSON.parse(answer.stdout).model], ['claude', null]);
  assert.deepEqual(adapter.calls[0], ['spawn', { kind: 'run', name: 'x', prompt: 'P', cwd: '/r', family: 'claude', model: null, effort: 'high', readOnly: true }]);
});

test('start spawns an interactive session on the request\'s model and returns its handle', async () => {
  const adapter = fakeAdapter();
  const answer = await handle('start', startRequest, adapter);
  assert.deepEqual(JSON.parse(answer.stdout), { resolver: 'pond', handle: { kind: 'pad', id: 'pad-1' } });
  assert.deepEqual(adapter.calls, [['spawn', { kind: 'start', name: 'fix-login', prompt: 'P', cwd: '/r', family: 'gemini', model: 'gemini-3.8-flash', effort: null, readOnly: false }]]);
});

test('each error class is its exit code, with nothing on stdout', async () => {
  const cases: [Options, number, string][] = [
    [{ spawnError: new Refused('pond has no project') }, 3, 'lets-delegate-pond: pond has no project\n'],
    [{ spawnError: new SpawnError('pond did not answer') }, 4, 'lets-delegate-pond: pond did not answer\n'],
    [{ waitError: new SessionFailed('the session stopped to ask') }, 5, 'lets-delegate-pond: the session stopped to ask (pad pad-1)\n'],
    [{ waitError: new TimeoutError('no result') }, 6, 'lets-delegate-pond: no result (pad pad-1)\n'],
    [{ text: ' \n' }, 5, 'lets-delegate-pond: empty final message (pad pad-1)\n'],
  ];
  for (const [options, code, stderr] of cases) {
    assert.deepEqual(await handle('run', runRequest, fakeAdapter(options)), { code, stdout: '', stderr });
  }
});

test('a session refused while it waits is finished as ok, then exits 3', async () => {
  const adapter = fakeAdapter({ waitError: new Refused('pond cannot run gpt-6.1-sol') });
  const answer = await handle('run', runRequest, adapter);
  assert.deepEqual(answer, { code: 3, stdout: '', stderr: 'lets-delegate-pond: pond cannot run gpt-6.1-sol (pad pad-1)\n' });
  assert.deepEqual(adapter.calls.at(-1), ['finish', { h: { kind: 'pad', id: 'pad-1' }, ok: true, cwd: '/r' }]);
});

test('a refused session that cannot be finished is a warning, and the exit stays 3', async () => {
  const adapter = fakeAdapter({ waitError: new Refused('no such model'), finishError: new SpawnError('pond is gone') });
  const answer = await handle('run', runRequest, adapter);
  assert.equal(answer.code, 3);
  assert.equal(answer.stderr, 'lets-delegate-pond: could not finish pad pad-1: pond is gone\nlets-delegate-pond: no such model (pad pad-1)\n');
});

test('a malformed request is exit 2', async () => {
  for (const [verb, request] of [['run', 'not json'], ['run', json({ protocol: 99, cwd: '/r' })], ['review', probeRequest],
    ['run', json({ ...JSON.parse(runRequest), model: undefined })]]) {
    const adapter = fakeAdapter();
    const answer = await handle(verb, request, adapter);
    assert.equal(answer.code, 2, `${verb} ${request}`);
    assert.equal(answer.stdout, '');
    assert.deepEqual(adapter.calls, []);
  }
});
