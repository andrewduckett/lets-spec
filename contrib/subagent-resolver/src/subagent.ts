// lets-delegate-subagent, the default resolver. lets asks it last, so it
// never declines, and it starts no session: a review is exit 3, for the
// review skills' subagent step, and a handoff hands the prompt back.
import { NoFamilyError } from 'resolver-kit/errors.ts';
import type { Io } from 'resolver-kit/io.ts';
import type { Request, Response, Verb } from 'resolver-kit/protocol.ts';
import type { AnswerFn } from 'resolver-kit/verbs.ts';

export const PROGRAM = 'lets-delegate-subagent';
const RESOLVER = 'subagent';

export function createAnswer(io: Io): AnswerFn {
  // The default starts no review session. Exit 3 sends the review skills
  // to their subagent step.
  function run(): never {
    throw new NoFamilyError('no resolver started a session here, so no fresh session can run. Run the review in a subagent.');
  }

  return async (verb: Verb, request: Request): Promise<Response | null> => {
    if (verb === 'probe') return { resolver: RESOLVER };
    if (verb === 'run') return run();
    throw new Error(`${verb} is not answered yet`);
  };
}
