import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Adapter, RunInput, StartInput } from '../../../../lets/src/resolvers/kit/adapter.ts';
import { Refused, SessionFailed, SpawnError, TimeoutError } from '../../../../lets/src/resolvers/kit/errors.ts';
import { buildRequest } from '../../../../lets/src/resolvers/kit/protocol.ts';
import type { Handle } from '../../../../lets/src/resolvers/kit/protocol.ts';
import { handle } from './fixtures/handle.ts';

type Options = { starts?: boolean; detects?: boolean; whyDeclined?: string; options?: string[]; text?: string; runError?: Error; finishError?: Error };

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
    detect: () => detects,
    ...(options.whyDeclined === undefined ? {} : { whyDeclined: () => options.whyDeclined! }),
    async options(warn) {
      calls.push(['options', null]);
      warn('pond lists slowly');
      return options.options ?? ['gpt/gpt-6.1-sol', 'claude'];
    },
    async run(input: RunInput, query: { timeoutMs: number }) {
      calls.push(['run', { input, query }]);
      if (options.runError) throw options.runError;
      return { handle: { kind: 'pad', id: 'pad-1' }, text };
    },
    ...(options.starts === false ? {} : {
      async start(input: StartInput) {
        calls.push(['start', input]);
        return { kind: 'pad', id: 'pad-1' };
      },
    }),
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

test('an adapter with a start method answers a probe for start', async () => {
  const answer = await handle('probe', probeFor('start'), fakeAdapter());
  assert.equal(answer.code, 0);
  assert.equal(JSON.parse(answer.stdout).resolver, 'pond');
});

test('an adapter with no start method declines a probe for start, listing nothing', async () => {
  const adapter = fakeAdapter({ starts: false });
  assert.deepEqual(await handle('probe', probeFor('start'), adapter), DECLINED('this resolver only runs headless'));
  assert.deepEqual(adapter.calls, []);
});

test('an adapter with no start method declines start, starting nothing', async () => {
  const adapter = fakeAdapter({ starts: false });
  assert.deepEqual(await handle('start', startRequest, adapter), DECLINED('this resolver only runs headless'));
  assert.deepEqual(adapter.calls, []);
});

test('an adapter with no start method answers a probe for run', async () => {
  const answer = await handle('probe', probeFor('run'), fakeAdapter({ starts: false }));
  assert.equal(answer.code, 0);
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

test('run answers with the handle and text the adapter returns', async () => {
  const answer = await handle('run', runRequest, fakeAdapter());
  assert.equal(answer.code, 0);
  assert.deepEqual(JSON.parse(answer.stdout), { resolver: 'pond', text: 'FINDINGS', family: 'gpt', model: 'gpt-6.1-sol', handle: { kind: 'pad', id: 'pad-1' } });
});

test('run makes one call to the adapter, with the request\'s model, effort and timeout', async () => {
  const adapter = fakeAdapter();
  await handle('run', runRequest, adapter);
  assert.deepEqual(adapter.calls, [
    ['run', { input: { name: 'x', prompt: 'P', cwd: '/r', family: 'gpt', model: 'gpt-6.1-sol', effort: 'high' }, query: { timeoutMs: 3 * 60000 } }],
  ]);
});

test('run passes a null model for a bare family', async () => {
  const adapter = fakeAdapter();
  const answer = await handle('run', json(buildRequest('run', { ...runFields, model: 'claude' })), adapter);
  assert.deepEqual([JSON.parse(answer.stdout).family, JSON.parse(answer.stdout).model], ['claude', null]);
  assert.deepEqual(adapter.calls[0], ['run', { input: { name: 'x', prompt: 'P', cwd: '/r', family: 'claude', model: null, effort: 'high' }, query: { timeoutMs: 3 * 60000 } }]);
});

test('start starts an interactive session on the request\'s model and returns its handle', async () => {
  const adapter = fakeAdapter();
  const answer = await handle('start', startRequest, adapter);
  assert.deepEqual(JSON.parse(answer.stdout), { resolver: 'pond', handle: { kind: 'pad', id: 'pad-1' } });
  assert.deepEqual(adapter.calls, [['start', { name: 'fix-login', prompt: 'P', cwd: '/r', family: 'gemini', model: 'gemini-3.8-flash' }]]);
});

test('each error class from the adapter is its exit code, with its message as it is', async () => {
  const cases: [Error, number][] = [
    [new Refused('pond has no project'), 3],
    [new SpawnError('pond did not answer'), 4],
    [new SessionFailed('the session stopped to ask'), 5],
    [new TimeoutError('no result'), 6],
  ];
  for (const [runError, code] of cases) {
    assert.deepEqual(await handle('run', runRequest, fakeAdapter({ runError })), { code, stdout: '', stderr: `lets-delegate-pond: ${runError.message}\n` });
  }
});

test('an empty final message is exit 5, naming the session', async () => {
  assert.deepEqual(await handle('run', runRequest, fakeAdapter({ text: ' \n' })), { code: 5, stdout: '', stderr: 'lets-delegate-pond: empty final message (pad pad-1)\n' });
});

test('a refused run leaves the cleanup to the adapter', async () => {
  const adapter = fakeAdapter({ runError: new Refused('pond cannot run gpt-6.1-sol') });
  await handle('run', runRequest, adapter);
  assert.deepEqual(adapter.calls.map(([call]) => call), ['run']);
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
