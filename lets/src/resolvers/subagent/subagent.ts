// subagent, the default resolver. lets asks it last, so it never declines,
// and it starts no session: a review is exit 3, for the review skills'
// subagent step, and a handoff hands the prompt back.
import { join } from 'node:path';
import type { Adapter } from '../kit/adapter.ts';
import { Refused } from '../kit/errors.ts';
import { SCRATCH } from '../kit/io.ts';
import type { Io } from '../kit/io.ts';

export function createAdapter(io: Io): Adapter {
  const promptFile = (name: string) => `${SCRATCH}/${name}.prompt.md`;
  return {
    name: 'subagent',
    detect: () => true,
    // It can run no model, so it lists none.
    options: async () => [],
    // The default starts no review session. Exit 3 sends the review skills
    // to their subagent step.
    run: async () => {
      throw new Refused('no resolver started a session here, so no fresh session can run. Run the review in a subagent.');
    },
    // The default starts no session either. It saves the user's copy of the
    // prompt, which nothing removes: .workspace/ is scratch that git
    // ignores. Then it hands the prompt back for the user to give to any
    // agent, and names none.
    start: async ({ cwd, name, prompt }) => {
      io.mkdirp(join(cwd, SCRATCH));
      io.writeFile(join(cwd, promptFile(name)), prompt);
      return { instructions: `Start any agent in ${cwd} and give it this prompt, which is also saved in ${promptFile(name)}:\n\n${prompt}` };
    },
    // It issues no handle, so it has nothing to finish.
    finish: async () => {},
  };
}
