import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ContractError, UsageError } from '../../../lets/src/delegate/errors.ts';
import {
  buildRequest, DECLINE, DEFAULT_TIMEOUT_MINUTES, exitFor, normalizeName, parseModel, parseRequest, parseResponse, PROTOCOL,
} from '../../../lets/src/delegate/protocol.ts';

const run = { cwd: '/r', name: 'x', prompt: 'P', sourceFamily: 'claude', effort: 'high', model: 'gpt/gpt-6-luna' } as const;
const runRequest = () => buildRequest('run', run);
const startRequest = () => buildRequest('start', { cwd: '/r', name: 'x', prompt: 'P', model: 'claude' });

// Asserts that fn throws an error of the class, whose message matches.
function throwsWith(fn: () => unknown, cls: new (...args: never[]) => Error, message: RegExp) {
  assert.throws(fn, (error) => error instanceof cls && message.test(error.message));
}

test('the protocol is version 2, and a decline is exit 75', () => {
  assert.equal(PROTOCOL, 2);
  assert.equal(DECLINE, 75);
});

test('buildRequest sets protocol, readOnly and interactive from the verb', () => {
  assert.deepEqual(runRequest(), {
    protocol: 2, cwd: '/r', name: 'x', prompt: 'P', sourceFamily: 'claude',
    readOnly: true, interactive: false, effort: 'high', timeoutMinutes: 45, model: 'gpt/gpt-6-luna',
  });
  assert.deepEqual(startRequest(), { protocol: 2, cwd: '/r', name: 'x', prompt: 'P', readOnly: false, interactive: true, model: 'claude' });
  assert.deepEqual(buildRequest('probe', { cwd: '/r' }), { protocol: 2, cwd: '/r' });
  assert.deepEqual(buildRequest('finish', { cwd: '/r', handle: { kind: 'process', id: '1' }, ok: true }),
    { protocol: 2, cwd: '/r', handle: { kind: 'process', id: '1' }, ok: true });
});

test('buildRequest takes the timeout given, else the default by effort', () => {
  assert.deepEqual(DEFAULT_TIMEOUT_MINUTES, { low: 15, medium: 15, high: 45 });
  assert.equal(buildRequest('run', { ...run, effort: 'low' }).timeoutMinutes, 15);
  assert.equal(buildRequest('run', { ...run, timeoutMinutes: 3 }).timeoutMinutes, 3);
});

test('parseModel splits a model string at its first slash', () => {
  assert.deepEqual(parseModel('gpt/gpt-6-luna'), { family: 'gpt', model: 'gpt-6-luna' });
  assert.deepEqual(parseModel('claude'), { family: 'claude', model: null });
  assert.deepEqual(parseModel('gemini/vendor/gemini-x'), { family: 'gemini', model: 'vendor/gemini-x' });
});

test('parseModel refuses a string that is not <family> or <family>/<id>', () => {
  for (const text of ['', 'llama/llama-4', 'gpt/', 'gpt/gpt 6', '/gpt-6', 'GPT', ' gpt']) {
    assert.equal(parseModel(text), null, JSON.stringify(text));
  }
});

test('parseRequest rejects a run or start without a valid model, naming it', () => {
  for (const [verb, request] of [['run', runRequest()], ['start', startRequest()]] as const) {
    for (const model of [undefined, '', 'llama/llama-4', 'gpt/', 7]) {
      const text = JSON.stringify({ ...request, model });
      throwsWith(() => parseRequest(verb, text), UsageError, /model/);
    }
  }
});

test('buildRequest sends no reviewers', () => {
  assert.equal('reviewers' in runRequest(), false);
});

test('parseRequest accepts what buildRequest builds', () => {
  for (const [verb, request] of [['run', runRequest()], ['start', startRequest()], ['probe', { protocol: 2, cwd: '/r' }],
    ['finish', { protocol: 2, cwd: '/r', handle: { kind: 'thread', id: 't', origin: 'http://x' }, ok: false }]] as const) {
    assert.deepEqual(parseRequest(verb, JSON.stringify(request)), request);
  }
});

test('parseRequest rejects text that is not one JSON object', () => {
  throwsWith(() => parseRequest('probe', 'not json'), UsageError, /not JSON/);
  throwsWith(() => parseRequest('probe', '[1]'), UsageError, /not a JSON object/);
  throwsWith(() => parseRequest('probe', 'null'), UsageError, /not a JSON object/);
});

test('parseRequest rejects an unknown verb, naming it', () => {
  throwsWith(() => parseRequest('critique', '{}'), UsageError, /unknown verb: critique/);
});

test('parseRequest rejects an unknown protocol, naming it', () => {
  throwsWith(() => parseRequest('probe', '{"protocol":99,"cwd":"/r"}'), UsageError, /protocol 99/);
  throwsWith(() => parseRequest('probe', '{"cwd":"/r"}'), UsageError, /protocol/);
});

