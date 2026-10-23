// Inside T3 Code: each session is a new thread in the sidebar. The thread is
// created the way the desktop UI does it, with one `orchestration.launchThread`
// request over the server's WebSocket RPC, which makes the thread and sends
// the first message. The result is read back from t3's state database.
//
// This speaks orchestration protocol 2, read on 2026-10-17 from the t3code
// 0.1.0 server bundle (apps/server/dist/binCli-*.mjs) and its web client.
// Protocol types live in packages/contracts/src/orchestrationV2.ts of
// https://github.com/pingdotgg/t3code. A t3 update can change any of this;
// run the smoke test in the README after each one.
//
// What is private here, and why it stays:
// - The WebSocket RPC and the `launchThread` and `thread.archive` calls are
//   the UI's own, so they move only when the UI does.
// - t3's CLI has no thread commands. Its MCP tools reach only the agent
//   process t3 started, not a child like this one. The `acp-mcp-call`
//   terminal fallback exists only where t3 sets `T3_ACP_MCP_NODE`, which it
//   does for ACP agents and not for Claude Code.
// - The state database (userdata/statev2.sqlite) is the only place to read a
//   finished run without holding a subscription open.
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { Refused, SessionFailed, SpawnError } from 'resolver-kit/errors.ts';
import { withEffort, withoutEffort } from 'resolver-kit/families.ts';
import type { Adapter, Session, SpawnRequest } from 'resolver-kit/adapter.ts';
import type { Db, Io } from 'resolver-kit/io.ts';
import { FAMILIES } from 'resolver-kit/protocol.ts';
import type { Effort, Family, Handle, ModelString } from 'resolver-kit/protocol.ts';
import { pollUntil } from 'resolver-kit/wait.ts';

// Where the token lives under the config folder, beside lets's config.yaml.
export const TOKEN_FILE = 'lets-delegate/t3-token';

// The protocol this adapter speaks. t3 refuses a WebSocket that names another.
export const ORCHESTRATION_PROTOCOL = 2;

const POLL_MS = 5000;
const REPLY_TIMEOUT_MS = 120_000;

// The t3 provider instance for each family.
export const T3_INSTANCE: Record<Family, string> = { gpt: 'codex', claude: 'claudeAgent', gemini: 'antigravity' };
// Each t3 provider names its effort option differently. Gemini carries the
// effort in the model id instead.
const T3_EFFORT_OPTION: Record<Family, string | null> = { gpt: 'reasoningEffort', claude: 'effort', gemini: null };
// A start has no effort, and a gemini model needs one.
const START_EFFORT: Effort = 'medium';

export type ModelSelection = { instanceId: string; model: string | null; options: { id: string; value: string }[] };
type Manifest = {
  manifest: {
    currentModels: Record<string, string[] | undefined>;
    providers?: Record<string, { defaults?: { chat?: string } | null } | undefined>;
  };
};
type Project = { project_id: string; title: string; workspace_root: string };

// The models t3 can run, as <family>/<model>: each provider in the
// manifest's order, its default chat model first. t3 lists gemini once per
// effort, as gemini-<version>-<effort>, so the effort goes and each gemini
// model appears once. A provider instance lets has no family for is left out.
export function optionsFromT3Manifest(manifest: Manifest): ModelString[] {
  const familyOf = (instance: string) => FAMILIES.find((family) => T3_INSTANCE[family] === instance);
  const options = new Set<ModelString>();
  for (const [instance, models] of Object.entries(manifest.manifest.currentModels)) {
    const family = familyOf(instance);
    if (family === undefined) continue;
    const chat = manifest.manifest.providers?.[instance]?.defaults?.chat;
    for (const model of [...(chat ? [chat] : []), ...(models ?? [])]) {
      options.add(`${family}/${family === 'gemini' ? withoutEffort(model) : model}`);
    }
  }
  return [...options];
}

// The provider's default chat model in the manifest, or null when it has none.
// gemini's default names an effort. A run drops it, so the review's own
// effort is added in its place; a start keeps it.
export function defaultModel(manifest: Manifest, family: Family, { keepEffort = false } = {}): string | null {
  const model = manifest.manifest.providers?.[T3_INSTANCE[family]]?.defaults?.chat ?? null;
  return family === 'gemini' && model !== null && !keepEffort ? withoutEffort(model) : model;
}

