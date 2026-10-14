// Inside T3 Code: each spawn is a new thread in the sidebar. The thread is
// created the way the desktop UI does it, with one `thread.turn.start` that
// carries `bootstrap`, sent over the server's WebSocket RPC. The result is
// read back from t3's state database.
//
// Copied and trimmed on 2026-10-13 from t3-thread:
//   https://github.com/matheustimbo/t3code, branch fork-main,
//   .agents/skills/t3-thread/scripts/t3-thread.mjs
// Protocol types live in packages/contracts/src/orchestration.ts of
// https://github.com/pingdotgg/t3code. A t3 update can change any of this;
// run the smoke test in SKILL.md after each one.
//
// Kept: token issue and refresh, project lookup by cwd, model selection,
// dispatch over the WebSocket, archive.
// Dropped: the worktree (prepareWorktree, runSetupScript), --local-base,
// --dry-run, --stop, -p/--project, -b, -t, --instance, --selection, and the
// message from stdin. The sqlite3 binary is replaced by node:sqlite.
// Upstream's serverCli() finds the server's own executable, with a fallback
// for the macOS app bundle. That is dropped: on this project `t3` is on PATH.
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { T3_INSTANCE, familiesFromT3Manifest, t3ModelSelection } from '../lib/reviewer.mjs';
import { pollUntil } from '../lib/wait.mjs';
import { ReviewerFailed, SpawnError } from '../lib/errors.mjs';

export const TOKEN_FILE_SUFFIX = '.config/lets-spawn/t3-token';

const POLL_MS = 5000;
const REPLY_TIMEOUT_MS = 120_000;

export function baseDir(env, homedir) {
  return env.T3CODE_HOME ?? `${homedir}/.t3`;
}

const userdata = (io) => `${baseDir(io.env, io.homedir())}/userdata`;