test('parseRequest rejects a missing or bad field, naming it', () => {
  const without = (field: string) => {
    const request: Record<string, unknown> = runRequest();
    delete request[field];
    return JSON.stringify(request);
  };
  for (const field of ['cwd', 'name', 'prompt', 'sourceFamily', 'readOnly', 'interactive', 'effort', 'timeoutMinutes', 'model']) {
    throwsWith(() => parseRequest('run', without(field)), UsageError, new RegExp(field));
  }
  const bad = (fields: object) => JSON.stringify({ ...runRequest(), ...fields });
  throwsWith(() => parseRequest('run', bad({ sourceFamily: 'openai' })), UsageError, /sourceFamily.*openai/);
  throwsWith(() => parseRequest('run', bad({ effort: 'max' })), UsageError, /effort.*max/);
  throwsWith(() => parseRequest('run', bad({ cwd: 'relative' })), UsageError, /cwd/);
  throwsWith(() => parseRequest('run', bad({ name: 'Not Normal' })), UsageError, /name/);
  throwsWith(() => parseRequest('run', bad({ readOnly: false })), UsageError, /readOnly/);
  throwsWith(() => parseRequest('start', JSON.stringify({ ...startRequest(), interactive: false })), UsageError, /interactive/);
  throwsWith(() => parseRequest('run', bad({ timeoutMinutes: 1.5 })), UsageError, /timeoutMinutes/);
  throwsWith(() => parseRequest('finish', '{"protocol":2,"cwd":"/r","handle":{"kind":"x"},"ok":true}'), UsageError, /handle/);
  throwsWith(() => parseRequest('finish', '{"protocol":2,"cwd":"/r","handle":{"kind":"x","id":"1"}}'), UsageError, /ok/);
});

test('parseResponse requires resolver, text and a known family for run', () => {
  assert.deepEqual(parseResponse('run', '{"resolver":"default","text":"T","family":"gpt","handle":{"kind":"process","id":"9"}}'),
    { resolver: 'default', text: 'T', family: 'gpt', handle: { kind: 'process', id: '9' } });
  assert.deepEqual(parseResponse('run', '{"resolver":"t3","text":"T","family":"claude","model":"m","handle":null}\n'),
    { resolver: 't3', text: 'T', family: 'claude', model: 'm', handle: null });
  throwsWith(() => parseResponse('run', '{"text":"T","family":"gpt"}'), ContractError, /resolver/);
  throwsWith(() => parseResponse('run', '{"resolver":"r","family":"gpt"}'), ContractError, /text/);
  throwsWith(() => parseResponse('run', '{"resolver":"r","text":"T"}'), ContractError, /family/);
  throwsWith(() => parseResponse('run', '{"resolver":"r","text":"T","family":"openai"}'), ContractError, /family.*openai/);
  throwsWith(() => parseResponse('run', '{"resolver":"r","text":"T","family":"gpt","handle":{"id":"1"}}'), ContractError, /handle/);
});

test('parseResponse requires resolver, and a handle or instructions, for start', () => {
  assert.deepEqual(parseResponse('start', '{"resolver":"t3","handle":{"kind":"thread","id":"t"}}'),
    { resolver: 't3', handle: { kind: 'thread', id: 't' } });
  assert.deepEqual(parseResponse('start', '{"resolver":"default","handle":null,"instructions":"Run it"}'),
    { resolver: 'default', handle: null, instructions: 'Run it' });
  throwsWith(() => parseResponse('start', '{"resolver":"r","handle":null}'), ContractError, /instructions/);
  throwsWith(() => parseResponse('start', '{"resolver":"r"}'), ContractError, /instructions/);
});

test('parseResponse requires resolver for probe, and an object or nothing for finish', () => {
  assert.deepEqual(parseResponse('probe', '{"resolver":"herdr"}'), { resolver: 'herdr' });
  throwsWith(() => parseResponse('probe', '{}'), ContractError, /resolver/);
  assert.deepEqual(parseResponse('finish', '{}'), {});
  assert.deepEqual(parseResponse('finish', ''), {});
  throwsWith(() => parseResponse('finish', '[]'), ContractError, /not a JSON object/);
});

test('parseResponse rejects text that is not one JSON object', () => {
  throwsWith(() => parseResponse('probe', ''), ContractError, /not JSON/);
  throwsWith(() => parseResponse('probe', '{"resolver":"a"}\n{"resolver":"b"}'), ContractError, /not JSON/);
});

test('exitFor maps a resolver exit to the exit lets gives', () => {
  const table: [number | null, number][] = [[0, 0], [2, 4], [3, 3], [4, 4], [5, 5], [6, 6], [1, 4], [7, 4], [75, 4], [null, 4]];
  for (const [resolver, lets] of table) assert.equal(exitFor(resolver), lets, `resolver exit ${resolver}`);
});

test('names are normalized, not refused', () => {
  assert.equal(normalizeName('Add CSV Parser Tests'), 'add-csv-parser-tests');
  assert.equal(normalizeName('9lives'), 'x9lives');
  assert.equal(normalizeName('a'.repeat(40)).length, 32);
  assert.equal(normalizeName('weird__name--'), 'weird__name');
  assert.equal(normalizeName('My Change'), 'my-change');
});
