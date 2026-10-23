import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { Refused, SessionFailed, SpawnError } from '../../contrib/resolver-kit/src/errors.ts';
import type { Db } from '../../contrib/resolver-kit/src/io.ts';
import {
  baseDir, buildLaunch, createAdapter, dispatch, findProject, isAncestor, launch, readFinalMessage,
  optionsFromT3Manifest, readRun, readRuntime, readToken, t3ModelSelection, TOKEN_FILE,
} from '../../contrib/t3-resolver/src/t3.ts';
import type { SpawnRequest } from '../../contrib/resolver-kit/src/adapter.ts';
import { fakeIo } from '../resolver-kit/fixtures/fake-io.ts';

const SCHEMA = readFileSync(new URL('./fixtures/t3-schema.sql', import.meta.url), 'utf8');
const RUNTIME = '/home/u/.t3/userdata/server-runtime.json';
const TOKEN = `/home/u/.config/${TOKEN_FILE}`;
const ORIGIN = 'http://127.0.0.1:3773';
const RUNNING = { [RUNTIME]: JSON.stringify({ pid: 7, origin: ORIGIN }), [TOKEN]: 'tok' };

function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  return db;
}
// The adapter closes each handle it opens; keep the in-memory one alive.
const shared = (db: DatabaseSync): Db => ({ prepare: (sql: string) => db.prepare(sql), close() {} }) as Db;

function addProject(db: DatabaseSync, { id = 'p1', title = 'lets-spec', root = '/r', selection = null as string | null } = {}) {
  db.prepare(`insert into projection_projects (project_id, title, workspace_root, scripts_json, created_at, updated_at, default_model_selection_json)
    values (?, ?, ?, '[]', 'now', 'now', ?)`).run(id, title, root, selection);
}
function addThread(db: DatabaseSync, threadId: string) {
  db.prepare(`insert into orchestration_v2_projection_threads (thread_id, project_id, title, default_provider, runtime_mode, interaction_mode, created_at, updated_at, payload_json)
    values (?, 'p1', 't', 'claudeAgent', 'full-access', 'plan', 'now', 'now', '{}')`).run(threadId);
}
// Runs are numbered; the newest has the highest ordinal.
function addRun(db: DatabaseSync, threadId: string, runId: string, ordinal: number, status: string) {
  db.prepare(`insert into orchestration_v2_projection_runs (run_id, thread_id, ordinal, provider, status, requested_at, payload_json)
    values (?, ?, ?, 'claudeAgent', ?, 'now', '{}')`).run(runId, threadId, ordinal, status);
}
function addMessage(db: DatabaseSync, messageId: string, runId: string, text: string, streaming: number, { role = 'assistant', createdAt = 'now' } = {}) {
  db.prepare(`insert into orchestration_v2_projection_messages (message_id, thread_id, run_id, role, streaming, created_at, updated_at, payload_json)
    values (?, 'T', ?, ?, ?, ?, ?, ?)`).run(messageId, runId, role, streaming, createdAt, createdAt, JSON.stringify({ text }));
}
function addPendingRequest(db: DatabaseSync, threadId: string) {
  db.prepare(`insert into orchestration_v2_projection_runtime_requests (runtime_request_id, thread_id, node_id, kind, status, created_at, payload_json)
    values ('rq1', ?, 'n1', 'user_input', 'pending', 'now', '{}')`).run(threadId);
}
function addFailure(db: DatabaseSync, runId: string, message: string) {
  db.prepare(`insert into orchestration_v2_projection_turn_items (turn_item_id, thread_id, run_id, ordinal, type, status, updated_at, payload_json)
    values ('e1', 'T', ?, 1, 'error', 'failed', 'now', ?)`).run(runId, JSON.stringify({ failure: { class: 'provider', message } }));
}

type Log = [string, unknown][];

// A WebSocket stand-in: opens at once and answers each request with `reply`.
function fakeWebSocket(reply: unknown, log: Log): typeof WebSocket {
  return class {
    listeners: Record<string, ((event: unknown) => void)[]> = {};
    constructor(url: URL) {
      log.push(['open', String(url)]);
      queueMicrotask(() => this.emit('open', {}));
    }
    addEventListener(type: string, listener: (event: unknown) => void) {
      (this.listeners[type] ??= []).push(listener);
    }
    emit(type: string, event: unknown) {
      for (const listener of this.listeners[type] ?? []) listener(event);
    }
    send(data: string) {
      log.push(['send', JSON.parse(data)]);
      queueMicrotask(() => this.emit('message', { data: JSON.stringify(reply) }));
    }
    close() {}
  } as unknown as typeof WebSocket;
}
const SUCCESS = { _tag: 'Exit', requestId: '1', exit: { _tag: 'Success', value: { sequence: 9 } } };
// launchThread answers with the thread and its projection; the resolver reads only the thread id.
const LAUNCHED = { _tag: 'Exit', requestId: '1', exit: { _tag: 'Success', value: { threadId: 'T', projection: {}, resumed: false } } };

