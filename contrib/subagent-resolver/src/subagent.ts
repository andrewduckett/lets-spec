// lets-delegate-subagent, the default resolver. lets asks it last, so it
// never declines, and it starts no session: a review is exit 3, for the
// review skills' subagent step, and a handoff hands the prompt back.
import { join } from 'node:path';
import { Refused } from 'resolver-kit/errors.ts';
import { SCRATCH } from 'resolver-kit/io.ts';
import type { Io } from 'resolver-kit/io.ts';
import type { Request, Response, StartRequest, Verb } from 'resolver-kit/protocol.ts';
import type { AnswerFn } from 'resolver-kit/verbs.ts';

export const PROGRAM = 'lets-delegate-subagent';
const RESOLVER = 'subagent';

export function createAnswer(io: Io): AnswerFn {
  const promptFile = (name: string) => `${SCRATCH}/${name}.prompt.md`;

  // The user's copy of a handoff's prompt. Nothing removes it: .workspace/
  // is scratch that git ignores.
  function writePrompt(cwd: string, name: string, prompt: string) {
    io.mkdirp(join(cwd, SCRATCH));
    io.writeFile(join(cwd, promptFile(name)), prompt);
  }

  // The default starts no review session. Exit 3 sends the review skills
  // to their subagent step.
  function run(): never {
    throw new Refused('no resolver started a session here, so no fresh session can run. Run the review in a subagent.');
  }

  // The default starts no session either. It hands the prompt back for the
  // user to give to any agent, and names none.
  function start({ cwd, name, prompt }: StartRequest): Response {
    writePrompt(cwd, name, prompt);
    const instructions = `Start any agent in ${cwd} and give it this prompt, which is also saved in ${promptFile(name)}:\n\n${prompt}`;
    return { resolver: RESOLVER, handle: null, instructions };
  }

  return async (verb: Verb, request: Request): Promise<Response | null> => {
    // It can run no model, so it lists none.
    if (verb === 'probe') return { resolver: RESOLVER, options: [] };
    if (verb === 'run') return run();
    if (verb === 'start') return start(request as StartRequest);
    // The default issues no handle, so it has nothing to finish. The
    // protocol still asks every resolver to answer the verb.
    return null;
  };
}
