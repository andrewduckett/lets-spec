// The user's delegate config: the chain, the resolvers lets asks, in order.
// The user writes it by hand, and lets is the only reader. Keys this lets
// does not know are ignored, so a later lets can add one beside them.
import { isAbsolute, join } from 'node:path';
import { parse } from 'yaml';
import type { Io } from '../io.ts';
import type { Env } from './env.ts';
import { UsageError } from './errors.ts';

export const CONFIG_VERSION = 2;
// The entry in the chain that names the default, lets-delegate-subagent,
// which ships beside the running lets.
export const SUBAGENT_ENTRY = 'subagent';

// Each resolver is an absolute path, or SUBAGENT_ENTRY.
export type Config = { version: typeof CONFIG_VERSION; resolvers: string[] };

export type ConfigDeps = { env: Env; io: Io };

// $XDG_CONFIG_HOME/lets-delegate/config.yaml, or ~/.config/... when it is unset.
export function configPath({ env, io }: ConfigDeps): string {
  const base = env.XDG_CONFIG_HOME ? env.XDG_CONFIG_HOME : join(io.homedir(), '.config');
  return join(base, 'lets-delegate', 'config.yaml');
}

// The config, or null when there is no file. Throws a UsageError that names
// the file and the bad value when the file is not a valid config.
export function readConfig(deps: ConfigDeps): Config | null {
  const path = configPath(deps);
  const text = deps.io.readFile(path);
  if (text === null) return null;
  return parseConfig(text, path);
}

// The config in text, read from path. Throws as readConfig does.
export function parseConfig(text: string, path: string): Config {
  const fail = (message: string) => new UsageError(`${path}: ${message}.`);
  const show = (value: unknown) => JSON.stringify(value) ?? String(value);
  let value: unknown;
  try {
    value = parse(text);
  } catch (error) {
    throw fail(`is not YAML: ${(error as Error).message.split('\n')[0]}`);
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
  return { version: CONFIG_VERSION, resolvers };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