// fetch answers from a list of statuses, recording each request.
function fakeFetch(statuses: number[], log: [string, RequestInit | undefined][]): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    log.push([url, init]);
    const status = statuses.shift()!;
    return { status, ok: status === 200, json: async () => ({ ticket: 'TICKET' }), text: async () => 'denied' };
  }) as unknown as typeof fetch;
}

test('baseDir honours T3CODE_HOME', () => {
  assert.equal(baseDir({}, '/home/u'), '/home/u/.t3');
  assert.equal(baseDir({ T3CODE_HOME: '/t' }, '/home/u'), '/t');
});

test('detect needs a runtime file, a live server, and the server among this process\'s ancestors', () => {
  const chain: Record<number, number> = { 100: 50, 50: 7, 7: 1 };
  const io = (over = {}) => fakeIo({
    files: { [RUNTIME]: JSON.stringify({ pid: 7, origin: ORIGIN }) },
    pid: 100,
    parentPid: (pid) => chain[pid] ?? null,
    processAlive: (pid) => pid === 7,
    env: {},
    ...over,
  });
  assert.deepEqual(readRuntime(io()), { origin: ORIGIN, pid: 7 });
  assert.equal(isAncestor(io(), 7), true);
  assert.equal(createAdapter(io()).detect(), true);
  assert.equal(createAdapter(io({ files: {} })).detect(), false);
  assert.equal(createAdapter(io({ processAlive: () => false })).detect(), false);
  // A stale runtime file: pid 7 is alive but is not an ancestor.
  const stale: Record<number, number> = { 100: 50, 50: 1 };
  assert.equal(createAdapter(io({ parentPid: (pid: number) => stale[pid] ?? null })).detect(), false);
});

test('options list each provider in the manifest\'s order, its default first', () => {
  const manifest = { manifest: {
    currentModels: { codex: ['gpt-6-luna'], claudeAgent: ['claude-opus-5-5', 'claude-fable-5-1'], antigravity: ['gemini-3.8-flash-high', 'gemini-3.8-flash-low'] },
    providers: { claudeAgent: { defaults: { chat: 'claude-fable-5-1' } } },
  } };
  assert.deepEqual(optionsFromT3Manifest(manifest), ['gpt/gpt-6-luna', 'claude/claude-fable-5-1', 'claude/claude-opus-5-5', 'gemini/gemini-3.8-flash']);
});

test('options follow the manifest\'s key order, not the family order', () => {
  const manifest = { manifest: { currentModels: { antigravity: ['gemini-3.8-flash-high'], codex: ['gpt-6-luna'] } } };
  assert.deepEqual(optionsFromT3Manifest(manifest), ['gemini/gemini-3.8-flash', 'gpt/gpt-6-luna']);
});

test('options list a gemini default once, without its effort', () => {
  const manifest = { manifest: {
    currentModels: { antigravity: ['gemini-3.8-pro-low', 'gemini-3.8-flash-high', 'gemini-3.8-flash-medium'] },
    providers: { antigravity: { defaults: { chat: 'gemini-3.8-flash-medium' } } },
  } };
  assert.deepEqual(optionsFromT3Manifest(manifest), ['gemini/gemini-3.8-flash', 'gemini/gemini-3.8-pro']);
});

test('options leave out a provider instance lets does not know', () => {
  const manifest = { manifest: { currentModels: { opencode: ['llama-4'], codex: ['gpt-6-luna'] }, providers: { opencode: { defaults: { chat: 'llama-4' } } } } };
  assert.deepEqual(optionsFromT3Manifest(manifest), ['gpt/gpt-6-luna']);
});

