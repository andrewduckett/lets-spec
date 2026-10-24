// Which resolver answers a delegation: the first in the chain, the resolvers
// the user's delegate config names, that does not decline. With no config,
// the chain is the default, subagent. Every resolver is built into lets, so
// nothing is run or looked up on PATH.
import type { Adapter } from '../resolvers/kit/adapter.ts';
import type { Deps } from '../io.ts';
import { configPath } from './config.ts';
import type { Config } from './config.ts';
import { exitCodeOf, Refused, SpawnError, UsageError } from '../resolvers/kit/errors.ts';
import { FAMILIES, parseModel } from '../resolvers/kit/protocol.ts';

// The kind of session asked for: read-only for a review, interactive for a
// handoff.
export type Kind = 'run' | 'start';

// config: the user's delegate config, or null when there is none.
export type LookupDeps = Pick<Deps, 'env' | 'io' | 'resolvers'> & { config: Config | null };

// The adapters to ask, in order.
export function chain({ config, resolvers }: Pick<LookupDeps, 'config' | 'resolvers'>): Adapter[] {
  return (config?.resolvers ?? ['subagent']).map((name) => resolvers[name]);
}

// The first adapter in the chain that does not decline kind. An adapter
// declines when it cannot run here, and declines a handoff when it cannot
// start one. Throws a UsageError when every adapter declines.
export async function pick(kind: Kind, deps: LookupDeps): Promise<Adapter> {
  for (const adapter of chain(deps)) {
    if (kind === 'start' && adapter.start === undefined) continue;
    if (await inAdapter(async () => adapter.detect())) return adapter;
  }
  throw new UsageError(`every resolver declined. ${configPath(deps)} lists the resolvers to ask; add subagent to fall back to a subagent.`);
}

// Throws a UsageError when models is empty, or naming the first that is not
// <family> or <family>/<model>, so a bad one asks no resolver.
export function checkModels(models: string[]): void {
  if (models.length === 0) throw new UsageError('give --model at least once.');
  const bad = models.find((text) => parseModel(text) === null);
  if (bad !== undefined) throw new UsageError(`--model must be <family> or <family>/<model>, for a family of ${FAMILIES.join(', ')}, got ${JSON.stringify(bad)}.`);
}

// call's answer for the first of models, best first, that is not refused,
// and that model. A refusal is an answer, not a decline, so the caller asks
// the same adapter for each model. Any other failure stops at once. When
// every model is refused, throws one Refused with a line per model,
// <model>: <reason>.
export async function withModels<T>(models: string[], call: (model: string) => Promise<T>): Promise<{ value: T; model: string }> {
  const refusals: string[] = [];
  for (const model of models) {
    try {
      return { value: await inAdapter(() => call(model)), model };
    } catch (error) {
      if (!(error instanceof Refused)) throw error;
      refusals.push(`${model}: ${error.message}`);
    }
  }
  throw new Refused(refusals.join('\n'));
}

// fn, an adapter call. An error the commands do not know becomes a
// SpawnError with its message, so it exits 4: lets cannot tell what the
// adapter did.
export async function inAdapter<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (exitCodeOf(error) !== null) throw error;
    throw new SpawnError(error instanceof Error ? error.message : String(error));
  }
}
