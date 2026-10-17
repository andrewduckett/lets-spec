// Inside T3 Code: each session is a new thread in the sidebar. The thread is
// created the way the desktop UI does it, with one `thread.turn.start` that
// carries `bootstrap`, sent over the server's WebSocket RPC. The result is
// read back from t3's state database.
//
// Copied and trimmed on 2026-10-13 from t3-thread:
//   https://github.com/matheustimbo/t3code, branch fork-main,
//   .agents/skills/t3-thread/scripts/t3-thread.mjs
// Protocol types live in packages/contracts/src/orchestration.ts of
// https://github.com/pingdotgg/t3code. A t3 update can change any of this;
// run the smoke test in the README after each one.
//
// Kept: token issue and refresh, project lookup by cwd, model selection,
// dispatch over the WebSocket, archive.
// Dropped: the worktree (prepareWorktree, runSetupScript), --local-base,
// --dry-run, --stop, -p/--project, -b, -t, --instance, --selection, and the
// message from stdin. The sqlite3 binary is replaced by node:sqlite.
// Upstream's serverCli() finds the server's own executable, with a fallback
// for the macOS app bundle. That is dropped: on this machine `t3` is on PATH.
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { SessionFailed, SpawnError } from './errors.ts';
import type { Available } from './families.ts';
import type { Adapter, Session, SpawnRequest } from './adapter.ts';
import type { Db, Io } from './io.ts';
import { FAMILIES } from './protocol.ts';
import type { Effort, Family, Handle } from './protocol.ts';
import { pollUntil } from './wait.ts';

export const TOKEN_FILE_SUFFIX = '.config/lets-delegate/t3-token';

const POLL_MS = 5000;
const REPLY_TIMEOUT_MS = 120_000;

// The t3 provider instance for each family.
export const T3_INSTANCE: Record<Family, string> = { gpt: 'codex', claude: 'claudeAgent', gemini: 'antigravity' };
// Each t3 provider names its effort option differently. Gemini carries the
// effort in the model id instead.
const T3_EFFORT_OPTION: Record<Family, string | null> = { gpt: 'reasoningEffort', claude: 'effort', gemini: null };
// The model a start uses when the project has no default.
const START_MODEL = 'claude-opus-5-5';

export type ModelSelection = { instanceId: string; model: string | null; options: { id: string; value: string }[] };
type Manifest = { manifest: { currentModels: Record<string, string[] | undefined> } };
type Project = { project_id: string; title: string; workspace_root: string; default_model_selection_json: string | null };

// t3 lists gemini once per effort, as gemini-<version>-<effort>. Put the one
// for this effort first and keep the rest in order.
export function familiesFromT3Manifest(manifest: Manifest, effort: Effort): Available {
  const current = manifest.manifest.currentModels;
  const families = {} as Available;
  for (const family of FAMILIES) families[family] = [...(current[T3_INSTANCE[family]] ?? [])];
  const match = families.gemini.findIndex((id) => id?.endsWith(`-${effort}`));
  if (match > 0) families.gemini.unshift(...families.gemini.splice(match, 1));
  return families;
}

export function t3ModelSelection({ family, model, effort }: { family: Family; model: string | null; effort: Effort }): ModelSelection {
  const option = T3_EFFORT_OPTION[family];
  return { instanceId: T3_INSTANCE[family], model, options: option ? [{ id: option, value: effort }] : [] };
}

export function baseDir(env: Io['env'], homedir: string): string {
  return env.T3CODE_HOME ?? `${homedir}/.t3`;
}

const userdata = (io: Io) => `${baseDir(io.env, io.homedir())}/userdata`;

// The running server's origin and pid, or null when there is no runtime file.
export function readRuntime(io: Io): { origin: string; pid: number } | null {
  const path = `${userdata(io)}/server-runtime.json`;
  if (!io.exists(path)) return null;
  try {
    const { origin, pid } = JSON.parse(io.readFile(path));
    return { origin, pid };
  } catch {
    return null;
  }
}