// A gemini model takes the effort as a suffix, unless it already has one.
// A null effort is a start's: no effort option, and medium for gemini.
export function t3ModelSelection({ family, model, effort }: { family: Family; model: string | null; effort: Effort | null }): ModelSelection {
  const option = T3_EFFORT_OPTION[family];
  const id = family === 'gemini' && model !== null ? withEffort(model, effort ?? START_EFFORT) : model;
  return { instanceId: T3_INSTANCE[family], model: id, options: option && effort !== null ? [{ id: option, value: effort }] : [] };
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
    'select project_id, title, workspace_root from projection_projects where deleted_at is null',
  ).all() as Project[];
  const project = projects.find((p) => p.workspace_root === repoRoot);
  if (!project) {
    throw new Refused(`t3 has no project for ${repoRoot}; run: t3 project add ${repoRoot}; known: ${projects.map((p) => p.title).join(', ')}`);
  }
  return { ...project };
}

type LaunchInput = {
  threadId: string; projectId: string; title: string; text: string; modelSelection: ModelSelection;
  interactionMode: 'plan' | 'default'; branch: string | null; messageId?: string; commandId?: string;
};

// The `orchestration.launchThread` request, as the UI sends it for a new
// thread: the thread's settings, a root workspace on the current branch, and
// the first message. The title is a seed; t3 generates a durable one from
// the message. messageId and commandId are random unless given, so tests
// can fix them.
export function buildLaunch({
  threadId, projectId, title, text, modelSelection, interactionMode, branch, messageId = randomUUID(), commandId = randomUUID(),
}: LaunchInput) {
  return {
    commandId,
    creationSource: 'web',
    threadId,
    projectId,
    title,
    generateTitle: true,
    modelSelection,
    runtimeMode: 'full-access',
    interactionMode,
    workspaceStrategy: { type: 'root', ...(branch === null ? {} : { branch }) },
    initialMessage: { messageId, text, attachments: [] },
  };
}

// A run is one user message and the work it starts. These are t3's statuses.
export type Run = { id: string; status: string; pendingRequests: number; failure: string | null };

// The thread's newest run, with whether it has stopped to ask and, when it
// failed, why.
export function readRun(db: Db, threadId: string): Run | null {
  const run = db.prepare(`
    select run_id, status from orchestration_v2_projection_runs
    where thread_id = ? order by ordinal desc limit 1`).get(threadId) as { run_id: string; status: string } | undefined;
  if (!run) return null;
  const { pending } = db.prepare(`
    select count(*) as pending from orchestration_v2_projection_runtime_requests
    where thread_id = ? and status = 'pending'`).get(threadId) as { pending: number };
  // A failed run leaves an error item; its failure says what went wrong.
  const error = db.prepare(`
    select payload_json from orchestration_v2_projection_turn_items
    where run_id = ? and type = 'error' and status = 'failed'
    order by updated_at desc, ordinal desc limit 1`).get(run.run_id) as { payload_json: string } | undefined;
  let failure: string | null = null;
  if (error) {
    try {
      const { message } = (JSON.parse(error.payload_json) as { failure?: { message?: unknown } }).failure ?? {};
      failure = typeof message === 'string' ? message : null;
    } catch {
      failure = null;
    }
  }
  return { id: run.run_id, status: run.status, pendingRequests: pending, failure };
}

// The run's newest assistant message, or null when it has none yet.
export function readFinalMessage(db: Db, runId: string): { text: string; streaming: boolean } | null {
  const row = db.prepare(`
    select payload_json, streaming from orchestration_v2_projection_messages
    where run_id = ? and role = 'assistant'
    order by created_at desc, rowid desc limit 1`).get(runId) as { payload_json: string; streaming: number } | undefined;
  if (!row) return null;
  const { text } = JSON.parse(row.payload_json) as { text?: unknown };
  return { text: typeof text === 'string' ? text : '', streaming: row.streaming === 1 };
}

