// In any terminal or harness: each review runs headless, as a child process
// of the family's CLI in its read-only mode. Revived from lets's old built-in
// default resolver, with the reviewer's model added.
//
// A handoff needs a session a person can work in, so start declines and the
// next resolver in the chain answers it.
//
// The child is started by this process, so it gets this process's
// environment without the session markers.
import { join } from 'node:path';
import type { Adapter, Session } from 'resolver-kit/adapter.ts';
import { scrubbedEnv } from 'resolver-kit/env.ts';
import { SessionFailed, SpawnError, TimeoutError } from 'resolver-kit/errors.ts';
import { familiesFromExecutors, HEADLESS_EXECUTOR, withEffort } from 'resolver-kit/families.ts';
import type { Io } from 'resolver-kit/io.ts';
import { FAMILIES } from 'resolver-kit/protocol.ts';
import type { Effort, Family } from 'resolver-kit/protocol.ts';
import { Declined } from 'resolver-kit/verbs.ts';

// Relative to the request's folder. codex writes its last message here.
const SCRATCH = '.workspace/lets-delegate';

const modelArgs = (flag: string, model: string | null) => (model ? [flag, model] : []);

type RunCommandInput = { family: Family; model: string | null; effort: Effort; prompt: string; lastMessagePath: string; timeoutMinutes: number };

// The command for a read-only run, what goes on its stdin, and where its
// final message comes from: stdout, or a file.
export function runCommand({ family, model, effort, prompt, lastMessagePath, timeoutMinutes }: RunCommandInput) {
  const cmd = HEADLESS_EXECUTOR[family];
  if (family === 'gpt') {
    return {
      cmd,
      args: ['exec', '-s', 'read-only', '-c', `model_reasoning_effort="${effort}"`, ...modelArgs('-m', model), '-o', lastMessagePath, '-'],
      input: prompt,
      readResultFrom: lastMessagePath,
    };
  }
  if (family === 'claude') {
    return { cmd, args: ['-p', '--permission-mode', 'plan', '--effort', effort, ...modelArgs('--model', model)], input: prompt, readResultFrom: 'stdout' };
  }
  return {
    cmd,
    args: ['--mode', 'plan', '--effort', effort, ...modelArgs('--model', model && withEffort(model, effort)),
      '--print-timeout', `${timeoutMinutes}m`, '-p', prompt],
    input: undefined,
    readResultFrom: 'stdout',
  };
}

// A run waiting to start: the handle names the session; the rest is what
// waitForResult needs to run the CLI.
type CliSession = Session & { cwd: string; name: string; prompt: string; family: Family; model: string | null; effort: Effort };

export function createAdapter(io: Io): Adapter {
  const lastMessagePath = (cwd: string, name: string) => join(cwd, SCRATCH, `${name}.last-message.md`);

  return {
    name: 'cli',
    program: 'lets-delegate-cli',
    harness: 'this resolver',
    handleKind: 'process',
    // Any terminal or harness will do, as long as one family's CLI is on PATH.
    detect: () => FAMILIES.some((family) => io.commandExists(HEADLESS_EXECUTOR[family])),
    whyDeclined: () => 'none of codex, claude or agy is on PATH',
    availableFamilies: () => familiesFromExecutors(io.commandExists),
    whyNot: (family) => `${HEADLESS_EXECUTOR[family]} is not on PATH`,

    // The CLI starts in waitForResult, which knows the timeout.
    async spawn({ kind, name, cwd, prompt, family, model, effort }): Promise<CliSession> {
      if (kind === 'start') throw new Declined('this resolver only runs headless');
      return { handle: { kind: 'process', id: name }, cwd, name, prompt, family, model, effort: effort! };
    },

    async waitForResult(session, { timeoutMs }) {
      const { cwd, name, prompt, family, model, effort } = session as CliSession;
      io.mkdirp(join(cwd, SCRATCH));
      const timeoutMinutes = Math.ceil(timeoutMs / 60000);
      const { cmd, args, input, readResultFrom } = runCommand({ family, model, effort, prompt, timeoutMinutes, lastMessagePath: lastMessagePath(cwd, name) });
      const result = await io.execFile(cmd, args, { cwd, env: scrubbedEnv(io.env), input, timeoutMs }).catch((error: Error) => {
        throw new SpawnError(error.message);
      });
      if (result.timedOut) throw new TimeoutError(`${cmd} did not finish in ${timeoutMinutes} minutes`);
      if (result.code !== 0) throw new SessionFailed(`${cmd} failed: exit ${result.code}: ${result.stderr.slice(-500)}`);
      // The kit turns an empty message, or a missing file, into a failed session.
      if (readResultFrom === 'stdout') return { text: result.stdout };
      return { text: io.exists(readResultFrom) ? io.readFile(readResultFrom) : '' };
    },

    async finish() {},
  };
}
