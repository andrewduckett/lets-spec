// subagent, the default resolver. lets asks it last, so it never declines,
// and it starts no session: a review is exit 3, for the review skills'
// subagent step, and a handoff hands the prompt back. createAdapter answers
// in lets; createAnswer answers in the program, lets-delegate-subagent.
import { join } from 'node:path';
import type { Adapter } from '../kit/adapter.ts';
import { Refused } from '../kit/errors.ts';
import { SCRATCH } from '../kit/io.ts';
import type { Io } from '../kit/io.ts';
import type { Request, Response, StartRequest, Verb } from '../kit/protocol.ts';
import type { AnswerFn } from '../kit/verbs.ts';

export const PROGRAM = 'lets-delegate-subagent';
const RESOLVER = 'subagent';

// What both the adapter and the program answer.
function answers(io: Io) {
  const promptFile = (name: string) => `${SCRATCH}/${name}.prompt.md`;
  return {
    // The default starts no review session. Exit 3 sends the review skills
    // to their subagent step.
    run(): never {
      throw new Refused('no resolver started a session here, so no fresh session can run. Run the review in a subagent.');
    },
    // The default starts no session either. It saves the user's copy of the
    // prompt, which nothing removes: .workspace/ is scratch that git
    // ignores. Then it hands the prompt back for the user to give to any
    // agent, and names none.
    start({ cwd, name, prompt }: { cwd: string; name: string; prompt: string }): string {
      io.mkdirp(join(cwd, SCRATCH));
      io.writeFile(join(cwd, promptFile(name)), prompt);
      return `Start any agent in ${cwd} and give it this prompt, which is also saved in ${promptFile(name)}:\n\n${prompt}`;
    },
  };
}

export function createAdapter(io: Io): Adapter {
  const { run, start } = answers(io);
  return {
    name: RESOLVER,
    program: PROGRAM,
    harness: 'lets',
    // It issues no handle, so it never sees one of its own.
    handleKind: 'none',
    detect: () => true,
    // It can run no model, so it lists none.
    options: async () => [],
    run: async () => run(),
    start: async (input) => ({ instructions: start(input) }),
    // It issues no handle, so it has nothing to finish.
    finish: async () => {},
  };
}

export function createAnswer(io: Io): AnswerFn {
  const { run, start } = answers(io);
  return async (verb: Verb, request: Request): Promise<Response | null> => {
    if (verb === 'probe') return { resolver: RESOLVER, options: [] };
    if (verb === 'run') return run();
    if (verb === 'start') return { resolver: RESOLVER, handle: null, instructions: start(request as StartRequest) };
    // The protocol still asks every resolver to answer finish.
    return null;
  };
}
