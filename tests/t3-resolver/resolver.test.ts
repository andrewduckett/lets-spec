// lets-delegate-t3 end to end: the kit's handler with the real T3 adapter,
// on a fake io.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { parentPid, type Db } from '../../contrib/resolver-kit/src/io.ts';
import { buildRequest } from '../../contrib/resolver-kit/src/protocol.ts';
import { handle } from '../resolver-kit/fixtures/handle.ts';
import { createAdapter } from '../../contrib/t3-resolver/src/t3.ts';
import { fakeIo } from '../resolver-kit/fixtures/fake-io.ts';

const RUNTIME = '/home/u/.t3/userdata/server-runtime.json';
// This process is 100, and the T3 server is 7.
const io = (parents: Record<number, number>) => fakeIo({
  files: { [RUNTIME]: JSON.stringify({ pid: 7, origin: 'http://127.0.0.1:3773' }) },
  pid: 100,
  parentPid: (pid) => parents[pid] ?? null,
  processAlive: (pid) => pid === 7,
  env: {},
});
const insideT3 = () => io({ 100: 50, 50: 7, 7: 1 });
const probeRequest = JSON.stringify(buildRequest('probe', { cwd: '/r' }));
// What probe answers inside T3 Code when T3 has no model manifest.
const noManifest = {
  code: 0,
  stdout: '{"resolver":"t3","options":[]}\n',
  stderr: 'lets-delegate-t3: T3 has no model manifest at /home/u/.t3/userdata/model-manifest.json, so it lists no models\n',
};

test('probe inside T3 Code with no model manifest lists no options, and warns with the manifest\'s path', async () => {
  assert.deepEqual(await handle('probe', probeRequest, createAdapter(insideT3())), noManifest);
});

test('probe inside T3 Code on a system with no /proc finds the T3 server with ps', async () => {
  const parents: Record<string, string> = { 100: '   50\n', 50: '    7\n', 7: '    1\n' };
  // No file exists, as on macOS, and ps prints each process's parent.
  const sys = {
    readFileSync(path: string): string {
      throw new Error(`ENOENT: ${path}`);
    },
    existsSync: () => false,
    spawnSync: (_cmd: string, args: string[]) => ({ stdout: parents[args.at(-1)!] ?? '' }),
  };
  const noProc = { ...insideT3(), parentPid: (pid: number) => parentPid(pid, sys) };
  assert.deepEqual(await handle('probe', probeRequest, createAdapter(noProc)), noManifest);
});

test('probe declines when the running T3 server is not an ancestor', async () => {
  const elsewhere = io({ 100: 50, 50: 1 });
  assert.deepEqual(await handle('probe', probeRequest, createAdapter(elsewhere)), { code: 75, stdout: '', stderr: 'lets-delegate-t3: not inside T3 Code\n' });
});

test('finish refuses a tab handle with exit 4', async () => {
  const request = JSON.stringify(buildRequest('finish', { cwd: '/r', handle: { kind: 'tab', id: 'tab-3' }, ok: true }));
  const answer = await handle('finish', request, createAdapter(insideT3()));
  assert.equal(answer.code, 4);
  assert.equal(answer.stdout, '');
});

// A T3 that is running, with a project for /r and the state in db. Each
// request over the WebSocket succeeds, and is logged.
const ORIGIN = 'http://127.0.0.1:3773';
const SCHEMA = readFileSync(new URL('./fixtures/t3-schema.sql', import.meta.url), 'utf8');
function runningT3({ projectRoot = '/r' } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  db.prepare(`insert into projection_projects (project_id, title, workspace_root, scripts_json, created_at, updated_at)
    values ('p1', 'lets-spec', ?, '[]', 'now', 'now')`).run(projectRoot);
  const sent: { tag: string; payload: { type?: string; threadId?: string } }[] = [];
  const WebSocket = class {
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
    send(data: string) {
      sent.push(JSON.parse(data));
      const reply = { _tag: 'Exit', requestId: '1', exit: { _tag: 'Success', value: { threadId: 'T' } } };
      queueMicrotask(() => this.emit('message', { data: JSON.stringify(reply) }));
    }
    close() {}
  } as unknown as typeof globalThis.WebSocket;
  const fetch = (async () => ({ status: 200, ok: true, json: async () => ({ ticket: 'TICKET' }) })) as unknown as typeof globalThis.fetch;
  const fake = fakeIo({
    files: { [RUNTIME]: JSON.stringify({ pid: 7, origin: ORIGIN }), '/home/u/.config/lets-delegate/t3-token': 'tok' },
    pid: 100,
    parentPid: (pid) => ({ 100: 50, 50: 7, 7: 1 } as Record<number, number>)[pid] ?? null,
    processAlive: (pid) => pid === 7,
    env: {},
    results: [{ stdout: '/r/.git\n', stderr: '', code: 0 }, { stdout: 'main\n', stderr: '', code: 0 }],
    openDb: () => ({ prepare: (sql: string) => db.prepare(sql), close() {} }) as Db,
    fetch,
    WebSocket,
  });
  return { db, sent, io: fake };
}
const runRequest = JSON.stringify(buildRequest('run', {
  cwd: '/r', name: 'x', prompt: 'P', sourceFamily: 'claude', effort: 'high', timeoutMinutes: 1, model: 'gpt/gpt-6-astra',
}));

test('a run T3 fails before any message exits 3 with its failure, and archives the thread', async () => {
  const { db, sent, io } = runningT3();
  db.prepare(`insert into orchestration_v2_projection_runs (run_id, thread_id, ordinal, provider, status, requested_at, payload_json)
    values ('run-1', 'T', 1, 'codex', 'failed', 'now', '{}')`).run();
  db.prepare(`insert into orchestration_v2_projection_turn_items (turn_item_id, thread_id, run_id, ordinal, type, status, updated_at, payload_json)
    values ('e1', 'T', 'run-1', 1, 'error', 'failed', 'now', ?)`).run(JSON.stringify({ failure: { message: 'gpt-6-astra is not available' } }));
  const answer = await handle('run', runRequest, createAdapter(io));
  assert.equal(answer.code, 3, answer.stderr);
  assert.match(answer.stderr, /gpt-6-astra is not available/);
  assert.deepEqual(sent.map(({ payload }) => payload.type ?? 'launch'), ['launch', 'thread.archive']);
  assert.equal(sent[1].payload.threadId, 'T');
});

test('a run in a repository T3 has no project for exits 3, naming it, and creates no thread', async () => {
  const { sent, io } = runningT3({ projectRoot: '/elsewhere' });
  const answer = await handle('run', runRequest, createAdapter(io));
  assert.equal(answer.code, 3, answer.stderr);
  assert.match(answer.stderr, /t3 has no project for \/r/);
  assert.deepEqual(sent, []);
});