// $XDG_CONFIG_HOME/lets-delegate/t3-token, or ~/.config/... when it is unset
// or empty: the rule configPath in lets/src/delegate/config.ts follows.
const tokenPath = (io: Io) => `${io.env.XDG_CONFIG_HOME || `${io.homedir()}/.config`}/${TOKEN_FILE}`;

// Issue a token with the server's own CLI, so it lands in the same auth store.
async function issueToken(io: Io): Promise<string> {
  const args = ['auth', 'session', 'issue', '--base-dir', baseDir(io.env, io.homedir()), '--ttl', '30d', '--label', 'lets-delegate', '--token-only'];
  const { stdout, stderr, code } = await io.execFile('t3', args, { env: io.env });
  const token = stdout.trim();
  if (code !== 0 || !/^\S+$/.test(token)) throw new Refused(`could not issue a t3 token (exit ${code}): ${stderr.trim()}`);
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
    throw new Refused(`t3 at ${origin} is unreachable (${cause?.code ?? message})`);
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

type Server = { origin: string; token: string };
type Rpc = { tag: string; payload: Record<string, unknown>; threadId: string | undefined };

// One request over the WebSocket RPC, as the UI makes it: a ticket for the
// token, then one Request frame, then its Exit. The result is the Exit's
// value.
async function request(io: Io, { origin, token }: Server, { tag, payload, threadId }: Rpc): Promise<unknown> {
  let response = await requestTicket(io, origin, token);
  if (rejected(response)) {
    response = await requestTicket(io, origin, await issueToken(io));
    if (rejected(response)) throw new Refused('t3 rejected the token twice');
  }
  if (!response.ok) throw new Refused(`t3 ticket request failed with HTTP ${response.status}: ${await response.text()}`);
  const { ticket } = await response.json() as { ticket: string };

  const url = new URL('/ws', origin.replace(/^http/, 'ws'));
  url.searchParams.set('wsTicket', ticket);
  url.searchParams.set('orchestrationProtocol', String(ORCHESTRATION_PROTOCOL));
  const ws = new io.WebSocket(url);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const exit = await new Promise<NonNullable<Frame['exit']>>((resolveExit, reject) => {
      // A timeout means "unknown", not "failed": the server may still act on it.
      timer = setTimeout(() => reject(new SpawnError(`no reply from t3 after ${REPLY_TIMEOUT_MS / 1000} s; check ${threadId} before running again`)), REPLY_TIMEOUT_MS);
      let opened = false;
      let refused = false;
      // Before the socket opens, an error or a close means t3 refused the
      // upgrade, and the WebSocket API hides why. Ask t3 itself, once. After
      // it opens, t3 may have acted on the request, so the outcome is unknown.
      const fail = (reason: string) => {
        if (opened) return reject(new SpawnError(reason));
        if (refused) return;
        refused = true;
        refusal(io, origin).then((why) => reject(new Refused(why)));
      };
      ws.addEventListener('open', () => {
        opened = true;
        ws.send(JSON.stringify({ _tag: 'Request', id: '1', tag, payload, headers: [] }));
      });
      ws.addEventListener('message', (event) => {
        for (const message of [JSON.parse(event.data as string) as Frame | Frame[]].flat()) {
          if (message._tag === 'Exit' && String(message.requestId) === '1') resolveExit(message.exit!);
          else if (message._tag === 'Defect' || message._tag === 'ClientProtocolError') reject(new Refused(`t3 rejected the request: ${JSON.stringify(message)}`));
        }
      });
      ws.addEventListener('error', (event) => fail(`t3 websocket error: ${(event as Event & { message?: string }).message || event.type}`));
      ws.addEventListener('close', (event) => fail(`t3 websocket closed: ${event.code} ${event.reason}`));
    });
    if (exit._tag !== 'Success') throw new Refused(`t3 ${tag} failed: ${JSON.stringify(exit)}`);
    return exit.value;
  } finally {
    clearTimeout(timer);
    ws.close();
  }
}

// Send one orchestration command, such as `thread.archive`.
export function dispatch(io: Io, server: Server, command: { threadId?: string; [field: string]: unknown }): Promise<unknown> {
  return request(io, server, { tag: 'orchestration.dispatchCommand', payload: command, threadId: command.threadId });
}