test('the adapter\'s options read the model manifest, and a missing one lists none', async () => {
  const manifest = { manifest: { currentModels: { codex: ['gpt-6.1-sol'] } } };
  const io = fakeIo({ files: { '/home/u/.t3/userdata/model-manifest.json': JSON.stringify(manifest) }, env: {} });
  assert.deepEqual(await createAdapter(io).options(() => {}), ['gpt/gpt-6.1-sol']);
  assert.deepEqual(await createAdapter(fakeIo({ env: {} })).options(() => {}), []);
});

test('t3 model selection carries the effort in each provider\'s own option', () => {
  assert.deepEqual(t3ModelSelection({ family: 'gpt', model: 'gpt-6.1-sol', effort: 'high' }),
    { instanceId: 'codex', model: 'gpt-6.1-sol', options: [{ id: 'reasoningEffort', value: 'high' }] });
  assert.deepEqual(t3ModelSelection({ family: 'claude', model: 'claude-fable-5-1', effort: 'low' }),
    { instanceId: 'claudeAgent', model: 'claude-fable-5-1', options: [{ id: 'effort', value: 'low' }] });
  assert.deepEqual(t3ModelSelection({ family: 'gemini', model: 'gemini-3.8-flash-high', effort: 'high' }),
    { instanceId: 'antigravity', model: 'gemini-3.8-flash-high', options: [] });
});

test('t3 model selection adds the effort to a gemini model without one', () => {
  assert.equal(t3ModelSelection({ family: 'gemini', model: 'gemini-3.8-flash', effort: 'high' }).model, 'gemini-3.8-flash-high');
});

test('findProject matches the workspace root, or names the known projects', () => {
  const db = database();
  addProject(db, { id: 'p1', title: 'lets-spec', root: '/r' });
  addProject(db, { id: 'p2', title: 'other', root: '/o' });
  assert.equal(findProject(shared(db), '/r').project_id, 'p1');
  assert.throws(() => findProject(shared(db), '/x'), (error) =>
    error instanceof Refused && /t3 project add \/x/.test(error.message) && /lets-spec, other/.test(error.message));
});

test('buildLaunch has the shape the UI sends for a new thread, on the current branch', () => {
  const modelSelection = { instanceId: 'codex', model: 'gpt-6.1-sol', options: [{ id: 'reasoningEffort', value: 'high' }] };
  const input = buildLaunch({
    threadId: 'T', projectId: 'P', title: 'x-plan-review', text: 'PROMPT', modelSelection, interactionMode: 'plan', branch: 'main', messageId: 'M', commandId: 'C',
  });
  assert.deepEqual(input, {
    commandId: 'C',
    creationSource: 'web',
    threadId: 'T',
    projectId: 'P',
    title: 'x-plan-review',
    generateTitle: true,
    modelSelection,
    runtimeMode: 'full-access',
    interactionMode: 'plan',
    workspaceStrategy: { type: 'root', branch: 'main' },
    initialMessage: { messageId: 'M', text: 'PROMPT', attachments: [] },
  });
  // A detached HEAD has no branch, and the root strategy then has none either.
  const plain = buildLaunch({ threadId: 'T', projectId: 'P', title: 't', text: 'x', modelSelection, interactionMode: 'default', branch: null });
  assert.equal(plain.interactionMode, 'default');
  assert.deepEqual(plain.workspaceStrategy, { type: 'root' });
  assert.match(plain.commandId, /^[0-9a-f-]{36}$/);
  assert.match(plain.initialMessage.messageId, /^[0-9a-f-]{36}$/);
});

test('readRun returns the newest run, or null when there is none', () => {
  const db = database();
  addThread(db, 'T');
  assert.equal(readRun(shared(db), 'T'), null);
  addRun(db, 'T', 'run-1', 1, 'completed');
  addRun(db, 'T', 'run-2', 2, 'running');
  assert.deepEqual(readRun(shared(db), 'T'), { id: 'run-2', status: 'running', pendingRequests: 0, failure: null });
  addPendingRequest(db, 'T');
  assert.equal(readRun(shared(db), 'T')!.pendingRequests, 1);
});

test('readRun reads a failed run\'s failure from its error item', () => {
  const db = database();
  addThread(db, 'T');
  addRun(db, 'T', 'run-1', 1, 'failed');
  assert.equal(readRun(shared(db), 'T')!.failure, null);
  addFailure(db, 'run-1', 'quota exceeded');
  assert.equal(readRun(shared(db), 'T')!.failure, 'quota exceeded');
});

