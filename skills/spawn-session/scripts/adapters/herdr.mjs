// Inside herdr: each spawn is a new, unfocused tab in the current workspace,
// running the executor as a named herdr agent. Ported from the
// handoff-session skill's launch.sh.
//
// The tab's shell is started by the herdr server, not by this process, so it
// does not inherit this session's markers. herdr shell-quotes each argument
// after `--`, so the prompt stays literal.
import { HERDR_KIND, familiesFromExecutors } from '../lib/reviewer.mjs';
import { ReviewerFailed, SpawnError, TimeoutError } from '../lib/errors.mjs';

const modelArgs = (flag, model) => (model ? [flag, model] : []);

// The argv after `--` in `herdr agent start`.
export function agentArgs({ kind, family, model, effort, prompt, name }) {
  if (kind === 'handoff') return ['--remote-control', name, ...modelArgs('--model', model), prompt];
  if (family === 'gpt') return ['-s', 'read-only', ...modelArgs('-m', model), prompt];
  if (family === 'claude') return ['--permission-mode', 'plan', '--effort', effort, ...modelArgs('--model', model), prompt];
  return ['--mode', 'plan', '--effort', effort, ...modelArgs('--model', model), '-i', prompt];
}

// The error code in herdr's JSON output, or null.
function errorCode(stdout) {
  try {
    return JSON.parse(stdout).error?.code ?? null;
  } catch {
    return null;
  }
}

export function createAdapter(io) {
  const herdr = (args) => io.execFile('herdr', args, { env: io.env });

  return {
    name: 'herdr',
    detect: (env) => env.HERDR_ENV === '1' && io.commandExists('herdr'),
    availableFamilies: () => familiesFromExecutors(io.commandExists),

    async spawn(request) {
      const { name, cwd, family } = request;
      const created = await herdr(['tab', 'create', '--workspace', io.env.HERDR_WORKSPACE_ID, '--cwd', cwd, '--label', name, '--no-focus']);
      if (created.code !== 0) throw new SpawnError(`herdr tab create failed: ${created.stdout}${created.stderr}`);
      const { result } = JSON.parse(created.stdout);
      const pane = result.root_pane.pane_id;
      const tab = result.tab.tab_id;

      const started = await herdr(['agent', 'start', name, '--kind', HERDR_KIND[family], '--pane', pane, '--timeout', '60000', '--', ...agentArgs(request)]);
      if (started.code === 0) return { id: name, kind: 'agent', tab, pane, notReady: false };
      // The agent was started but waits on a dialog, usually workspace trust.
      // The session exists; the user must look at it.
      if (['agent_not_ready', 'timeout'].includes(errorCode(started.stdout))) return { id: name, kind: 'agent', tab, pane, notReady: true };
      await herdr(['tab', 'close', tab]);
      throw new SpawnError(`herdr agent start failed: ${started.stdout}${started.stderr}`);
    },

    async waitForResult(handle, { timeoutMs }) {
      const waited = await herdr(['agent', 'wait', handle.id, '--until', 'idle', '--until', 'done', '--until', 'blocked', '--timeout', String(timeoutMs)]);
      if (waited.code !== 0) throw new TimeoutError(`herdr agent wait failed: ${waited.stderr.trim()}`);
      if (waited.stdout.includes('blocked')) throw new ReviewerFailed('the reviewer is waiting for input');
      const read = await herdr(['agent', 'read', handle.id, '--source', 'recent-unwrapped', '--lines', '400', '--format', 'text']);
      return { text: read.stdout };
    },

    async finish(handle, ok) {
      if (!ok) return;
      try {
        await herdr(['tab', 'close', handle.tab]);
      } catch (error) {
        process.stderr.write(`spawn-session: could not close herdr tab ${handle.tab}: ${error.message}\n`);
      }
    },
  };
}