// True when ancestorPid is this process or one of its parents.
export function isAncestor(io: Io, ancestorPid: number): boolean {
  let pid: number | null = io.pid;
  // The bound guards against a cycle in a bad parent map.
  for (let hops = 0; pid !== null && pid > 0 && hops < 4096; hops++) {
    if (pid === ancestorPid) return true;
    pid = io.parentPid(pid);
  }
  return false;
}

export function findProject(db: Db, repoRoot: string): Project {
  const projects = db.prepare(
    'select project_id, title, workspace_root, default_model_selection_json from projection_projects where deleted_at is null',
  ).all() as Project[];
  const project = projects.find((p) => p.workspace_root === repoRoot);
  if (!project) {
    throw new SpawnError(`t3 has no project for ${repoRoot}; run: t3 project add ${repoRoot}; known: ${projects.map((p) => p.title).join(', ')}`);
  }
  return { ...project };
}

type TurnStartInput = {
  threadId: string; projectId: string; title: string; text: string; modelSelection: ModelSelection;
  interactionMode: 'plan' | 'default'; branch: string | null; now: string; messageId?: string; commandId?: string;
};

// messageId and commandId are random unless given, so tests can fix them.
export function buildTurnStart({
  threadId, projectId, title, text, modelSelection, interactionMode, branch, now, messageId = randomUUID(), commandId = randomUUID(),
}: TurnStartInput) {
  const runtimeMode = 'full-access';
  return {
    type: 'thread.turn.start',
    commandId,
    threadId,
    message: { messageId, role: 'user', text, attachments: [] },
    modelSelection,
    titleSeed: title,
    runtimeMode,
    interactionMode,
    bootstrap: {
      createThread: { projectId, title, modelSelection, runtimeMode, interactionMode, branch, worktreePath: null, createdAt: now },
    },
    createdAt: now,
  };
}

export type Turn = { state: string; assistantMessageId: string | null; pendingUserInput: number; pendingApproval: number; lastError: string | null };

// The thread's newest turn, with what the thread and its session say.
export function readTurn(db: Db, threadId: string): Turn | null {
  const row = db.prepare(`
    select t.state, t.assistant_message_id, th.pending_user_input_count, th.pending_approval_count, s.last_error
    from projection_turns t
    left join projection_threads th on th.thread_id = t.thread_id
    left join projection_thread_sessions s on s.thread_id = t.thread_id
    where t.thread_id = ?
    order by t.row_id desc
    limit 1`).get(threadId) as Record<string, string | number | null> | undefined;
  if (!row) return null;
  return {
    state: row.state as string,
    assistantMessageId: row.assistant_message_id as string | null,
    pendingUserInput: (row.pending_user_input_count as number | null) ?? 0,
    pendingApproval: (row.pending_approval_count as number | null) ?? 0,
    lastError: row.last_error as string | null,
  };
}

export function readMessage(db: Db, messageId: string): { text: string; isStreaming: number } | null {
  const row = db.prepare('select text, is_streaming from projection_thread_messages where message_id = ?').get(messageId) as
    { text: string; is_streaming: number } | undefined;
  return row ? { text: row.text, isStreaming: row.is_streaming } : null;
}

const tokenPath = (io: Io) => `${io.homedir()}/${TOKEN_FILE_SUFFIX}`;

// Issue a token with the server's own CLI, so it lands in the same auth store.
async function issueToken(io: Io): Promise<string> {
  const args = ['auth', 'session', 'issue', '--base-dir', baseDir(io.env, io.homedir()), '--ttl', '30d', '--label', 'lets-delegate', '--token-only'];
  const { stdout, stderr, code } = await io.execFile('t3', args, { env: io.env });
  const token = stdout.trim();
  if (code !== 0 || !/^\S+$/.test(token)) throw new SpawnError(`could not issue a t3 token (exit ${code}): ${stderr.trim()}`);
  const path = tokenPath(io);
  io.mkdirp(dirname(path), { mode: 0o700 });
  io.writeFile(path, token, { mode: 0o600 });
  return token;
}

