// Inside herdr: each spawn is a new, unfocused tab in the current workspace,
// running the executor as a named herdr agent. Ported from the
// handoff-session skill's launch.sh.
//
// A critique starts the agent idle, then submits the prompt with
// `herdr agent prompt --wait`, which returns once the agent settles. Starting
// it with the prompt in argv would not work: `agent start` succeeds as soon
// as the agent is ready for input, so a wait right after it returns at once.
// A handoff keeps the prompt in argv, as launch.sh does, because nobody
// waits on it.
//
// herdr has no "final message" API. The result is the recent terminal
// output, which carries the prompt echo and some screen chrome. The reviewer
// skills check each finding against the repo anyway.
//
// The tab's shell is started by the herdr server, not by this process, so it
// does not inherit this session's markers. herdr shell-quotes each argument
// after `--`, so the prompt stays literal. herdr prints its errors as JSON
// on stderr with exit 1.
import { HERDR_KIND, familiesFromExecutors } from '../lib/reviewer.mjs';
import { ReviewerFailed, SpawnError, TimeoutError } from '../lib/errors.mjs';

const READ_LINES = '2000';

const modelArgs = (flag, model) => (model ? [flag, model] : []);

// The argv after `--` in `herdr agent start`.
export function agentArgs({ kind, family, model, effort, prompt, name }) {
  if (kind === 'handoff') return ['--remote-control', name, ...modelArgs('--model', model), prompt];
  if (family === 'gpt') return ['-s', 'read-only', ...modelArgs('-m', model)];
  if (family === 'claude') return ['--permission-mode', 'plan', '--effort', effort, ...modelArgs('--model', model)];
  return ['--mode', 'plan', '--effort', effort, ...modelArgs('--model', model)];
}

// The error code in a failed herdr command's JSON, or null.
function errorCode({ stdout, stderr }) {
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
function settledState(stdout) {
  return stdout.match(/"(?:state|status)"\s*:\s*"(idle|working|blocked|done|unknown)"/)?.[1] ?? null;
}

const output = ({ stdout, stderr }) => `${stdout}${stderr}`.trim();

export function createAdapter(io) {
  const herdr = (args) => io.execFile('herdr', args, { env: io.env });

  return {
    name: 'herdr',
    detect: (env) => env.HERDR_ENV === '1' && io.commandExists('herdr'),
    availableFamilies: () => familiesFromExecutors(io.commandExists),

    async spawn(request) {
      const { kind, name, cwd, family, prompt } = request;
      const workspace = io.env.HERDR_WORKSPACE_ID;
      if (!workspace) throw new SpawnError('HERDR_WORKSPACE_ID is not set; run from a herdr pane, or set LETS_SPEC_HARNESS to another harness');
      const created = await herdr(['tab', 'create', '--workspace', workspace, '--cwd', cwd, '--label', name, '--no-focus']);
      if (created.code !== 0) throw new SpawnError(`herdr tab create failed: ${output(created)}`);
      const { result } = JSON.parse(created.stdout);
      const pane = result.root_pane.pane_id;
      const tab = result.tab.tab_id;

      const started = await herdr(['agent', 'start', name, '--kind', HERDR_KIND[family], '--pane', pane, '--timeout', '60000', '--', ...agentArgs(request)]);
      const handle = { id: name, kind: 'agent', tab, pane, notReady: false, prompt: kind === 'critique' ? prompt : null };
      if (started.code === 0) return handle;
      // The agent was started but waits on a dialog, usually workspace trust.
      // The session exists; the user must look at it.
      if (['agent_not_ready', 'timeout'].includes(errorCode(started))) return { ...handle, notReady: true };
      await herdr(['tab', 'close', tab]);
      throw new SpawnError(`herdr agent start failed: ${output(started)}`);
    },

    async waitForResult(handle, { timeoutMs }) {
      const waited = await herdr(['agent', 'prompt', handle.id, handle.prompt, '--wait', '--timeout', String(timeoutMs)]);
      if (waited.code !== 0) {
        const code = errorCode(waited);
        if (code === 'timeout') throw new TimeoutError(`herdr agent prompt timed out: ${output(waited)}`);
        throw new ReviewerFailed(`herdr agent prompt failed (${code ?? 'no error code'}): ${output(waited)}`);
      }
      if (settledState(waited.stdout) === 'blocked') throw new ReviewerFailed('the reviewer is waiting for input');
      const read = await herdr(['agent', 'read', handle.id, '--source', 'recent-unwrapped', '--lines', READ_LINES, '--format', 'text']);
      return { text: read.stdout };
    },

    async finish(handle, ok) {
      if (!ok) return;
      try {
        await herdr(['tab', 'close', handle.tab]);
      } catch (error) {
        process.stderr.write(`lets-spawn: could not close herdr tab ${handle.tab}: ${error.message}\n`);
      }
    },
  };
}
