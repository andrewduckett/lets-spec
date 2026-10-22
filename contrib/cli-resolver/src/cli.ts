// Inside herdr: each session is a new, unfocused tab in the current
// workspace, running the executor as a named herdr agent. Ported from the
// handoff-session skill's launch.sh.
//
// A run starts the agent idle, then submits the prompt with
// `herdr agent prompt --wait`, which returns once the agent settles. Starting
// it with the prompt in argv would not work: `agent start` succeeds as soon
// as the agent is ready for input, so a wait right after it returns at once.
// A start keeps the prompt in argv, as launch.sh does, because nobody waits
// on it.
//
// herdr has no "final message" API. The result is the recent terminal
// output, which carries the prompt echo and some screen chrome. The review
// skills check each finding against the repo anyway.
//
// The tab's shell is started by the herdr server, not by this process, so it
// does not inherit this session's markers. herdr shell-quotes each argument
// after `--`, so the prompt stays literal. herdr prints its errors as JSON
// on stderr with exit 1.
import type { Adapter, Session, SpawnRequest } from 'resolver-kit/adapter.ts';
import { scrubbedEnv } from 'resolver-kit/env.ts';
import { SessionFailed, SpawnError, TimeoutError } from 'resolver-kit/errors.ts';
import { familiesFromExecutors, HEADLESS_EXECUTOR, withEffort } from 'resolver-kit/families.ts';
import type { ExecResult, Io } from 'resolver-kit/io.ts';
import { FAMILIES } from 'resolver-kit/protocol.ts';
import type { Family } from 'resolver-kit/protocol.ts';

const READ_LINES = '2000';

// The agent kind herdr knows each family by.
export const HERDR_KIND: Record<Family, string> = { gpt: 'codex', claude: 'claude', gemini: 'agy' };

const modelArgs = (flag: string, model: string | null) => (model ? [flag, model] : []);

// The argv after `--` in `herdr agent start`.
export function agentArgs({ kind, family, model, effort, prompt, name }: Omit<SpawnRequest, 'cwd' | 'readOnly'>): string[] {
  if (kind === 'start') return ['--remote-control', name, ...modelArgs('--model', model), prompt];
  if (family === 'gpt') return ['-s', 'read-only', ...modelArgs('-m', model)];
  if (family === 'claude') return ['--permission-mode', 'plan', '--effort', effort!, ...modelArgs('--model', model)];
  return ['--mode', 'plan', '--effort', effort!, ...modelArgs('--model', model && withEffort(model, effort!))];
}

// The error code in a failed herdr command's JSON, or null.
function errorCode({ stdout, stderr }: ExecResult): string | null {
  for (const text of [stderr, stdout]) {
    try {
      const code = JSON.parse(text).error?.code;
      if (code) return code;
    } catch {
      // Not JSON; try the other stream.
    }
  }
  return null;
}

// The agent state a settled wait reports, or null.
function settledState(stdout: string): string | null {
  return stdout.match(/"(?:state|status)"\s*:\s*"(idle|working|blocked|done|unknown)"/)?.[1] ?? null;
}

const output = ({ stdout, stderr }: ExecResult) => `${stdout}${stderr}`.trim();

// A herdr session: the tab is the handle; the agent's name and the prompt
// a run submits stay in this process.
type HerdrSession = Session & { agent: string; prompt: string | null; notReady: boolean };

export function createAdapter(io: Io): Adapter {
  const herdr = (args: string[]) => io.execFile('herdr', args, { env: scrubbedEnv(io.env) });

  return {
    name: 'cli',
    program: 'lets-delegate-cli',
    harness: 'this resolver',
    handleKind: 'tab',
    // Any terminal or harness will do, as long as one family's CLI is on PATH.
    detect: () => FAMILIES.some((family) => io.commandExists(HEADLESS_EXECUTOR[family])),
    whyDeclined: () => 'none of codex, claude or agy is on PATH',
    availableFamilies: () => familiesFromExecutors(io.commandExists),
    whyNot: (family) => `${HEADLESS_EXECUTOR[family]} is not on PATH`,

    async spawn(request): Promise<HerdrSession> {
      const { kind, name, cwd, family, prompt } = request;
      const workspace = io.env.HERDR_WORKSPACE_ID;
      if (!workspace) throw new SpawnError('HERDR_WORKSPACE_ID is not set; run from a herdr pane');
      const created = await herdr(['tab', 'create', '--workspace', workspace, '--cwd', cwd, '--label', name, '--no-focus']);
      if (created.code !== 0) throw new SpawnError(`herdr tab create failed: ${output(created)}`);
      const { result } = JSON.parse(created.stdout);
      const pane = result.root_pane.pane_id;
      const tab = result.tab.tab_id;

      const started = await herdr(['agent', 'start', name, '--kind', HERDR_KIND[family], '--pane', pane, '--timeout', '60000', '--', ...agentArgs(request)]);
      const session: HerdrSession = { handle: { kind: 'tab', id: tab, agent: name }, agent: name, prompt: kind === 'run' ? prompt : null, notReady: false };
      if (started.code === 0) return session;
      // The agent was started but waits on a dialog, usually workspace trust.
      // The session exists; the user must look at it.
      if (['agent_not_ready', 'timeout'].includes(errorCode(started) ?? '')) return { ...session, notReady: true };
      await herdr(['tab', 'close', tab]);
      throw new SpawnError(`herdr agent start failed: ${output(started)}`);
    },

    async waitForResult(session, { timeoutMs }) {
      const { agent, prompt } = session as HerdrSession;
      const waited = await herdr(['agent', 'prompt', agent, prompt!, '--wait', '--timeout', String(timeoutMs)]);
      if (waited.code !== 0) {
        const code = errorCode(waited);
        if (code === 'timeout') throw new TimeoutError(`herdr agent prompt timed out: ${output(waited)}`);
        throw new SessionFailed(`herdr agent prompt failed (${code ?? 'no error code'}): ${output(waited)}`);
      }
      if (settledState(waited.stdout) === 'blocked') throw new SessionFailed('the session is waiting for input');
      const read = await herdr(['agent', 'read', agent, '--source', 'recent-unwrapped', '--lines', READ_LINES, '--format', 'text']);
      return { text: read.stdout };
    },

    // Closes the tab on ok. A failure throws, and the resolver reports it.
    async finish(handle, ok) {
      if (!ok) return;
      const closed = await herdr(['tab', 'close', handle.id]);
      if (closed.code !== 0) throw new SpawnError(`herdr tab close failed: ${output(closed)}`);
    },
  };
}
