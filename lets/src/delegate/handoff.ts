// lets delegate handoff run: start a fresh, interactive session with a prompt,
// and return at once. A resolver that cannot reach one answers with the
// instructions a person needs instead. No process access here; everything
// comes through deps.
import type { Deps } from '../io.ts';
import { readConfig } from './config.ts';
import { EXIT, exitCodeOf } from './errors.ts';
import { repoRoot } from './git.ts';
import { resolveWithModels } from './lookup.ts';
import { readPromptFile } from './prompt-file.ts';
import { buildRequest, normalizeName } from './protocol.ts';

// models: each <family> or <family>/<model>, best first, sent to the
// resolver unchanged, one at a time until one is not refused.
export type HandoffOptions = { name: string; promptFile: string; models: string[] };

// The exit code: 0 ok, 2 usage, 3 every model refused, 4 the session could
// not start.
export async function run({ name, promptFile, models }: HandoffOptions, deps: Deps): Promise<number> {
  try {
    const prompt = readPromptFile(promptFile, deps);
    const cwd = await repoRoot(deps.cwd, deps.io);
    const requestFor = (model: string) => buildRequest('start', { cwd, name: normalizeName(name), prompt, model });
    const { outcome } = await resolveWithModels('start', requestFor, models,
      { env: deps.env, io: deps.io, cwd, config: readConfig(deps), packageRoot: deps.packageRoot, nodePath: deps.nodePath });
    if (outcome.code !== EXIT.ok) {
      deps.stderr(`lets delegate: ${outcome.stderr.trim()}\n`);
      // Every model was refused, which the caller can act on. Any other
      // failure means the session could not start.
      return outcome.code === EXIT.noSession ? EXIT.noSession : EXIT.spawn;
    }
    deps.stdout(`${JSON.stringify(outcome.response)}\n`);
    return EXIT.ok;
  } catch (error) {
    const code = exitCodeOf(error);
    if (code === null) throw error;
    deps.stderr(`lets delegate: ${(error as Error).message}\n`);
    return code === EXIT.usage ? code : EXIT.spawn;
  }
}