// The stored token, or a fresh one when none is stored.
export async function readToken(io: Io): Promise<string> {
  const path = tokenPath(io);
  return io.exists(path) ? io.readFile(path).trim() : issueToken(io);
}

async function requestTicket(io: Io, origin: string, token: string): Promise<Response> {
  try {
    return await io.fetch(`${origin}/api/auth/websocket-ticket`, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
  } catch (error) {
    const { cause, message } = error as Error & { cause?: { code?: string } };
    throw new SpawnError(`t3 at ${origin} is unreachable (${cause?.code ?? message})`);
  }
}

const rejected = (response: Response) => response.status === 401 || response.status === 403;

type Frame = { _tag: string; requestId?: string; exit?: { _tag: string; value?: unknown } };

// Why t3 refused a WebSocket upgrade. t3 answers a plain GET of /ws with
// JSON whose message says why, such as a protocol it no longer speaks.
export async function refusal(io: Io, origin: string): Promise<string> {
  let why = 'it gave no reason';
  try {
    const response = await io.fetch(`${origin}/ws`);
    const { message } = await response.json() as { message?: unknown };
    why = typeof message === 'string' ? message : `HTTP ${response.status}`;
  } catch {
    // Keep the default reason.
  }
  return `t3 refused the WebSocket connection: ${why} A t3 update may have changed its protocol; see "After a t3 update" in the lets-spec README.`;
}

// The HTTP dispatch endpoint ignores `bootstrap`; only the WebSocket RPC
// creates the thread, so go through /ws like the UI does.
export async function dispatch(io: Io, { origin, token }: { origin: string; token: string }, command: { threadId?: string; [field: string]: unknown }) {
  let response = await requestTicket(io, origin, token);
  if (rejected(response)) {
    response = await requestTicket(io, origin, await issueToken(io));
    if (rejected(response)) throw new SpawnError('t3 rejected the token twice');
  }
  if (!response.ok) throw new SpawnError(`t3 ticket request failed with HTTP ${response.status}: ${await response.text()}`);
  const { ticket } = await response.json() as { ticket: string };

  const url = new URL('/ws', origin.replace(/^http/, 'ws'));
  url.searchParams.set('wsTicket', ticket);
  const ws = new io.WebSocket(url);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const exit = await new Promise<NonNullable<Frame['exit']>>((resolveExit, reject) => {
      // A timeout means "unknown", not "failed": the server may still act on it.
      timer = setTimeout(() => reject(new SpawnError(`no reply from t3 after ${REPLY_TIMEOUT_MS / 1000} s; check ${command.threadId} before running again`)), REPLY_TIMEOUT_MS);
      let opened = false;
      let refused = false;
      // Before the socket opens, an error or a close means t3 refused the
      // upgrade, and the WebSocket API hides why. Ask t3 itself, once.
      const fail = (reason: string) => {
        if (opened) return reject(new SpawnError(reason));
        if (refused) return;
        refused = true;
        refusal(io, origin).then((why) => reject(new SpawnError(why)));
      };
      ws.addEventListener('open', () => {
        opened = true;
        ws.send(JSON.stringify({ _tag: 'Request', id: '1', tag: 'orchestration.dispatchCommand', payload: command, headers: [] }));
      });
      ws.addEventListener('message', (event) => {
        for (const message of [JSON.parse(event.data as string) as Frame | Frame[]].flat()) {
          if (message._tag === 'Exit' && String(message.requestId) === '1') resolveExit(message.exit!);
          else if (message._tag === 'Defect' || message._tag === 'ClientProtocolError') reject(new SpawnError(`t3 rejected the request: ${JSON.stringify(message)}`));
        }
      });
      ws.addEventListener('error', (event) => fail(`t3 websocket error: ${(event as Event & { message?: string }).message || event.type}`));
      ws.addEventListener('close', (event) => fail(`t3 websocket closed: ${event.code} ${event.reason}`));
    });
    if (exit._tag !== 'Success') throw new SpawnError(`t3 dispatch failed: ${JSON.stringify(exit)}`);
    return exit.value;
  } finally {
    clearTimeout(timer);
    ws.close();
  }
}

