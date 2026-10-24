// The user's delegate config: the chain, the resolvers lets asks, in order,
// and the user's guidance for each kind of delegation.
// The user writes it by hand, and lets is the only reader. Keys this lets
// does not know are ignored, so a later lets can add one beside them.
import { dirname, isAbsolute, join } from 'node:path';
import { parse } from 'yaml';
import type { Deps, Io } from '../io.ts';
import { UsageError } from '../resolvers/kit/errors.ts';

export const CONFIG_VERSION = 2;
// The entry in the chain that names the default, lets-delegate-subagent,
// which ships beside the running lets.
export const SUBAGENT_ENTRY = 'subagent';

// Each resolver is an absolute path, or SUBAGENT_ENTRY. delegations is as
// the user wrote it: only lets delegate <strategy> instructions reads it,
// through guidanceFor, so a bad entry never stops a run.
export type Config = { version: typeof CONFIG_VERSION; resolvers: string[]; delegations?: unknown };

export type ConfigDeps = { env: Deps['env']; io: Io };

// $XDG_CONFIG_HOME/lets-delegate/config.yaml, or ~/.config/... when it is unset.
export function configPath({ env, io }: ConfigDeps): string {
  const base = env.XDG_CONFIG_HOME ? env.XDG_CONFIG_HOME : join(io.homedir(), '.config');
  return join(base, 'lets-delegate', 'config.yaml');
}

// The config, or null when there is no file. Throws a UsageError that names
// the file and the bad value when the file is not a valid config, and one
// that names both files when only the old config.json is there.
export function readConfig(deps: ConfigDeps): Config | null {
  const path = configPath(deps);
  const text = deps.io.readFile(path);
  if (text !== null) return parseConfig(text, path);
  const old = join(dirname(path), 'config.json');
  if (deps.io.exists(old)) {
    throw new UsageError(`${old} is no longer read: the delegate config is now config.yaml. Write ${path} instead, then remove ${old}.`);
  }
  return null;
}

// The config in text, read from path. Throws as readConfig does.
export function parseConfig(text: string, path: string): Config {
  const fail = (message: string) => new UsageError(`${path}: ${message}.`);
  const show = (value: unknown) => JSON.stringify(value) ?? String(value);
  let value: unknown;
  try {
    value = parse(text);
  } catch (error) {
    throw fail(`is not YAML: ${(error as Error).message.split('\n')[0].replace(/:$/, '')}`);
  }
  if (!isObject(value)) throw fail(`must be a mapping with version and resolvers, got ${show(value)}`);
  if (value.version !== CONFIG_VERSION) throw fail(`version must be ${CONFIG_VERSION}, got ${show(value.version)}`);
  const { resolvers } = value;
  if (!Array.isArray(resolvers)) throw fail(`resolvers must be a list, got ${show(resolvers)}`);
  resolvers.forEach((entry: unknown, i: number) => {
    if (entry !== SUBAGENT_ENTRY && (typeof entry !== 'string' || !isAbsolute(entry))) {
      throw fail(`resolvers[${i}] must be an absolute path or ${SUBAGENT_ENTRY}, got ${show(entry)}`);
    }
  });
  return value.delegations === undefined ? { version: CONFIG_VERSION, resolvers } : { version: CONFIG_VERSION, resolvers, delegations: value.delegations };
}

// The user's guidance for an intent, from delegations.<intent>.guidance, or
// null when there is no config or any level is missing. Throws a UsageError
// that names the file and the key when a level has the wrong type. Other
// intents' entries are not checked.
export function guidanceFor(config: Config | null, intent: string, path: string): string | null {
  const fail = (key: string, expected: string, value: unknown) =>
    new UsageError(`${path}: ${key} must be ${expected}, got ${JSON.stringify(value) ?? String(value)}.`);
  const delegations = config?.delegations;
  if (delegations === undefined || delegations === null) return null;
  if (!isObject(delegations)) throw fail('delegations', 'a mapping', delegations);
  const entry = delegations[intent];
  if (entry === undefined || entry === null) return null;
  if (!isObject(entry)) throw fail(`delegations.${intent}`, 'a mapping', entry);
  const { guidance } = entry;
  if (guidance === undefined || guidance === null) return null;
  if (typeof guidance !== 'string') throw fail(`delegations.${intent}.guidance`, 'a string', guidance);
  return guidance;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
