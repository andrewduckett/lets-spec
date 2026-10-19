// The built-in default resolver: run a family's CLI headless and read-only.
// It is the last candidate in the lookup, so it never declines. It never
// starts an interactive session; start answers with the command to run.
import { join } from 'node:path';
import type { Child, Io } from '../io.ts';
import { scrubbedEnv } from './env.ts';
import type { Env } from './env.ts';
import { exitCodeOf, NoFamilyError } from './errors.ts';
import { familiesFromExecutors, HEADLESS_EXECUTOR, pickFamily } from './families.ts';
import type { Effort, Family, Requests, Responses, RunRequest, StartRequest, Verb } from './protocol.ts';
import { withTimeout } from './wait.ts';

const RESOLVER = 'default';
// Relative to the repo root. The instructions name it this way.
const SCRATCH = '.workspace/lets-delegate';

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

  // The prompt travels on stdin or in argv. This copy is for a person to
  // read after a failure, or to paste for start; finish removes it.
  function writePrompt(cwd: string, name: string, prompt: string) {
    io.mkdirp(join(cwd, SCRATCH));
    io.writeFile(promptPath(cwd, name), prompt);
  }

  // The default starts no review session. Exit 3 sends the review skills
  // to their subagent step.
  function run(): never {
    throw new NoFamilyError('no resolver started a session here, so no fresh session can run. Run the review in a subagent.');
  }

  // The default starts no session either. It hands the prompt back for the
  // user to give to any agent, and names none.
  function start({ cwd, name, prompt }: StartRequest): Responses['start'] {
    writePrompt(cwd, name, prompt);
    const instructions = `Start any agent in ${cwd} and give it this prompt, which is also saved in ${promptFile(name)}:\n\n${prompt}`;
    return { resolver: RESOLVER, handle: null, instructions };
  }

  // The default issues no handle, so it has nothing to finish. The protocol
  // still asks every resolver to answer the verb.
  function finish(): Responses['finish'] | null {
    return null;
  }

  async function answer(verb: Verb, request: Requests[Verb]) {
    if (verb === 'probe') return { resolver: RESOLVER };
    if (verb === 'run') return run();
    if (verb === 'start') return start(request as StartRequest);
    return finish();
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
