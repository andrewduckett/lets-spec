import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { SessionFailed, SpawnError } from '../../contrib/lets-delegate-resolver/src/errors.ts';
import type { Db } from '../../contrib/lets-delegate-resolver/src/io.ts';
import {
  baseDir, buildTurnStart, createAdapter, dispatch, familiesFromT3Manifest, findProject, isAncestor, readMessage,
  readRuntime, readToken, readTurn, t3ModelSelection, TOKEN_FILE_SUFFIX,
} from '../../contrib/lets-delegate-resolver/src/t3.ts';
import type { SpawnRequest } from '../../contrib/lets-delegate-resolver/src/adapter.ts';
import { fakeIo } from './fixtures/fake-io.ts';

const SCHEMA = readFileSync(new URL('./fixtures/t3-schema.sql', import.meta.url), 'utf8');
const RUNTIME = '/home/u/.t3/userdata/server-runtime.json';
const TOKEN = `/home/u/${TOKEN_FILE_SUFFIX}`;
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
function addThread(db: DatabaseSync, threadId: string, { pendingInput = 0, pendingApproval = 0 } = {}) {
  db.prepare(`insert into projection_threads (thread_id, project_id, title, created_at, updated_at, pending_user_input_count, pending_approval_count)
    values (?, 'p1', 't', 'now', 'now', ?, ?)`).run(threadId, pendingInput, pendingApproval);
}
function addTurn(db: DatabaseSync, threadId: string, turnId: string, state: string, messageId: string | null = null) {
  db.prepare(`insert into projection_turns (thread_id, turn_id, assistant_message_id, state, requested_at, checkpoint_files_json)
    values (?, ?, ?, ?, 'now', '[]')`).run(threadId, turnId, messageId, state);
}
function addMessage(db: DatabaseSync, messageId: string, threadId: string, text: string, streaming: number) {
  db.prepare(`insert into projection_thread_messages (message_id, thread_id, role, text, is_streaming, created_at, updated_at)
    values (?, ?, 'assistant', ?, ?, 'now', 'now')`).run(messageId, threadId, text, streaming);
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

test('reads current models from the t3 manifest, gemini by effort suffix', () => {
  const manifest = { manifest: { currentModels: {
    codex: ['gpt-6-astra', 'gpt-6.1-sol'], claudeAgent: ['claude-fable-5-1'],
    antigravity: ['gemini-3.8-flash-high', 'gemini-3.8-flash-medium', 'gemini-3.8-flash-low'] } } };
  assert.deepEqual(familiesFromT3Manifest(manifest, 'medium'),
    { gpt: ['gpt-6-astra', 'gpt-6.1-sol'], claude: ['claude-fable-5-1'], gemini: ['gemini-3.8-flash-medium', 'gemini-3.8-flash-high', 'gemini-3.8-flash-low'] });
  assert.deepEqual(familiesFromT3Manifest({ manifest: { currentModels: {} } }, 'high'), { gpt: [], claude: [], gemini: [] });
});

test('availableFamilies reads the model manifest, and a missing one means none', () => {
  const manifest = { manifest: { currentModels: { codex: ['gpt-6.1-sol'], claudeAgent: ['claude-fable-5-1'] } } };
  const io = fakeIo({ files: { '/home/u/.t3/userdata/model-manifest.json': JSON.stringify(manifest) }, env: {} });
  assert.deepEqual(createAdapter(io).availableFamilies({ effort: 'high' }), { gpt: ['gpt-6.1-sol'], claude: ['claude-fable-5-1'], gemini: [] });
  assert.deepEqual(createAdapter(fakeIo({ env: {} })).availableFamilies({ effort: 'high' }), { gpt: [], claude: [], gemini: [] });
});

test('t3 model selection carries the effort in each provider\'s own option', () => {
  assert.deepEqual(t3ModelSelection({ family: 'gpt', model: 'gpt-6.1-sol', effort: 'high' }),
    { instanceId: 'codex', model: 'gpt-6.1-sol', options: [{ id: 'reasoningEffort', value: 'high' }] });
  assert.deepEqual(t3ModelSelection({ family: 'claude', model: 'claude-fable-5-1', effort: 'low' }),
    { instanceId: 'claudeAgent', model: 'claude-fable-5-1', options: [{ id: 'effort', value: 'low' }] });
  assert.deepEqual(t3ModelSelection({ family: 'gemini', model: 'gemini-3.8-flash-high', effort: 'high' }),
    { instanceId: 'antigravity', model: 'gemini-3.8-flash-high', options: [] });
});

test('findProject matches the workspace root, or names the known projects', () => {
  const db = database();
  addProject(db, { id: 'p1', title: 'lets-spec', root: '/r' });
  addProject(db, { id: 'p2', title: 'other', root: '/o' });
  assert.equal(findProject(shared(db), '/r').project_id, 'p1');
  assert.throws(() => findProject(shared(db), '/x'), (error) =>
    error instanceof SpawnError && /t3 project add \/x/.test(error.message) && /lets-spec, other/.test(error.message));
});

test('buildTurnStart has the upstream shape without a worktree', () => {
  const modelSelection = { instanceId: 'codex', model: 'gpt-6.1-sol', options: [{ id: 'reasoningEffort', value: 'high' }] };
  const command = buildTurnStart({
    threadId: 'T', projectId: 'P', title: 'x-plan-review', text: 'PROMPT', modelSelection,
    interactionMode: 'plan', branch: 'main', now: '2026-10-13T00:00:00.000Z', messageId: 'M', commandId: 'C',
  });
  assert.deepEqual(command, {
    type: 'thread.turn.start',
    commandId: 'C',
    threadId: 'T',
    message: { messageId: 'M', role: 'user', text: 'PROMPT', attachments: [] },
    modelSelection,
    titleSeed: 'x-plan-review',
    runtimeMode: 'full-access',
    interactionMode: 'plan',
    bootstrap: {
      createThread: {
        projectId: 'P', title: 'x-plan-review', modelSelection, runtimeMode: 'full-access',
        interactionMode: 'plan', branch: 'main', worktreePath: null, createdAt: '2026-10-13T00:00:00.000Z',
      },
    },
    createdAt: '2026-10-13T00:00:00.000Z',
  });
  assert.equal('prepareWorktree' in command.bootstrap, false);
  const plain = buildTurnStart({ threadId: 'T', projectId: 'P', title: 't', text: 'x', modelSelection, interactionMode: 'default', branch: null, now: 'n' });
  assert.equal(plain.interactionMode, 'default');
  assert.match(plain.commandId, /^[0-9a-f-]{36}$/);
});

test('readTurn returns the newest turn, or null when there is none', () => {
  const db = database();
  addThread(db, 'T');
  assert.equal(readTurn(shared(db), 'T'), null);
  addTurn(db, 'T', 'turn-1', 'completed', 'm1');
  addTurn(db, 'T', 'turn-2', 'running');
  assert.deepEqual(readTurn(shared(db), 'T'), { state: 'running', assistantMessageId: null, pendingUserInput: 0, pendingApproval: 0, lastError: null });
  addMessage(db, 'm1', 'T', 'hi', 0);
  assert.deepEqual(readMessage(shared(db), 'm1'), { text: 'hi', isStreaming: 0 });
  assert.equal(readMessage(shared(db), 'nope'), null);
});

// An adapter whose database is `db` and whose sleep runs the next step.
function waitingAdapter(db: DatabaseSync, steps: (() => void)[]) {
  return createAdapter(fakeIo({ env: {}, openDb: () => shared(db), sleep: async () => steps.shift()?.() }));
}
const HANDLE = { kind: 'thread', id: 'T', origin: ORIGIN };
const SESSION = { handle: HANDLE };

test('waitForResult waits for the turn to complete and the message to stop streaming', async () => {
  const db = database();
  addThread(db, 'T');
  addTurn(db, 'T', 'turn-1', 'running');
  const steps = [
    () => { db.exec("update projection_turns set state = 'completed', assistant_message_id = 'm1'"); addMessage(db, 'm1', 'T', 'partial', 1); },
    () => db.exec("update projection_thread_messages set text = 'FINDINGS', is_streaming = 0"),
  ];
  assert.deepEqual(await waitingAdapter(db, steps).waitForResult(SESSION, { timeoutMs: 60000 }), { text: 'FINDINGS' });
  assert.equal(steps.length, 0);
});
test('waitForResult fails on a turn error with the session\'s last error', async () => {
  const db = database();
  addThread(db, 'T');
  addTurn(db, 'T', 'turn-1', 'error');
  db.prepare("insert into projection_thread_sessions (thread_id, status, last_error, updated_at) values ('T', 'error', 'quota exceeded', 'now')").run();
  await assert.rejects(waitingAdapter(db, []).waitForResult(SESSION, { timeoutMs: 60000 }),
    (error) => error instanceof SessionFailed && error.message === 'quota exceeded');
});
test('waitForResult fails when the session stops to ask', async () => {
  const db = database();
  addThread(db, 'T', { pendingInput: 1 });
  addTurn(db, 'T', 'turn-1', 'running');
  await assert.rejects(waitingAdapter(db, []).waitForResult(SESSION, { timeoutMs: 60000 }), /stopped to ask/);
});
test('waitForResult fails on an interrupted turn', async () => {
  const db = database();
  addThread(db, 'T');
  addTurn(db, 'T', 'turn-1', 'interrupted');
  await assert.rejects(waitingAdapter(db, []).waitForResult(SESSION, { timeoutMs: 60000 }), /turn interrupted/);
});
test('waitForResult returns an empty final message as it is; the resolver rejects it', async () => {
  const db = database();
  addThread(db, 'T');
  addTurn(db, 'T', 'turn-1', 'completed', 'm1');
  addMessage(db, 'm1', 'T', '', 0);
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

test('dispatch sends one request frame and returns the success value', async () => {
  const log: Log = [];
  const fetches: [string, RequestInit | undefined][] = [];
  const io = fakeIo({ env: {}, fetch: fakeFetch([200], fetches), WebSocket: fakeWebSocket(SUCCESS, log) });
  const command = { type: 'thread.archive', commandId: 'C', threadId: 'T' };
  assert.deepEqual(await dispatch(io, { origin: ORIGIN, token: 'tok' }, command), { sequence: 9 });
  assert.deepEqual(fetches, [[`${ORIGIN}/api/auth/websocket-ticket`, { method: 'POST', headers: { authorization: 'Bearer tok' } }]]);
  assert.deepEqual(log, [
    ['open', 'ws://127.0.0.1:3773/ws?wsTicket=TICKET'],
    ['send', { _tag: 'Request', id: '1', tag: 'orchestration.dispatchCommand', payload: command, headers: [] }],
  ]);
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
    error instanceof SpawnError && error.message === 't3 rejected the token twice');
});
test('dispatch fails on a Defect', async () => {
  const io = fakeIo({ env: {}, fetch: fakeFetch([200], []), WebSocket: fakeWebSocket({ _tag: 'Defect', defect: 'boom' }, []) });
  await assert.rejects(dispatch(io, { origin: ORIGIN, token: 'tok' }, { type: 'x' }), SpawnError);
});

test('finish archives the thread on ok and leaves it otherwise', async () => {
  const log: Log = [];
  const io = fakeIo({ env: {}, files: RUNNING, fetch: fakeFetch([200], []), WebSocket: fakeWebSocket(SUCCESS, log) });
  const adapter = createAdapter(io);
  await adapter.finish(HANDLE, false);
  assert.deepEqual(log, []);
  await adapter.finish(HANDLE, true);
  const frame = log[1][1] as { payload: { type: string; threadId: string } };
  assert.equal(frame.payload.type, 'thread.archive');
  assert.equal(frame.payload.threadId, 'T');
});

test('finish sends the token to the running server, never to an origin the handle names', async () => {
  const fetches: [string, RequestInit | undefined][] = [];
  const io = fakeIo({ env: {}, files: RUNNING, fetch: fakeFetch([200], fetches), WebSocket: fakeWebSocket(SUCCESS, []) });
  await createAdapter(io).finish({ ...HANDLE, origin: 'http://evil.example' }, true);
  assert.equal(fetches[0][0], `${ORIGIN}/api/auth/websocket-ticket`);
});

test('finish fails when t3 is not running', async () => {
  await assert.rejects(createAdapter(fakeIo({ env: {} })).finish(HANDLE, true), (error) => error instanceof SpawnError && /not running/.test(error.message));
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
    WebSocket: fakeWebSocket(SUCCESS, log),
  });
  const { handle } = await createAdapter(io).spawn(runRequest);
  assert.deepEqual(io.calls.map(([cmd, args]) => [cmd, args]), [
    ['git', ['-C', '/r/sub', 'rev-parse', '--path-format=absolute', '--git-common-dir']],
    ['git', ['-C', '/r/sub', 'branch', '--show-current']],
  ]);
  const command = (log[1][1] as { payload: ReturnType<typeof buildTurnStart> }).payload;
  assert.deepEqual(handle, { kind: 'thread', id: command.threadId, origin: ORIGIN });
  assert.equal(command.interactionMode, 'plan');
  assert.equal(command.bootstrap.createThread.projectId, 'p1');
  assert.equal(command.bootstrap.createThread.branch, 'main');
  assert.equal(command.titleSeed, 'x-plan-review');
  assert.deepEqual(command.modelSelection, { instanceId: 'codex', model: 'gpt-6.1-sol', options: [{ id: 'reasoningEffort', value: 'high' }] });
});

