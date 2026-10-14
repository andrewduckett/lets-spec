// Outside any harness: run the executor as a plain process. A critique runs
// headless and read-only. An attended handoff opens a terminal window; an
// unattended one runs `claude -p` in the background.
import { HEADLESS_EXECUTOR, familiesFromExecutors } from '../lib/reviewer.mjs';
import { scrubbedEnv } from '../lib/env.mjs';
import { codeReviewMessage } from '../lib/messages.mjs';
import { ReviewerFailed, SpawnError, TimeoutError } from '../lib/errors.mjs';

const SCRATCH = '.workspace/lets-spawn';

const modelArgs = (flag, model) => (model ? [flag, model] : []);

// The command for a critique, and where its final message comes from.
export function critiqueCommand({ family, model, effort, prompt, lastMessagePath, codeReview, timeoutMinutes }) {
  const cmd = HEADLESS_EXECUTOR[family];
  if (family === 'gpt' && codeReview) {
    return { cmd, args: ['-s', 'read-only', 'review', '--base', codeReview.base], stdin: null, readResultFrom: 'stdout' };
  }
  if (family === 'gpt') {
    return {
      cmd,
      args: ['exec', '-s', 'read-only', '-c', `model_reasoning_effort="${effort}"`, ...modelArgs('-m', model), '-o', lastMessagePath, '-'],
      stdin: prompt,
      readResultFrom: lastMessagePath,
    };
  }
  if (family === 'claude' && codeReview) {
    return { cmd, args: ['-p', `/code-review ${effort} ${codeReview.base}...HEAD`, '--permission-mode', 'plan'], stdin: null, readResultFrom: 'stdout' };
  }
  if (family === 'claude') {
    return { cmd, args: ['-p', '--permission-mode', 'plan', '--effort', effort, ...modelArgs('--model', model)], stdin: prompt, readResultFrom: 'stdout' };
  }
  const text = codeReview ? codeReviewMessage({ family, base: codeReview.base, effort, harness: 'none' }) : prompt;
  return {
    cmd,
    args: ['--mode', 'plan', '--effort', effort, ...modelArgs('--model', model), '--print-timeout', `${timeoutMinutes}m`, '-p', text],
    stdin: null,
    readResultFrom: 'stdout',
  };
}

export function handoffCommand({ name, prompt, model, attended, cwd }) {
  if (attended) {
    return { cmd: 'gnome-terminal', args: ['--window', `--working-directory=${cwd}`, '--', 'claude', '--remote-control', name, ...modelArgs('--model', model), prompt] };
  }
  return { cmd: 'claude', args: ['-p', ...modelArgs('--model', model), prompt] };
}

export function createAdapter(io) {
  const scratch = (cwd) => `${cwd}/${SCRATCH}`;
  const promptPath = (cwd, name) => `${scratch(cwd)}/${name}.prompt.md`;
  const lastMessagePath = (cwd, name) => `${scratch(cwd)}/${name}.last-message.md`;

  async function spawnCritique(request) {
    const { name, prompt, cwd } = request;
    io.mkdirp(scratch(cwd));
    // The prompt travels on stdin or argv. This copy is for reading after a
    // failure; finish() removes it on success.
    io.writeFile(promptPath(cwd, name), prompt);
    const { cmd, args, stdin, readResultFrom } = critiqueCommand({ ...request, lastMessagePath: lastMessagePath(cwd, name) });
    let child = null;
    const promise = io.execFile(cmd, args, { cwd, env: scrubbedEnv(io.env), input: stdin, started: (c) => { child = c; } });
    return { id: child ? String(child.pid) : null, kind: 'process', promise, kill: () => child?.kill(), readResultFrom, name, cwd };
  }

  async function spawnHandoff(request) {
    const { name, cwd, attended } = request;
    const { cmd, args } = handoffCommand(request);
    const env = scrubbedEnv(io.env);
    if (attended) {
      if (!io.commandExists('gnome-terminal')) throw new SpawnError('gnome-terminal is not installed; set LETS_SPEC_HARNESS or install it');
      const { code, stderr } = await io.execFile(cmd, args, { cwd, env });
      if (code !== 0) throw new SpawnError(`gnome-terminal exited ${code}: ${stderr}`);
      return { id: null, kind: 'window' };
    }
    io.mkdirp(scratch(cwd));
    const { pid } = io.spawnDetached(cmd, args, { cwd, env, stdoutPath: `${scratch(cwd)}/${name}.log` });
    return { id: String(pid), kind: 'process' };
  }

  return {
    name: 'none',
    detect: () => true,
    availableFamilies: () => familiesFromExecutors(io.commandExists),
    spawn: (request) => (request.kind === 'critique' ? spawnCritique(request) : spawnHandoff(request)),

    async waitForResult(handle, { timeoutMs }) {
      const timedOut = Symbol('timed out');
      const result = await Promise.race([handle.promise, io.sleep(timeoutMs).then(() => timedOut)]);
      if (result === timedOut) {
        // Do not leave the reviewer running, and spending tokens, after we stop waiting.
        handle.kill();
        throw new TimeoutError(`no result after ${timeoutMs} ms`);
      }
      if (result.code !== 0) throw new ReviewerFailed(`exit ${result.code}: ${result.stderr.slice(-500)}`);
      return { text: handle.readResultFrom === 'stdout' ? result.stdout : io.readFile(handle.readResultFrom) };
    },

    async finish(handle, ok) {
      if (!ok || handle.kind !== 'process' || !handle.cwd) return;
      for (const path of [promptPath(handle.cwd, handle.name), lastMessagePath(handle.cwd, handle.name)]) {
        try {
          if (io.exists(path)) io.removeFile(path);
        } catch (error) {
          process.stderr.write(`lets-spawn: could not remove ${path}: ${error.message}\n`);
        }
      }
    },
  };
}
