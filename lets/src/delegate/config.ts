// The user's delegate config: the chain, the resolvers lets asks, in order,
// and the user's guidance for each kind of delegation.
// The user writes it by hand, and lets is the only reader. Keys this lets
// does not know are ignored, so a later lets can add one beside them.
import { join } from 'node:path';
import { parse } from 'yaml';
import { configDir } from '../config-dir.ts';
import type { Deps, Io } from '../io.ts';
import { UsageError } from '../resolvers/kit/errors.ts';
import type { Intent, Strategy } from './strategies.ts';

export const CONFIG_VERSION = 3;
// The resolvers built into lets, by the names the chain lists them under.
export const RESOLVER_NAMES = ['t3', 'cli', 'subagent'] as const;
export type ResolverName = (typeof RESOLVER_NAMES)[number];

// The file's shape, with the keys this lets does not know dropped. delegate
// is {} when the file has none. Each resolver is one of RESOLVER_NAMES.
// review and handoff are as the user wrote them: only lets delegate
// <strategy> instructions reads them, through guidanceFor, so a bad entry
// never stops a run.
export type Config = {
  version: typeof CONFIG_VERSION;
  delegate: { resolvers?: ResolverName[]; review?: unknown; handoff?: unknown };
};

export type ConfigDeps = { env: Deps['env']; io: Io };

// config.yaml in the lets config folder.
export function configPath({ env, io }: ConfigDeps): string {
  return join(configDir(env, io.homedir()), 'config.yaml');
}

// The config, or null when there is no file. Throws a UsageError that names
// the file and the bad value when the file is not a valid config.
export function readConfig(deps: ConfigDeps): Config | null {
  const path = configPath(deps);
  const text = deps.io.readFile(path);
  return text === null ? null : parseConfig(text, path);
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
  if (!isObject(value)) throw fail(`must be a mapping with version, got ${show(value)}`);
  if (value.version !== CONFIG_VERSION) throw fail(`version must be ${CONFIG_VERSION}, got ${show(value.version)}`);
  const delegate = value.delegate ?? {};
  if (!isObject(delegate)) throw fail(`delegate must be a mapping, got ${show(delegate)}`);
  const config: Config = { version: CONFIG_VERSION, delegate: {} };
  const { resolvers } = delegate;
  if (resolvers !== undefined && resolvers !== null) {
    if (!Array.isArray(resolvers)) throw fail(`delegate.resolvers must be a list, got ${show(resolvers)}`);
    resolvers.forEach((entry: unknown, i: number) => {
      if (!(RESOLVER_NAMES as readonly unknown[]).includes(entry)) throw fail(`delegate.resolvers[${i}] must be t3, cli or subagent, got ${show(entry)}`);
    });
    config.delegate.resolvers = resolvers;
  }
  for (const strategy of ['review', 'handoff'] as const) {
    if (delegate[strategy] !== undefined) config.delegate[strategy] = delegate[strategy];
  }
  return config;
}

// The user's guidance for an intent, from
// delegate.<strategy>.<intent>.guidance, or null when there is no config or
// any level is missing. Throws a UsageError that names the file and the
// dotted key when a level has the wrong type. Other strategies' and other
// intents' entries are not checked.
export function guidanceFor(config: Config | null, strategy: Strategy, intent: Intent, path: string): string | null {
  const fail = (key: string, expected: string, value: unknown) =>
    new UsageError(`${path}: ${key} must be ${expected}, got ${JSON.stringify(value) ?? String(value)}.`);
  const entry = config?.delegate[strategy];
  if (entry === undefined || entry === null) return null;
  if (!isObject(entry)) throw fail(`delegate.${strategy}`, 'a mapping', entry);
  const forIntent = entry[intent];
  if (forIntent === undefined || forIntent === null) return null;
  if (!isObject(forIntent)) throw fail(`delegate.${strategy}.${intent}`, 'a mapping', forIntent);
  const { guidance } = forIntent;
  if (guidance === undefined || guidance === null) return null;
  if (typeof guidance !== 'string') throw fail(`delegate.${strategy}.${intent}.guidance`, 'a string', guidance);
  return guidance;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