test('readFinalMessage returns the run\'s newest assistant message', () => {
  const db = database();
  assert.equal(readFinalMessage(shared(db), 'run-1'), null);
  addMessage(db, 'u1', 'run-1', 'the prompt', 0, { role: 'user', createdAt: '2026-10-17T00:00:00.000Z' });
  assert.equal(readFinalMessage(shared(db), 'run-1'), null);
  addMessage(db, 'a1', 'run-1', 'first', 0, { createdAt: '2026-10-17T00:00:01.000Z' });
  addMessage(db, 'a2', 'run-1', 'last', 1, { createdAt: '2026-10-17T00:00:02.000Z' });
  assert.deepEqual(readFinalMessage(shared(db), 'run-1'), { text: 'last', streaming: true });
});

// An adapter whose database is `db` and whose sleep runs the next step.
function waitingAdapter(db: DatabaseSync, steps: (() => void)[]) {
  return createAdapter(fakeIo({ env: {}, openDb: () => shared(db), sleep: async () => steps.shift()?.() }));
}
const HANDLE = { kind: 'thread', id: 'T', origin: ORIGIN };
const SESSION = { handle: HANDLE };

test('waitForResult waits for the run to complete and the message to stop streaming', async () => {
  const db = database();
  addThread(db, 'T');
  addRun(db, 'T', 'run-1', 1, 'running');
  const steps = [
    () => { addMessage(db, 'a1', 'run-1', 'partial', 1); },
    () => db.exec("update orchestration_v2_projection_runs set status = 'completed'"),
    () => db.exec(`update orchestration_v2_projection_messages set payload_json = '{"text":"FINDINGS"}', streaming = 0`),
  ];
  assert.deepEqual(await waitingAdapter(db, steps).waitForResult(SESSION, { timeoutMs: 60000 }), { text: 'FINDINGS' });
  assert.equal(steps.length, 0);
});
test('waitForResult refuses a run that failed before any assistant message, with its failure', async () => {
  const db = database();
  addThread(db, 'T');
  addRun(db, 'T', 'run-1', 1, 'failed');
  addFailure(db, 'run-1', 'model not available');
  await assert.rejects(waitingAdapter(db, []).waitForResult(SESSION, { timeoutMs: 60000 }),
    (error) => error instanceof Refused && error.message === 'model not available');
});
test('waitForResult fails a run that failed after an assistant message, with its failure', async () => {
  const db = database();
  addThread(db, 'T');
  addRun(db, 'T', 'run-1', 1, 'failed');
  addMessage(db, 'a1', 'run-1', 'half a review', 0);
  addFailure(db, 'run-1', 'quota exceeded');
  await assert.rejects(waitingAdapter(db, []).waitForResult(SESSION, { timeoutMs: 60000 }),
    (error) => error instanceof SessionFailed && !(error instanceof Refused) && error.message === 'quota exceeded');
});
test('waitForResult fails when the session stops to ask', async () => {
  for (const [status, pending] of [['waiting', false], ['running', true]] as const) {
    const db = database();
    addThread(db, 'T');
    addRun(db, 'T', 'run-1', 1, status);
    if (pending) addPendingRequest(db, 'T');
    await assert.rejects(waitingAdapter(db, []).waitForResult(SESSION, { timeoutMs: 60000 }), /stopped to ask/);
  }
});
test('waitForResult fails on an interrupted, cancelled or rolled back run', async () => {
  for (const [status, reason] of [['interrupted', 'run interrupted'], ['cancelled', 'run cancelled'], ['rolled_back', 'run rolled back']]) {
    const db = database();
    addThread(db, 'T');
    addRun(db, 'T', 'run-1', 1, status);
    await assert.rejects(waitingAdapter(db, []).waitForResult(SESSION, { timeoutMs: 60000 }),
      (error) => error instanceof SessionFailed && error.message === reason);
  }
});
test('waitForResult returns an empty final message as it is; the resolver rejects it', async () => {
  const db = database();
  addThread(db, 'T');
  addRun(db, 'T', 'run-1', 1, 'completed');
  assert.deepEqual(await waitingAdapter(db, []).waitForResult(SESSION, { timeoutMs: 60000 }), { text: '' });
  addMessage(db, 'a1', 'run-1', '', 0);
  assert.deepEqual(await waitingAdapter(db, []).waitForResult(SESSION, { timeoutMs: 60000 }), { text: '' });
});

const ISSUE = ['auth', 'session', 'issue', '--base-dir', '/home/u/.t3', '--ttl', '30d', '--label', 'lets-delegate', '--token-only'];

