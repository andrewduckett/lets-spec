// The user's delegate config: which resolver answers, and which families and
// models may run a review. `lets delegate setup` writes it; lets is the only
// reader, and passes the reviewers to a resolver in the run request.
import { isAbsolute, join } from 'node:path';
import type { Io } from '../io.ts';
import type { Env } from './env.ts';
import { UsageError } from './errors.ts';
import { EFFORTS, FAMILIES } from './protocol.ts';
import type { Effort, Family } from './protocol.ts';

export const CONFIG_VERSION = 1;

// A reviewer as the config holds it. Without efforts it serves every effort.
export type ConfigReviewer = { family: Family; model: string | null; efforts?: Effort[] };
export type Config = { version: typeof CONFIG_VERSION; resolver: string | null; reviewers: ConfigReviewer[] };

export type ConfigDeps = { env: Env; io: Io };

// $XDG_CONFIG_HOME/lets-delegate/config.json, or ~/.config/... when it is unset.
export function configPath({ env, io }: ConfigDeps): string {
  const base = env.XDG_CONFIG_HOME ? env.XDG_CONFIG_HOME : join(io.homedir(), '.config');
  return join(base, 'lets-delegate', 'config.json');
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
  const fail = (message: string) => new UsageError(`${path}: ${message}. Run \`lets delegate setup\` to write it again.`);
  const show = (value: unknown) => JSON.stringify(value);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw fail('is not JSON');
  }
  if (!isObject(value)) throw fail('is not a JSON object');
  if (value.version !== CONFIG_VERSION) throw fail(`version must be ${CONFIG_VERSION}, got ${show(value.version)}`);
  if (value.resolver !== null && (typeof value.resolver !== 'string' || !isAbsolute(value.resolver))) {
    throw fail(`resolver must be an absolute path or null, got ${show(value.resolver)}`);
  }
  if (!Array.isArray(value.reviewers)) throw fail(`reviewers must be a list, got ${show(value.reviewers)}`);
  value.reviewers.forEach((reviewer: unknown, i: number) => {
    const at = `reviewers[${i}]`;
    if (!isObject(reviewer)) throw fail(`${at} must be an object, got ${show(reviewer)}`);
    if (!(FAMILIES as readonly unknown[]).includes(reviewer.family)) {
      throw fail(`${at}.family must be one of ${FAMILIES.join(', ')}, got ${show(reviewer.family)}`);
    }
    if (reviewer.model !== null && typeof reviewer.model !== 'string') {
      throw fail(`${at}.model must be a string or null, got ${show(reviewer.model)}`);
    }
    const { efforts } = reviewer;
    if (efforts !== undefined && (!Array.isArray(efforts) || !efforts.every((e) => (EFFORTS as readonly unknown[]).includes(e)))) {
      throw fail(`${at}.efforts must be a list of ${EFFORTS.join(', ')}, got ${show(efforts)}`);
    }
  });
  return value as Config;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
