// The t3 resolver through lets delegate: each command with the real T3
// adapter, on the kit's fake io, named in the config.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { run as instructions } from '../../../../lets/src/delegate/instructions.ts';
import { run as review } from '../../../../lets/src/delegate/review.ts';
import type { ReviewOptions } from '../../../../lets/src/delegate/review.ts';
import { parentPid } from '../../../../lets/src/resolvers/kit/io.ts';
import type { Db, Io } from '../../../../lets/src/resolvers/kit/io.ts';
import { createAdapter } from '../../../../lets/src/resolvers/t3/t3.ts';
import { commandDeps } from '../../delegate/fixtures/command-deps.ts';
import { fakeIo } from '../kit/fixtures/fake-io.ts';

const ONLY_T3 = 'version: 2\nresolvers: [t3]\n';
const RUNTIME = '/home/u/.t3/userdata/server-runtime.json';
const MANIFEST = '/home/u/.t3/userdata/model-manifest.json';

// commandDeps whose config lists only t3, the real T3 adapter on io.
const withT3 = (io: Io) => commandDeps({ config: ONLY_T3, real: { t3: createAdapter(io) } });

// This process is 100, and the T3 server is 7.
const io = (parents: Record<number, number>) => fakeIo({
  files: { [RUNTIME]: JSON.stringify({ pid: 7, origin: 'http://127.0.0.1:3773' }) },
  pid: 100,
  parentPid: (pid) => parents[pid] ?? null,
  processAlive: (pid) => pid === 7,
  env: {},
});
const insideT3 = () => io({ 100: 50, 50: 7, 7: 1 });

const reviewInstructions = { strategy: 'review', for: 'code' } as const;

// What review instructions answer inside T3 Code when T3 has no model
// manifest: t3, no options, and a warning that names the manifest.
async function answersWithNoManifest(adapterIo: Io) {
  const t = withT3(adapterIo);
  assert.equal(await instructions(reviewInstructions, t.deps), 0);
  assert.deepEqual(JSON.parse(t.stdout()), { strategy: 'review', for: 'code', resolver: 't3', options: [], guidance: null });
  assert.ok(t.stderr().includes(MANIFEST), t.stderr());
}

test('review instructions inside T3 Code with no model manifest list no options, and warn with the manifest\'s path', async () => {
  await answersWithNoManifest(insideT3());
});

test('review instructions inside T3 Code on a system with no /proc find the T3 server with ps', async () => {
  const parents: Record<string, string> = { 100: '   50\n', 50: '    7\n', 7: '    1\n' };
  // No file exists, as on macOS, and ps prints each process's parent.
  const sys = {
    readFileSync(path: string): string {
      throw new Error(`ENOENT: ${path}`);
    },
    existsSync: () => false,
    spawnSync: (_cmd: string, args: string[]) => ({ stdout: parents[args.at(-1)!] ?? '' }),
  };
  await answersWithNoManifest({ ...insideT3(), parentPid: (pid: number) => parentPid(pid, sys) });
});

test('review instructions decline when the running T3 server is not an ancestor', async () => {
  const t = withT3(io({ 100: 50, 50: 1 }));
  assert.equal(await instructions(reviewInstructions, t.deps), 2);
  assert.equal(t.stdout(), '');
  assert.match(t.stderr(), /every resolver declined/);
});

// A T3 that is running, with a project for projectRoot and the state in db.
// Each request over the WebSocket succeeds, and is logged in sent.
const ORIGIN = 'http://127.0.0.1:3773';
const SCHEMA = readFileSync(new URL('./fixtures/t3-schema.sql', import.meta.url), 'utf8');
function runningT3({ projectRoot = '/repo' } = {}) {
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
  const adapterIo = fakeIo({
    files: { [RUNTIME]: JSON.stringify({ pid: 7, origin: ORIGIN }), '/home/u/.config/lets-delegate/t3-token': 'tok' },
    pid: 100,
    parentPid: (pid) => ({ 100: 50, 50: 7, 7: 1 } as Record<number, number>)[pid] ?? null,
    processAlive: (pid) => pid === 7,
    env: {},
    results: [{ stdout: '/repo/.git\n', stderr: '', code: 0 }, { stdout: 'main\n', stderr: '', code: 0 }],
    openDb: () => ({ prepare: (sql: string) => db.prepare(sql), close() {} }) as Db,
    fetch,
    WebSocket,
  });
  return { db, sent, t: withT3(adapterIo) };
}
// A review named x on gpt/gpt-6-astra, from a claude author.
const astraReview: ReviewOptions = { for: 'code', name: 'x', promptFile: 'p.md', sourceFamily: 'claude', effort: 'high', timeoutMinutes: 1, models: ['gpt/gpt-6-astra'] };

test('a review T3 fails before any message is exit 3 with its failure, and archives the thread', async () => {
  const { db, sent, t } = runningT3();
  db.prepare(`insert into orchestration_v2_projection_runs (run_id, thread_id, ordinal, provider, status, requested_at, payload_json)
    values ('run-1', 'T', 1, 'codex', 'failed', 'now', '{}')`).run();
  db.prepare(`insert into orchestration_v2_projection_turn_items (turn_item_id, thread_id, run_id, ordinal, type, status, updated_at, payload_json)
    values ('e1', 'T', 'run-1', 1, 'error', 'failed', 'now', ?)`).run(JSON.stringify({ failure: { message: 'gpt-6-astra is not available' } }));
  assert.equal(await review(astraReview, t.deps), 3, t.stderr());
  assert.equal(t.stdout(), '');
  assert.match(t.stderr(), /gpt-6-astra is not available \(thread T\)\n$/);
  assert.deepEqual(sent.map(({ payload }) => payload.type ?? 'launch'), ['launch', 'thread.archive']);
  assert.equal(sent[1].payload.threadId, 'T');
});

test('a review in a repository T3 has no project for is exit 3, naming it, and creates no thread', async () => {
  const { sent, t } = runningT3({ projectRoot: '/elsewhere' });
  assert.equal(await review(astraReview, t.deps), 3, t.stderr());
  assert.match(t.stderr(), /t3 has no project for \/repo/);
  assert.doesNotMatch(t.stderr(), /\(thread /);
  assert.deepEqual(sent, []);
});

test('the t3 adapter makes thread handles only', () => {
  assert.equal(createAdapter(fakeIo()).handleKind, 'thread');
});
