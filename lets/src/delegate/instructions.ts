// lets delegate <strategy> instructions: tell a skill what can run for a
// delegation before it runs one. Asks the first resolver that does not
// decline the strategy's kind of session which models it can run, and adds
// the user's guidance for the intent. It starts no session. No process
// access here; everything comes through deps.
import type { Deps } from '../io.ts';
import { configPath, guidanceFor, readConfig } from './config.ts';
import { EXIT } from '../resolvers/kit/errors.ts';
import { guarded } from './guarded.ts';
import { inAdapter, pick } from './lookup.ts';
import { STRATEGIES } from './strategies.ts';
import type { Intent, Strategy } from './strategies.ts';

export type InstructionsOptions = { strategy: Strategy; for: Intent };

// The exit code: 0 ok, 2 usage, a bad guidance, or every resolver declined,
// 4 the outcome is unknown.
export function run({ strategy, for: intent }: InstructionsOptions, deps: Deps): Promise<number> {
  return guarded(deps, async () => {
    const config = readConfig(deps);
    // Checked first, so a bad guidance asks no resolver.
    const guidance = guidanceFor(config, intent, configPath(deps));
    const adapter = await pick(STRATEGIES[strategy].verb, { ...deps, config });
    const options = await inAdapter(() => adapter.options((message) => deps.stderr(`lets delegate: ${message}\n`)));
    deps.stdout(`${JSON.stringify({ strategy, for: intent, resolver: adapter.name, options, guidance })}\n`);
    return EXIT.ok;
  });
}