test('a missing token is issued with the t3 CLI and stored private', async () => {
  const io = fakeIo({ env: {}, results: [{ stdout: 'fresh-token\n', stderr: '', code: 0 }] });
  assert.equal(await readToken(io), 'fresh-token');
  assert.deepEqual(io.calls.map(([cmd, args]) => [cmd, args]), [['t3', ISSUE]]);
  assert.equal(io.files.get(TOKEN), 'fresh-token');
  assert.equal(io.modes.get(TOKEN), 0o600);
  assert.equal(io.modes.get('/home/u/.config/lets-delegate'), 0o700);
});
test('a stored token is used as it is', async () => {
  const io = fakeIo({ env: {}, files: { [TOKEN]: 'stored\n' } });
  assert.equal(await readToken(io), 'stored');
  assert.equal(io.calls.length, 0);
});

const XDG_TOKEN = `/cfg/${TOKEN_FILE}`;

test('with XDG_CONFIG_HOME set, the token stored under it is used', async () => {
  const io = fakeIo({ env: { XDG_CONFIG_HOME: '/cfg' }, files: { [XDG_TOKEN]: 'stored\n' } });
  assert.equal(await readToken(io), 'stored');
  assert.equal(io.calls.length, 0);
});

test('with XDG_CONFIG_HOME set, a fresh token is stored under it', async () => {
  const io = fakeIo({ env: { XDG_CONFIG_HOME: '/cfg' }, results: [{ stdout: 'fresh-token\n', stderr: '', code: 0 }] });
  await readToken(io);
  assert.equal(io.files.get(XDG_TOKEN), 'fresh-token');
});

test('an empty XDG_CONFIG_HOME means the token under ~/.config', async () => {
  const io = fakeIo({ env: { XDG_CONFIG_HOME: '' }, files: { [TOKEN]: 'stored\n' } });
  assert.equal(await readToken(io), 'stored');
  assert.equal(io.calls.length, 0);
});

test('dispatch sends one request frame and returns the success value', async () => {
  const log: Log = [];
  const fetches: [string, RequestInit | undefined][] = [];
  const io = fakeIo({ env: {}, fetch: fakeFetch([200], fetches), WebSocket: fakeWebSocket(SUCCESS, log) });
  const command = { type: 'thread.archive', commandId: 'C', threadId: 'T' };
  assert.deepEqual(await dispatch(io, { origin: ORIGIN, token: 'tok' }, command), { sequence: 9 });
  assert.deepEqual(fetches, [[`${ORIGIN}/api/auth/websocket-ticket`, { method: 'POST', headers: { authorization: 'Bearer tok' } }]]);
  assert.deepEqual(log, [
    ['open', 'ws://127.0.0.1:3773/ws?wsTicket=TICKET&orchestrationProtocol=2'],
    ['send', { _tag: 'Request', id: '1', tag: 'orchestration.dispatchCommand', payload: command, headers: [] }],
  ]);
});
test('launch sends one launchThread request and returns the thread t3 names', async () => {
  const log: Log = [];
  const io = fakeIo({ env: {}, fetch: fakeFetch([200], []), WebSocket: fakeWebSocket(LAUNCHED, log) });
  const input = buildLaunch({ threadId: 'T', projectId: 'P', title: 't', text: 'x', modelSelection: { instanceId: 'codex', model: 'm', options: [] }, interactionMode: 'plan', branch: null });
  assert.deepEqual(await launch(io, { origin: ORIGIN, token: 'tok' }, input), { threadId: 'T' });
  assert.deepEqual(log[1], ['send', { _tag: 'Request', id: '1', tag: 'orchestration.launchThread', payload: input, headers: [] }]);
});
test('dispatch re-issues a rejected token once', async () => {
  const fetches: [string, RequestInit | undefined][] = [];
  const io = fakeIo({ env: {}, results: [{ stdout: 'new\n', stderr: '', code: 0 }], fetch: fakeFetch([401, 200], fetches), WebSocket: fakeWebSocket(SUCCESS, []) });
  assert.deepEqual(await dispatch(io, { origin: ORIGIN, token: 'old' }, { type: 'x' }), { sequence: 9 });
  assert.equal(io.calls.length, 1);
  assert.equal((fetches[1][1]!.headers as Record<string, string>).authorization, 'Bearer new');
});
test('dispatch fails when the token is rejected twice', async () => {
  const io = fakeIo({ env: {}, results: [{ stdout: 'new\n', stderr: '', code: 0 }], fetch: fakeFetch([401, 403], []), WebSocket: fakeWebSocket(SUCCESS, []) });
  await assert.rejects(dispatch(io, { origin: ORIGIN, token: 'old' }, { type: 'x' }), (error) =>
    error instanceof Refused && error.message === 't3 rejected the token twice');
});
test('dispatch is refused on a Defect', async () => {
  const io = fakeIo({ env: {}, fetch: fakeFetch([200], []), WebSocket: fakeWebSocket({ _tag: 'Defect', defect: 'boom' }, []) });
  await assert.rejects(dispatch(io, { origin: ORIGIN, token: 'tok' }, { type: 'x' }), Refused);
});
test('dispatch is refused when t3 answers with a failure', async () => {
  const failure = { _tag: 'Exit', requestId: '1', exit: { _tag: 'Failure', cause: 'no such model' } };
  const io = fakeIo({ env: {}, fetch: fakeFetch([200], []), WebSocket: fakeWebSocket(failure, []) });
  await assert.rejects(dispatch(io, { origin: ORIGIN, token: 'tok' }, { type: 'x' }), (error) => error instanceof Refused && /no such model/.test(error.message));
});
test('dispatch is refused when the ticket request fails', async () => {
  const io = fakeIo({ env: {}, fetch: fakeFetch([500], []), WebSocket: fakeWebSocket(SUCCESS, []) });
  await assert.rejects(dispatch(io, { origin: ORIGIN, token: 'tok' }, { type: 'x' }), (error) => error instanceof Refused && /HTTP 500/.test(error.message));
});
test('dispatch is refused when t3 is unreachable', async () => {
  const fetch = (async () => {
    throw Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
  }) as unknown as typeof globalThis.fetch;
  await assert.rejects(dispatch(fakeIo({ env: {}, fetch }), { origin: ORIGIN, token: 'tok' }, { type: 'x' }),
    (error) => error instanceof Refused && /unreachable \(ECONNREFUSED\)/.test(error.message));
});