export function createAdapter(io: Io): Adapter {
  const databasePath = () => `${userdata(io)}/state.sqlite`;

  // Open the database, run read(db), and close it again.
  function withDb<T>(read: (db: Db) => T): T {
    const db = io.openDb(databasePath());
    try {
      return read(db);
    } finally {
      db.close();
    }
  }

  async function git(cwd: string, args: string[]): Promise<string> {
    const { stdout, stderr, code } = await io.execFile('git', ['-C', cwd, ...args], { cwd });
    if (code !== 0) throw new SpawnError(`git ${args.join(' ')} failed in ${cwd}: ${stderr.trim()}`);
    return stdout.trim();
  }

  // A start runs with the project's default model, else START_MODEL.
  function startSelection(project: Project): ModelSelection {
    if (project.default_model_selection_json) return JSON.parse(project.default_model_selection_json);
    return { instanceId: T3_INSTANCE.claude, model: START_MODEL, options: [] };
  }

  // The running server. finish sends the token only here, never to an
  // origin a handle names.
  function runningServer() {
    const runtime = readRuntime(io);
    if (runtime === null) throw new SpawnError(`t3 is not running (no ${userdata(io)}/server-runtime.json)`);
    return runtime;
  }

  return {
    name: 't3',

    detect() {
      const runtime = readRuntime(io);
      return runtime !== null && io.processAlive(runtime.pid) && isAncestor(io, runtime.pid);
    },

    availableFamilies({ effort }) {
      const path = `${userdata(io)}/model-manifest.json`;
      if (!io.exists(path)) return { gpt: [], claude: [], gemini: [] };
      return familiesFromT3Manifest(JSON.parse(io.readFile(path)), effort);
    },

    async spawn({ kind, name, prompt, cwd, family, model, effort, readOnly }: SpawnRequest): Promise<Session> {
      const { origin } = runningServer();
      // The main checkout, even when cwd is a linked worktree.
      const repoRoot = resolve(await git(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir']), '..');
      const project = withDb((db) => findProject(db, repoRoot));
      const branch = (await git(cwd, ['branch', '--show-current'])) || null;
      const modelSelection = kind === 'run' ? t3ModelSelection({ family, model, effort: effort! }) : startSelection(project);
      const threadId = randomUUID();
      const token = await readToken(io);
      await dispatch(io, { origin, token }, buildTurnStart({
        threadId,
        projectId: project.project_id,
        title: name,
        text: prompt,
        modelSelection,
        interactionMode: readOnly ? 'plan' : 'default',
        branch,
        now: new Date(io.now()).toISOString(),
      }));
      return { handle: { kind: 'thread', id: threadId, origin } };
    },

    async waitForResult({ handle }, { timeoutMs }) {
      // Open the database fresh on each check: the server writes it, and a
      // long-lived handle can see stale state.
      const check = () => withDb((db) => {
        const turn = readTurn(db, handle.id);
        if (turn === null) return undefined;
        if (turn.pendingUserInput > 0 || turn.pendingApproval > 0) throw new SessionFailed('the session stopped to ask');
        if (turn.state === 'error') throw new SessionFailed(turn.lastError ?? 'turn error');
        if (turn.state === 'interrupted') throw new SessionFailed('turn interrupted');
        if (turn.state !== 'completed' || turn.assistantMessageId === null) return undefined;
        const message = readMessage(db, turn.assistantMessageId);
        if (message === null || message.isStreaming === 1) return undefined;
        return { text: message.text };
      });
      return pollUntil(check, { intervalMs: POLL_MS, timeoutMs, now: io.now, sleep: io.sleep });
    },

    // Archives the thread on ok. A failure throws, and the resolver reports it.
    async finish(handle: Handle, ok: boolean) {
      if (!ok) return;
      const { origin } = runningServer();
      await dispatch(io, { origin, token: await readToken(io) }, { type: 'thread.archive', commandId: randomUUID(), threadId: handle.id });
    },
  };
}