// Create a thread and send its first message. The answer names the thread.
export async function launch(io: Io, server: Server, input: ReturnType<typeof buildLaunch>): Promise<{ threadId: string }> {
  const result = await request(io, server, { tag: 'orchestration.launchThread', payload: input, threadId: input.threadId }) as { threadId?: unknown } | null;
  return { threadId: typeof result?.threadId === 'string' ? result.threadId : input.threadId };
}

export function createAdapter(io: Io): Adapter {
  const databasePath = () => `${userdata(io)}/statev2.sqlite`;
  const manifestPath = () => `${userdata(io)}/model-manifest.json`;
  const readManifest = (): Manifest | null => (io.exists(manifestPath()) ? JSON.parse(io.readFile(manifestPath())) : null);

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
    if (code !== 0) throw new Refused(`git ${args.join(' ')} failed in ${cwd}: ${stderr.trim()}`);
    return stdout.trim();
  }

  // The running server. finish sends the token only here, never to an
  // origin a handle names.
  function runningServer() {
    const runtime = readRuntime(io);
    if (runtime === null) throw new Refused(`t3 is not running (no ${userdata(io)}/server-runtime.json)`);
    return runtime;
  }

  return {
    name: 't3',
    program: 'lets-delegate-t3',
    harness: 'T3 Code',
    handleKind: 'thread',

    detect() {
      const runtime = readRuntime(io);
      return runtime !== null && io.processAlive(runtime.pid) && isAncestor(io, runtime.pid);
    },

    async options(warn) {
      const manifest = readManifest();
      if (manifest === null) {
        warn(`T3 has no model manifest at ${manifestPath()}, so it lists no models`);
        return [];
      }
      return optionsFromT3Manifest(manifest);
    },

    async spawn({ kind, name, prompt, cwd, family, model, effort, readOnly }: SpawnRequest): Promise<Session> {
      const { origin } = runningServer();
      // The main checkout, even when cwd is a linked worktree.
      const repoRoot = resolve(await git(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir']), '..');
      const project = withDb((db) => findProject(db, repoRoot));
      const branch = (await git(cwd, ['branch', '--show-current'])) || null;
      // A null model is the provider's default; with none, t3 picks its own.
      const manifest = model === null ? readManifest() : null;
      const chosen = model ?? (manifest === null ? null : defaultModel(manifest, family, { keepEffort: kind === 'start' }));
      const modelSelection = t3ModelSelection({ family, model: chosen, effort });
      const token = await readToken(io);
      const { threadId } = await launch(io, { origin, token }, buildLaunch({
        threadId: randomUUID(),
        projectId: project.project_id,
        title: name,
        text: prompt,
        modelSelection,
        interactionMode: readOnly ? 'plan' : 'default',
        branch,
      }));
      // origin is for people to read: finish sends the token only to the
      // running server, never to the origin a handle names.
      return { handle: { kind: 'thread', id: threadId, origin } };
    },

    async waitForResult({ handle }, { timeoutMs }) {
      // Open the database fresh on each check: the server writes it, and a
      // long-lived handle can see stale state.
      const check = () => withDb((db) => {
        const run = readRun(db, handle.id);
        if (run === null) return undefined;
        if (run.pendingRequests > 0 || run.status === 'waiting') throw new SessionFailed('the session stopped to ask');
        // A run that failed before any message is a refusal, such as a model
        // the account cannot run. The kit then archives the thread.
        if (run.status === 'failed') {
          const failure = run.failure ?? 'run failed';
          throw readFinalMessage(db, run.id) === null ? new Refused(failure) : new SessionFailed(failure);
        }
        if (run.status === 'interrupted' || run.status === 'cancelled' || run.status === 'rolled_back') throw new SessionFailed(`run ${run.status.replace('_', ' ')}`);
        if (run.status !== 'completed') return undefined;
        // A completed run with no message yet is one with none at all; the
        // resolver rejects the empty text. One still streaming will finish.
        const message = readFinalMessage(db, run.id);
        if (message === null) return { text: '' };
        if (message.streaming) return undefined;
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