// The running server's origin and pid, or null when there is no runtime file.
export function readRuntime(io) {
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
export function isAncestor(io, ancestorPid) {
  let pid = io.pid;
  // The bound guards against a cycle in a bad parent map.
  for (let hops = 0; pid !== null && pid > 0 && hops < 4096; hops++) {
    if (pid === ancestorPid) return true;
    pid = io.parentPid(pid);
  }
  return false;
}

export function findProject(db, repoRoot) {
  const projects = db.prepare(
    'select project_id, title, workspace_root, default_model_selection_json from projection_projects where deleted_at is null',
  ).all();
  const project = projects.find((p) => p.workspace_root === repoRoot);
  if (!project) {
    throw new SpawnError(`t3 has no project for ${repoRoot}; run: t3 project add ${repoRoot}; known: ${projects.map((p) => p.title).join(', ')}`);
  }
  return { ...project };
}

// messageId and commandId are random unless given, so tests can fix them.
export function buildTurnStart({ threadId, projectId, title, text, modelSelection, interactionMode, branch, now, messageId = randomUUID(), commandId = randomUUID() }) {
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

// The thread's newest turn, with what the thread and its session say.
export function readTurn(db, threadId) {
  const row = db.prepare(`
    select t.state, t.assistant_message_id, th.pending_user_input_count, th.pending_approval_count, s.last_error
    from projection_turns t
    left join projection_threads th on th.thread_id = t.thread_id
    left join projection_thread_sessions s on s.thread_id = t.thread_id
    where t.thread_id = ?
    order by t.row_id desc
    limit 1`).get(threadId);
  if (!row) return null;
  return {
    state: row.state,
    assistantMessageId: row.assistant_message_id,
    pendingUserInput: row.pending_user_input_count ?? 0,
    pendingApproval: row.pending_approval_count ?? 0,
    lastError: row.last_error,
  };
}

export function readMessage(db, messageId) {
  const row = db.prepare('select text, is_streaming from projection_thread_messages where message_id = ?').get(messageId);
  return row ? { text: row.text, isStreaming: row.is_streaming } : null;
}

const tokenPath = (io) => `${io.homedir()}/${TOKEN_FILE_SUFFIX}`;

// Issue a token with the server's own CLI, so it lands in the same auth store.
async function issueToken(io) {
  const args = ['auth', 'session', 'issue', '--base-dir', baseDir(io.env, io.homedir()), '--ttl', '30d', '--label', 'lets-spawn', '--token-only'];
  const { stdout, stderr, code } = await io.execFile('t3', args, { env: io.env });
  const token = stdout.trim();
  if (code !== 0 || !/^\S+$/.test(token)) throw new SpawnError(`could not issue a t3 token (exit ${code}): ${stderr.trim()}`);
  const path = tokenPath(io);
  io.mkdirp(dirname(path), { mode: 0o700 });
  io.writeFile(path, token, { mode: 0o600 });
  return token;
}

// The stored token, or a fresh one when none is stored.
export async function readToken(io) {
  const path = tokenPath(io);
  return io.exists(path) ? io.readFile(path).trim() : issueToken(io);
}

async function requestTicket(io, origin, token) {
  try {
    return await io.fetch(`${origin}/api/auth/websocket-ticket`, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
  } catch (error) {
    throw new SpawnError(`t3 at ${origin} is unreachable (${error.cause?.code ?? error.message})`);
  }
}

const rejected = (response) => response.status === 401 || response.status === 403;

// The HTTP dispatch endpoint ignores `bootstrap`; only the WebSocket RPC
// creates the thread, so go through /ws like the UI does.
export async function dispatch(io, { origin, token }, command) {
  let response = await requestTicket(io, origin, token);
  if (rejected(response)) {
    response = await requestTicket(io, origin, await issueToken(io));
    if (rejected(response)) throw new SpawnError('t3 rejected the token twice');
  }
  if (!response.ok) throw new SpawnError(`t3 ticket request failed with HTTP ${response.status}: ${await response.text()}`);
  const { ticket } = await response.json();

  const url = new URL('/ws', origin.replace(/^http/, 'ws'));
  url.searchParams.set('wsTicket', ticket);
  const ws = new io.WebSocket(url);
  let timer;
  try {
    const exit = await new Promise((resolveExit, reject) => {
      // A timeout means "unknown", not "failed": the server may still act on it.
      timer = setTimeout(() => reject(new SpawnError(`no reply from t3 after ${REPLY_TIMEOUT_MS / 1000} s; check ${command.threadId} before running again`)), REPLY_TIMEOUT_MS);
      ws.addEventListener('open', () => ws.send(JSON.stringify({ _tag: 'Request', id: '1', tag: 'orchestration.dispatchCommand', payload: command, headers: [] })));
      ws.addEventListener('message', (event) => {
        for (const message of [JSON.parse(event.data)].flat()) {
          if (message._tag === 'Exit' && String(message.requestId) === '1') resolveExit(message.exit);
          else if (message._tag === 'Defect' || message._tag === 'ClientProtocolError') reject(new SpawnError(`t3 rejected the request: ${JSON.stringify(message)}`));
        }
      });
      ws.addEventListener('error', (event) => reject(new SpawnError(`t3 websocket error: ${event.message ?? event.type}`)));
      ws.addEventListener('close', (event) => reject(new SpawnError(`t3 websocket closed: ${event.code} ${event.reason}`)));
    });
    if (exit._tag !== 'Success') throw new SpawnError(`t3 dispatch failed: ${JSON.stringify(exit)}`);
    return exit.value;
  } finally {
    clearTimeout(timer);
    ws.close();
  }
}

export function createAdapter(io) {
  const databasePath = () => `${userdata(io)}/state.sqlite`;

  // Open the database, run read(db), and close it again.
  function withDb(read) {
    const db = io.openDb(databasePath());
    try {
      return read(db);
    } finally {
      db.close();
    }
  }

  async function git(cwd, args) {
    const { stdout, stderr, code } = await io.execFile('git', ['-C', cwd, ...args], { cwd });
    if (code !== 0) throw new SpawnError(`git ${args.join(' ')} failed in ${cwd}: ${stderr.trim()}`);
    return stdout.trim();
  }

  function handoffSelection(model, project) {
    if (model) return { instanceId: T3_INSTANCE.claude, model, options: [] };
    if (project.default_model_selection_json) return JSON.parse(project.default_model_selection_json);
    return { instanceId: T3_INSTANCE.claude, model: 'claude-opus-5-5', options: [] };
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

    async spawn({ kind, name, prompt, cwd, family, model, effort, readOnly }) {
      const runtime = readRuntime(io);
      if (runtime === null) throw new SpawnError(`t3 is not running (no ${userdata(io)}/server-runtime.json)`);
      // The main checkout, even when cwd is a linked worktree.
      const repoRoot = resolve(await git(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir']), '..');
      const project = withDb((db) => findProject(db, repoRoot));
      const branch = (await git(cwd, ['branch', '--show-current'])) || null;
      const modelSelection = kind === 'critique' ? t3ModelSelection({ family, model, effort }) : handoffSelection(model, project);
      const threadId = randomUUID();
      const token = await readToken(io);
      await dispatch(io, { origin: runtime.origin, token }, buildTurnStart({
        threadId,
        projectId: project.project_id,
        title: name,
        text: prompt,
        modelSelection,
        interactionMode: readOnly ? 'plan' : 'default',
        branch,
        now: new Date(io.now()).toISOString(),
      }));
      return { id: threadId, kind: 'thread', origin: runtime.origin, token };
    },

    async waitForResult(handle, { timeoutMs }) {
      // Open the database fresh on each check: the server writes it, and a
      // long-lived handle can see stale state.
      const check = () => withDb((db) => {
        const turn = readTurn(db, handle.id);
        if (turn === null) return undefined;
        if (turn.pendingUserInput > 0 || turn.pendingApproval > 0) throw new ReviewerFailed('the reviewer stopped to ask');
        if (turn.state === 'error') throw new ReviewerFailed(turn.lastError ?? 'turn error');
        if (turn.state === 'interrupted') throw new ReviewerFailed('turn interrupted');
        if (turn.state !== 'completed' || turn.assistantMessageId === null) return undefined;
        const message = readMessage(db, turn.assistantMessageId);
        if (message === null || message.isStreaming === 1) return undefined;
        return { text: message.text };
      });
      return pollUntil(check, { intervalMs: POLL_MS, timeoutMs, now: io.now, sleep: io.sleep });
    },

    async finish(handle, ok) {
      if (!ok) return;
      try {
        await dispatch(io, handle, { type: 'thread.archive', commandId: randomUUID(), threadId: handle.id });
      } catch (error) {
        process.stderr.write(`lets-spawn: could not archive t3 thread ${handle.id}: ${error.message}\n`);
      }
    },
  };
}