test('a start uses the project default, then claude-opus-5-5', async () => {
  const selections = [];
  for (const projectDefault of ['{"instanceId":"codex","model":"gpt-6-astra","options":[]}', null]) {
    const db = database();
    addProject(db, { root: '/r', selection: projectDefault });
    const log: Log = [];
    const io = fakeIo({
      env: {},
      files: RUNNING,
      results: [{ stdout: '/r/.git\n', stderr: '', code: 0 }, { stdout: '\n', stderr: '', code: 0 }],
      openDb: () => shared(db),
      fetch: fakeFetch([200], []),
      WebSocket: fakeWebSocket(SUCCESS, log),
    });
    await createAdapter(io).spawn({ kind: 'start', name: 'fix-login', prompt: 'Run it', cwd: '/r', family: 'claude', model: null, effort: null, readOnly: false });
    const command = (log[1][1] as { payload: ReturnType<typeof buildTurnStart> }).payload;
    assert.equal(command.interactionMode, 'default');
    assert.equal(command.bootstrap.createThread.branch, null);
    selections.push(command.modelSelection);
  }
  assert.deepEqual(selections, [
    { instanceId: 'codex', model: 'gpt-6-astra', options: [] },
    { instanceId: 'claudeAgent', model: 'claude-opus-5-5', options: [] },
  ]);
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
  await assert.rejects(createAdapter(io).spawn({ ...runRequest, cwd: '/r' }), /t3 project add \/r; known: other/);
});
