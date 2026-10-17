// The built-in default resolver: run a family's CLI headless and read-only.
// It is the last candidate in the lookup, so it never declines. It never
// starts an interactive session; start answers with the command to run.
import { join } from 'node:path';
import type { Child, ExecResult, Io } from '../io.ts';
import { scrubbedEnv } from './env.ts';
import type { Env } from './env.ts';
import { exitCodeOf, SessionFailed, SpawnError, TimeoutError } from './errors.ts';
import { familiesFromExecutors, HEADLESS_EXECUTOR, pickFamily } from './families.ts';
import { normalizeName } from './protocol.ts';
import type { Effort, Family, Handle, Requests, Responses, RunRequest, StartRequest, Verb } from './protocol.ts';

const RESOLVER = 'default';
// Relative to the repo root. The instructions name it this way.
const SCRATCH = '.workspace/lets-delegate';
// The executors start offers, in order.
const INTERACTIVE_EXECUTORS = ['claude', 'codex', 'agy'];

// What a verb came to: the exit code a resolver process would give, the
// response it would print, if any, and what it would say on stderr.
export type Outcome<V extends Verb> = { code: number; response: Responses[V] | null; stderr: string };

export type DefaultResolver = {
  handle<V extends Verb>(verb: V, request: Requests[V]): Promise<Outcome<V>>;
};

type RunCommandInput = { family: Family; effort: Effort; prompt: string; lastMessagePath: string; timeoutMinutes: number };

// The command for a read-only run, what goes on its stdin, and where its
// final message comes from: stdout, or a file.
export function runCommand({ family, effort, prompt, lastMessagePath, timeoutMinutes }: RunCommandInput) {
  const cmd = HEADLESS_EXECUTOR[family];
  if (family === 'gpt') {
    return {
      cmd,
      args: ['exec', '-s', 'read-only', '-c', `model_reasoning_effort="${effort}"`, '-o', lastMessagePath, '-'],
      input: prompt,
      readResultFrom: lastMessagePath,
    };
  }
  if (family === 'claude') {
    return { cmd, args: ['-p', '--permission-mode', 'plan', '--effort', effort], input: prompt, readResultFrom: 'stdout' };
  }
  return {
    cmd,
    args: ['--mode', 'plan', '--effort', effort, '--print-timeout', `${timeoutMinutes}m`, '-p', prompt],
    input: undefined,
    readResultFrom: 'stdout',
  };
}

// env is the environment to run an executor in, before the session markers
// are taken out.
export function createDefaultResolver(io: Io, env: Env): DefaultResolver {
  const promptFile = (name: string) => `${SCRATCH}/${name}.prompt.md`;
  const promptPath = (cwd: string, name: string) => join(cwd, promptFile(name));
  const lastMessagePath = (cwd: string, name: string) => join(cwd, SCRATCH, `${name}.last-message.md`);

  // The prompt travels on stdin or in argv. This copy is for a person to
  // read after a failure, or to paste for start; finish removes it.
  function writePrompt(cwd: string, name: string, prompt: string) {
    io.mkdirp(join(cwd, SCRATCH));
    io.writeFile(promptPath(cwd, name), prompt);
  }

  async function run(request: RunRequest): Promise<Responses['run']> {
    const { cwd, name, prompt, sourceFamily, effort, timeoutMinutes } = request;
    const { family } = pickFamily({ sourceFamily, available: familiesFromExecutors(io.commandExists) });
    writePrompt(cwd, name, prompt);
    const { cmd, args, input, readResultFrom } = runCommand({ family, effort, prompt, timeoutMinutes, lastMessagePath: lastMessagePath(cwd, name) });

    const started: { child?: Child } = {};
    const finished = io.execFile(cmd, args, { cwd, env: scrubbedEnv(env), input, started: (child) => { started.child = child; } });
    const result = await withTimeout(finished, timeoutMinutes * 60000);
    if (result === null) {
      // Do not leave the session running, and spending tokens, after we stop waiting.
      started.child?.kill();
      throw new TimeoutError(`${cmd} did not finish in ${timeoutMinutes} minutes`);
    }
    if (result.code === null) throw new SpawnError(`cannot run ${cmd}: ${result.stderr}`);
    if (result.code !== 0) throw new SessionFailed(`${cmd} failed: exit ${result.code}: ${result.stderr.slice(-500)}`);

    const text = (readResultFrom === 'stdout' ? result.stdout : io.readFile(readResultFrom)) ?? '';
    if (text.trim() === '') throw new SessionFailed(`${cmd} gave an empty final message`);
    return { resolver: RESOLVER, text, family, handle: { kind: 'process', id: String(started.child?.pid ?? ''), name } };
  }

  // The finished result, or null when ms pass first.
  async function withTimeout(finished: Promise<ExecResult>, ms: number): Promise<ExecResult | null> {
    const cancel = new AbortController();
    try {
      return await Promise.race([finished, io.sleep(ms, cancel.signal).then(() => null, () => null)]);
    } finally {
      cancel.abort();
    }
  }

  function start({ cwd, name, prompt }: StartRequest): Responses['start'] {
    writePrompt(cwd, name, prompt);
    const executor = INTERACTIVE_EXECUTORS.find((cmd) => io.commandExists(cmd));
    const instructions = executor
      ? `Open a terminal in ${cwd} and run: ${executor} "$(cat ${promptFile(name)})"`
      : `Install claude, codex or agy, then open a terminal in ${cwd} and start it with the prompt in ${promptFile(name)}.`;
    return { resolver: RESOLVER, handle: null, instructions };
  }

  // A handle run issued: a process with a name that is safe in a path.
  const issued = (handle: Handle): handle is Handle & { name: string } =>
    handle.kind === 'process' && typeof handle.name === 'string' && handle.name !== '' && normalizeName(handle.name) === handle.name;

  // Removes the scratch files on ok. Answers nothing for a handle it never issued.
  function finish({ cwd, handle, ok }: Requests['finish']): Responses['finish'] | null {
    if (!issued(handle)) return null;
    if (ok) {
      for (const path of [promptPath(cwd, handle.name), lastMessagePath(cwd, handle.name)]) {
        if (io.exists(path)) io.remove(path);
      }
    }
    return {};
  }

  async function answer(verb: Verb, request: Requests[Verb]) {
    if (verb === 'probe') return { resolver: RESOLVER };
    if (verb === 'run') return run(request as RunRequest);
    if (verb === 'start') return start(request as StartRequest);
    return finish(request as Requests['finish']);
  }

  return {
    async handle<V extends Verb>(verb: V, request: Requests[V]): Promise<Outcome<V>> {
      try {
        return { code: 0, response: (await answer(verb, request)) as Responses[V] | null, stderr: '' };
      } catch (error) {
        const code = exitCodeOf(error);
        if (code === null) throw error;
        return { code, response: null, stderr: (error as Error).message };
      }
    },
  };
}
