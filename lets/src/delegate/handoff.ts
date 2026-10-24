// lets delegate handoff run: start a fresh, interactive session with a prompt,
// and return at once. A resolver that cannot reach one answers with the
// instructions a person needs instead. No process access here; everything
// comes through deps.
import type { Deps } from '../io.ts';
import { readConfig } from './config.ts';
import { EXIT, Refused, SpawnError } from '../resolvers/kit/errors.ts';
import { repoRoot } from './git.ts';
import { guarded } from './guarded.ts';
import { checkModels, pick, withModels } from './lookup.ts';
import { readPromptFile } from './prompt-file.ts';
import { normalizeName, parseModel } from '../resolvers/kit/protocol.ts';

// models: each <family> or <family>/<model>, best first, asked for one at
// a time until one is not refused.
export type HandoffOptions = { name: string; promptFile: string; models: string[] };

// The exit code: 0 ok, 2 usage, 3 every model refused, 4 the session could
// not start.
export function run({ name, promptFile, models }: HandoffOptions, deps: Deps): Promise<number> {
  return guarded(deps, async () => {
    checkModels(models);
    const config = readConfig(deps);
    const prompt = readPromptFile(promptFile, deps);
    const cwd = await repoRoot(deps.cwd, deps.io);
    const adapter = await pick('start', { ...deps, config });
    let started;
    try {
      ({ value: started } = await withModels(models, (model) =>
        adapter.start!({ name: normalizeName(name), prompt, cwd, ...parseModel(model)! })));
    } catch (error) {
      // Every model was refused, which the caller can act on. Any other
      // failure means the session could not start.
      if (error instanceof Refused) throw error;
      throw new SpawnError((error as Error).message);
    }
    const response = 'instructions' in started ? { resolver: adapter.name, handle: null, instructions: started.instructions } : { resolver: adapter.name, handle: started };
    deps.stdout(`${JSON.stringify(response)}\n`);
    return EXIT.ok;
  });
}