// A WebSocket that opens and never answers.
function silentWebSocket(): typeof WebSocket {
  return class {
    listeners: Record<string, ((event: unknown) => void)[]> = {};
    constructor() {
      queueMicrotask(() => this.emit('open', {}));
    }
    addEventListener(type: string, listener: (event: unknown) => void) {
      (this.listeners[type] ??= []).push(listener);
    }
    emit(type: string, event: unknown) {
      for (const listener of this.listeners[type] ?? []) listener(event);
    }
    send() {}
    close() {}
  } as unknown as typeof WebSocket;
}

test('no reply from t3 is an unknown outcome, not a refusal', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const io = fakeIo({ env: {}, fetch: fakeFetch([200], []), WebSocket: silentWebSocket() });
  const pending = dispatch(io, { origin: ORIGIN, token: 'tok' }, { type: 'x', threadId: 'T' });
  // Let the ticket request and the socket's open run before time moves on.
  for (let i = 0; i < 10; i++) await Promise.resolve();
  t.mock.timers.tick(120_000);
  await assert.rejects(pending, (error) => error instanceof SpawnError && !(error instanceof Refused) && /no reply from t3/.test(error.message));
});

// A WebSocket that t3 refuses: it fails and closes without opening.
function refusedWebSocket(): typeof WebSocket {
  return class {
    listeners: Record<string, ((event: unknown) => void)[]> = {};
    constructor() {
      queueMicrotask(() => {
        this.emit('error', { type: 'error', message: '' });
        this.emit('close', { code: 1006, reason: '' });
      });
    }
    addEventListener(type: string, listener: (event: unknown) => void) {
      (this.listeners[type] ??= []).push(listener);
    }
    emit(type: string, event: unknown) {
      for (const listener of this.listeners[type] ?? []) listener(event);
    }
    send() {}
    close() {}
  } as unknown as typeof WebSocket;
}

