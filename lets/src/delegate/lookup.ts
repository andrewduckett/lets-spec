// Which resolver answers a request. In order: the executable LETS_SPEC_RESOLVER
// names, the resolver the user's delegate config names, lets-delegate-resolver
// on PATH, then the default, lets-delegate-subagent, which ships beside lets.
// The first that does not decline answers. No process access here;
// everything comes through io.
import { delimiter, join, resolve as resolvePath } from 'node:path';
import type { Child, Io } from '../io.ts';
import type { Config } from './config.ts';
import type { Env } from './env.ts';
import { ContractError, EXIT, SpawnError, UsageError } from './errors.ts';
import { DECLINE, exitFor, parseResponse } from './protocol.ts';
import type { Requests, Responses, Verb } from './protocol.ts';
import { withTimeout } from './wait.ts';

export const RESOLVER_COMMAND = 'lets-delegate-resolver';
// The default resolver, relative to the folder lets runs from.
export const DEFAULT_RESOLVER = 'contrib/lets-delegate-subagent';
// How long lets waits past a run's own timeout before it stops the resolver.
export const BACKSTOP_MINUTES = 1;
// How long lets waits on any verb but run. None of them waits on a session.
export const OTHER_VERB_TIMEOUT_MS = 5 * 60000;

// A resolver to ask: lets runs `<command> [...args] <verb>`. configured: the
// user's delegate config names it, and it is checked only when the lookup
// reaches it. builtIn: it is the default that ships with lets, at name.
export type Candidate = { kind: 'external'; name: string; command: string; args?: string[]; configured?: true; builtIn?: true };

// What a verb came to: the exit lets gives, the response, if any, and what
// the resolver said on stderr.
export type Outcome<V extends Verb> = { code: number; response: Responses[V] | null; stderr: string };

// config: the user's delegate config, or null when there is none.
// packageRoot: the folder lets runs from. nodePath: the Node that runs lets.
export type LookupDeps = { env: Env; io: Io; cwd: string; config: Config | null; packageRoot: string; nodePath: string };

// The resolvers to ask, in order. Throws a UsageError when LETS_SPEC_RESOLVER
// names a file that is missing or that this process cannot run.
export function candidates({ env, io, cwd, config, packageRoot, nodePath }: LookupDeps): Candidate[] {
  const list: Candidate[] = [];
  const override = env.LETS_SPEC_RESOLVER;
  if (override !== undefined && override !== '') {
    const command = resolvePath(cwd, override);
    if (!io.isExecutable(command)) {
      throw new UsageError(`LETS_SPEC_RESOLVER is ${command}, which does not exist or is not executable.`);
    }
    list.push({ kind: 'external', name: command, command });
  }
  const configured = config?.resolver ?? null;
  if (configured !== null) list.push({ kind: 'external', name: configured, command: configured, configured: true });
  if (io.commandExists(RESOLVER_COMMAND) && (configured === null || resolverOnPath(env, io) !== configured)) list.push({ kind: 'external', name: RESOLVER_COMMAND, command: RESOLVER_COMMAND });
  // The default runs with lets's own Node, so it needs no node on PATH.
  const subagent = join(packageRoot, DEFAULT_RESOLVER);
  list.push({ kind: 'external', name: subagent, command: nodePath, args: [subagent], builtIn: true });
  return list;
}

// The path of the RESOLVER_COMMAND that PATH finds first, or null.
export function resolverOnPath(env: Env, io: Io): string | null {
  for (const dir of (env.PATH ?? '').split(delimiter)) {
    if (dir !== '' && io.isExecutable(join(dir, RESOLVER_COMMAND))) return join(dir, RESOLVER_COMMAND);
  }
  return null;
}

// Ask one candidate. null means it declined. The outcome's code is the exit
// lets gives, not the resolver's own.
export async function callResolver<V extends Verb>(
  candidate: Candidate, verb: V, request: Requests[V], { io, timeoutMs }: { io: Io; timeoutMs: number },
): Promise<Outcome<V> | null> {
  // name, not command, in messages: the default's command is Node.
  const { name, command, args = [] } = candidate;
  const failed = (code: number, stderr: string) => ({ code, response: null, stderr });
  const started: { child?: Child } = {};
  const finished = io.execFile(command, [...args, verb], {
    cwd: request.cwd, input: JSON.stringify(request), started: (child) => { started.child = child; },
  });
  const result = await withTimeout(io, finished, timeoutMs);
  if (result === null) {
    started.child?.kill();
    const wait = timeoutMs >= 60000 ? `${Math.round(timeoutMs / 60000)} minutes` : `${Math.round(timeoutMs / 1000)} seconds`;
    return failed(EXIT.timeout, `${name} did not answer ${verb} in ${wait}, so it was stopped.`);
  }
  if (result.code === null) return failed(EXIT.spawn, `cannot run ${name}: ${result.stderr}`);
  if (result.code === DECLINE) {
    if (result.stdout.trim() === '') return null;
    return failed(EXIT.spawn, `${name} declined after printing a response. A resolver must decline before it starts anything.\n${result.stderr}`);
  }
  if (result.code !== 0) return failed(exitFor(result.code), result.stderr.trim() || `${name} exited ${result.code}`);
  try {
    return { code: EXIT.ok, response: parseResponse(verb, result.stdout), stderr: result.stderr };
  } catch (error) {
    if (!(error instanceof ContractError)) throw error;
    return failed(EXIT.spawn, `${name} broke the contract: ${error.message}`);
  }
}

// How long to wait on a resolver for a verb: a run's own timeout plus the
// backstop, else a few minutes.
export function timeoutFor<V extends Verb>(verb: V, request: Requests[V]): number {
  if (verb !== 'run') return OTHER_VERB_TIMEOUT_MS;
  return ((request as Requests['run']).timeoutMinutes + BACKSTOP_MINUTES) * 60000;
}

// Why lets cannot use its own default resolver. lets ships it, so a missing
// or broken one means the install is broken, not the user's setup.
const incompleteInstall = (problem: 'find' | 'run', path: string) =>
  `lets cannot ${problem} its default resolver at ${path}, so this lets install is incomplete. Reinstall lets.`;

// Ask each candidate in turn. Answers with the one that did not decline, so
// the caller can send finish to the same resolver. Throws a UsageError when
// it reaches a configured resolver that is missing or cannot be run, and a
// SpawnError when the default is missing.
export async function resolve<V extends Verb>(verb: V, request: Requests[V], deps: LookupDeps) {
  for (const candidate of candidates(deps)) {
    if (candidate.kind === 'external' && candidate.configured && !deps.io.isExecutable(candidate.command)) {
      throw new UsageError(`your delegate config names the resolver ${candidate.command}, which does not exist or is not executable. Run \`lets delegate setup\` again.`);
    }
    if (candidate.builtIn && !deps.io.exists(candidate.name)) throw new SpawnError(incompleteInstall('find', candidate.name));
    const outcome = await callResolver(candidate, verb, request, { io: deps.io, timeoutMs: timeoutFor(verb, request) });
    // The default answers 0 or 3, and never declines. Anything else means
    // it could not run.
    if (candidate.builtIn && (outcome === null || (outcome.code !== EXIT.ok && outcome.code !== EXIT.noSession))) {
      const stderr = outcome === null ? 'it declined' : outcome.stderr;
      return { candidate, outcome: { code: EXIT.spawn, response: null, stderr: `${incompleteInstall('run', candidate.name)}\n${stderr}` } };
    }
    if (outcome !== null) return { candidate, outcome };
  }
  // The default is last, and it never declines.
  throw new Error('every resolver declined, the default included');
}
