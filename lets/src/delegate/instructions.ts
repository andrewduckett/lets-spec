// lets delegate <strategy> instructions: tell a skill what can run for a
// delegation before it runs one. Asks the resolvers for their probe answer,
// for the strategy's verb, and adds the user's guidance for the intent. It
// starts no session. No process access here; everything comes through deps.
import type { Deps } from '../io.ts';
import { configPath, guidanceFor, readConfig } from './config.ts';
import { EXIT, exitCodeOf } from './errors.ts';
import { repoRoot } from './git.ts';
import { resolve } from './lookup.ts';
import { buildRequest } from './protocol.ts';
import { STRATEGIES } from './strategies.ts';
import type { Intent, Strategy } from './strategies.ts';

export type InstructionsOptions = { strategy: Strategy; for: Intent };

// The exit code: 0 ok, 2 usage, a bad guidance, or every resolver declined,
// 4 the resolver broke the contract.
export async function run({ strategy, for: intent }: InstructionsOptions, deps: Deps): Promise<number> {
  try {
    const config = readConfig(deps);
    // Checked first, so a bad guidance asks no resolver.
    const guidance = guidanceFor(config, intent, configPath(deps));
    const cwd = await repoRoot(deps.cwd, deps.io);
    const request = buildRequest('probe', { cwd, verb: STRATEGIES[strategy].verb });
    const { outcome } = await resolve('probe', request, { env: deps.env, io: deps.io, cwd, config, packageRoot: deps.packageRoot, nodePath: deps.nodePath });
    if (outcome.code !== EXIT.ok) {
      deps.stderr(`lets delegate: ${outcome.stderr.trim()}\n`);
      return outcome.code;
    }
    const { resolver, options } = outcome.response!;
    deps.stdout(`${JSON.stringify({ strategy, for: intent, resolver, options, guidance })}\n`);
    return EXIT.ok;
  } catch (error) {
    const code = exitCodeOf(error);
    if (code === null) throw error;
    deps.stderr(`lets delegate: ${(error as Error).message}\n`);
    return code;
  }
}