test('a refused WebSocket is reported with t3\'s own reason', async () => {
  const fetches: string[] = [];
  const fetch = (async (url: string) => {
    fetches.push(url);
    if (url.endsWith('/ws')) {
      return { status: 426, ok: false, json: async () => ({ code: 'orchestration_protocol_incompatible', message: 'Update this client to one that supports orchestration protocol 2.' }) };
    }
    return { status: 200, ok: true, json: async () => ({ ticket: 'TICKET' }) };
  }) as unknown as typeof globalThis.fetch;
  const io = fakeIo({ env: {}, fetch, WebSocket: refusedWebSocket() });
  await assert.rejects(dispatch(io, { origin: ORIGIN, token: 'tok' }, { type: 'x' }), (error) =>
    error instanceof Refused
    && error.message.startsWith('t3 refused the WebSocket connection: Update this client to one that supports orchestration protocol 2.')
    && error.message.includes('After a t3 update'));
  assert.deepEqual(fetches, [`${ORIGIN}/api/auth/websocket-ticket`, `${ORIGIN}/ws`]);
});

test('a refused WebSocket with no reason to read still says it was refused', async () => {
  const fetch = (async (url: string) => {
    if (url.endsWith('/ws')) throw new Error('connection reset');
    return { status: 200, ok: true, json: async () => ({ ticket: 'TICKET' }) };
  }) as unknown as typeof globalThis.fetch;
  const io = fakeIo({ env: {}, fetch, WebSocket: refusedWebSocket() });
  await assert.rejects(dispatch(io, { origin: ORIGIN, token: 'tok' }, { type: 'x' }), /^Error: t3 refused the WebSocket connection: it gave no reason/);
});

test('finish archives the thread on ok and leaves it otherwise', async () => {
  const log: Log = [];
  const io = fakeIo({ env: {}, files: RUNNING, fetch: fakeFetch([200], []), WebSocket: fakeWebSocket(SUCCESS, log) });
  const adapter = createAdapter(io);
  await adapter.finish(HANDLE, false, { cwd: '/r' });
  assert.deepEqual(log, []);
  await adapter.finish(HANDLE, true, { cwd: '/r' });
  const frame = log[1][1] as { payload: { type: string; threadId: string } };
  assert.equal(frame.payload.type, 'thread.archive');
  assert.equal(frame.payload.threadId, 'T');
});

test('finish sends the token to the running server, never to an origin the handle names', async () => {
  const fetches: [string, RequestInit | undefined][] = [];
  const io = fakeIo({ env: {}, files: RUNNING, fetch: fakeFetch([200], fetches), WebSocket: fakeWebSocket(SUCCESS, []) });
  await createAdapter(io).finish({ ...HANDLE, origin: 'http://evil.example' }, true, { cwd: '/r' });
  assert.equal(fetches[0][0], `${ORIGIN}/api/auth/websocket-ticket`);
});

test('finish is refused when t3 is not running', async () => {
  await assert.rejects(createAdapter(fakeIo({ env: {} })).finish(HANDLE, true, { cwd: '/r' }), (error) => error instanceof Refused && /not running/.test(error.message));
});

const runRequest: SpawnRequest = { kind: 'run', name: 'x-plan-review', prompt: 'PROMPT', cwd: '/r/sub', family: 'gpt', model: 'gpt-6.1-sol', effort: 'high', readOnly: true };

test('spawn creates a plan-mode thread in the project for this repo, and the handle holds no token', async () => {
  const db = database();
  addProject(db, { root: '/r' });
  const log: Log = [];
  const io = fakeIo({
    env: {},
    files: RUNNING,
    results: [{ stdout: '/r/.git\n', stderr: '', code: 0 }, { stdout: 'main\n', stderr: '', code: 0 }],
    openDb: () => shared(db),
    fetch: fakeFetch([200], []),
    WebSocket: fakeWebSocket(LAUNCHED, log),
  });
  const { handle } = await createAdapter(io).spawn(runRequest);
  assert.deepEqual(io.calls.map(([cmd, args]) => [cmd, args]), [
    ['git', ['-C', '/r/sub', 'rev-parse', '--path-format=absolute', '--git-common-dir']],
    ['git', ['-C', '/r/sub', 'branch', '--show-current']],
  ]);
  const frame = log[1][1] as { tag: string; payload: ReturnType<typeof buildLaunch> };
  assert.equal(frame.tag, 'orchestration.launchThread');
  // The handle names the thread t3 answered with, and holds no token.
  assert.deepEqual(handle, { kind: 'thread', id: 'T', origin: ORIGIN });
  assert.match(frame.payload.threadId, /^[0-9a-f-]{36}$/);
  assert.equal(frame.payload.interactionMode, 'plan');
  assert.equal(frame.payload.projectId, 'p1');
  assert.deepEqual(frame.payload.workspaceStrategy, { type: 'root', branch: 'main' });
  assert.equal(frame.payload.title, 'x-plan-review');
  assert.equal(frame.payload.initialMessage.text, 'PROMPT');
  assert.deepEqual(frame.payload.modelSelection, { instanceId: 'codex', model: 'gpt-6.1-sol', options: [{ id: 'reasoningEffort', value: 'high' }] });
});

test('spawn fails with the add hint when t3 does not know the repo', async () => {
  const db = database();
  addProject(db, { title: 'other', root: '/o' });
  const io = fakeIo({
    env: {},
    files: RUNNING,
    results: [{ stdout: '/r/.git\n', stderr: '', code: 0 }],
    openDb: () => shared(db),
  });
  await assert.rejects(createAdapter(io).spawn({ ...runRequest, cwd: '/r' }), (error) => error instanceof Refused && /t3 project add \/r; known: other/.test(error.message));
});

test('spawn is refused when git fails in the repository', async () => {
  const io = fakeIo({ env: {}, files: RUNNING, results: [{ stdout: '', stderr: 'fatal: not a git repository', code: 128 }] });
  await assert.rejects(createAdapter(io).spawn(runRequest), (error) => error instanceof Refused && /not a git repository/.test(error.message));
});

test('spawn is refused when t3 is not running', async () => {
  await assert.rejects(createAdapter(fakeIo({ env: {} })).spawn(runRequest), (error) => error instanceof Refused && /not running/.test(error.message));
});

// Spawn a session with a manifest that has defaults, and answer the model
// selection t3 was sent. A run is at high effort unless told otherwise.
async function spawnedSelection(request: Partial<SpawnRequest>, { projectDefault = null as string | null } = {}) {
  const db = database();
  addProject(db, { root: '/r', selection: projectDefault });
  const log: Log = [];
  const manifest = { manifest: { currentModels: {}, providers: {
    codex: { defaults: null }, claudeAgent: { defaults: { chat: 'claude-fable-5-1' } }, antigravity: { defaults: { chat: 'gemini-3.8-flash-high' } },
  } } };
  const io = fakeIo({
    env: {},
    files: { ...RUNNING, '/home/u/.t3/userdata/model-manifest.json': JSON.stringify(manifest) },
    results: [{ stdout: '/r/.git\n', stderr: '', code: 0 }, { stdout: 'main\n', stderr: '', code: 0 }],
    openDb: () => shared(db),
    fetch: fakeFetch([200], []),
    WebSocket: fakeWebSocket(LAUNCHED, log),
  });
  await createAdapter(io).spawn({ ...runRequest, ...request });
  return (log[1][1] as { payload: ReturnType<typeof buildLaunch> }).payload.modelSelection;
}
const start = { kind: 'start', effort: null, readOnly: false } as const;

test('a run with a null model spawns the manifest\'s default chat model for the provider', async () => {
  assert.equal((await spawnedSelection({ family: 'claude', model: null })).model, 'claude-fable-5-1');
});

test('a run with a null model spawns null when the provider has no default', async () => {
  assert.equal((await spawnedSelection({ family: 'gpt', model: null })).model, null);
});

test('a gemini run with a null model spawns the default at the review\'s effort', async () => {
  assert.equal((await spawnedSelection({ family: 'gemini', model: null, effort: 'low' })).model, 'gemini-3.8-flash-low');
});

test('a start runs the request\'s model, not the project default, with no effort option', async () => {
  const selection = await spawnedSelection({ ...start, family: 'gpt', model: 'gpt-6-luna' },
    { projectDefault: '{"instanceId":"claudeAgent","model":"claude-opus-5-5","options":[]}' });
  assert.deepEqual(selection, { instanceId: 'codex', model: 'gpt-6-luna', options: [] });
});

test('a gemini start adds medium effort to the model', async () => {
  assert.equal((await spawnedSelection({ ...start, family: 'gemini', model: 'gemini-3.8-flash' })).model, 'gemini-3.8-flash-medium');
});

test('a start with a bare family runs the provider\'s default as the manifest names it', async () => {
  assert.equal((await spawnedSelection({ ...start, family: 'gemini', model: null })).model, 'gemini-3.8-flash-high');
});

test('a start with a bare family spawns null when the provider has no default', async () => {
  assert.deepEqual(await spawnedSelection({ ...start, family: 'gpt', model: null }), { instanceId: 'codex', model: null, options: [] });
});
