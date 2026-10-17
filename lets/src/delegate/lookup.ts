// Which resolver answers a request. In order: the executable LETS_SPEC_RESOLVER
// names, lets-delegate-resolver on PATH, then the built-in default. The first
// that does not decline answers. No process access here; everything comes
// through io.
import { resolve as resolvePath } from 'node:path';
import type { Child, Io } from '../io.ts';
import { createDefaultResolver } from './default-resolver.ts';
import type { DefaultResolver, Outcome } from './default-resolver.ts';
import type { Env } from './env.ts';
import { ContractError, EXIT, UsageError } from './errors.ts';
import { DECLINE, exitFor, parseResponse } from './protocol.ts';
import type { Requests, Verb } from './protocol.ts';
import { withTimeout } from './wait.ts';

export const RESOLVER_COMMAND = 'lets-delegate-resolver';
// How long lets waits past a run's own timeout before it stops the resolver.
export const BACKSTOP_MINUTES = 1;
// How long lets waits on any verb but run. None of them waits on a session.
export const OTHER_VERB_TIMEOUT_MS = 5 * 60000;

export type Candidate =
  | { kind: 'external'; name: string; command: string }
  | { kind: 'default'; name: 'default'; resolver: DefaultResolver };

export type LookupDeps = { env: Env; io: Io; cwd: string };

// The resolvers to ask, in order. Throws a UsageError when LETS_SPEC_RESOLVER
// names a file that is missing or that this process cannot run.
export function candidates({ env, io, cwd }: LookupDeps): Candidate[] {
  const list: Candidate[] = [];
  const override = env.LETS_SPEC_RESOLVER;
  if (override !== undefined && override !== '') {
    const command = resolvePath(cwd, override);
    if (!io.isExecutable(command)) {
      throw new UsageError(`LETS_SPEC_RESOLVER is ${command}, which does not exist or is not executable.`);
    }
    list.push({ kind: 'external', name: command, command });
  }
  if (io.commandExists(RESOLVER_COMMAND)) list.push({ kind: 'external', name: RESOLVER_COMMAND, command: RESOLVER_COMMAND });
  list.push({ kind: 'default', name: 'default', resolver: createDefaultResolver(io, env) });
  return list;
}

// Ask one candidate. null means it declined. The outcome's code is the exit
// lets gives, not the resolver's own.
export async function callResolver<V extends Verb>(
  candidate: Candidate, verb: V, request: Requests[V], { io, timeoutMs }: { io: Io; timeoutMs: number },
): Promise<Outcome<V> | null> {
  if (candidate.kind === 'default') {
    const outcome = await candidate.resolver.handle(verb, request);
    return { ...outcome, code: exitFor(outcome.code) };
  }

  const { command } = candidate;
  const failed = (code: number, stderr: string) => ({ code, response: null, stderr });
  const started: { child?: Child } = {};
  const finished = io.execFile(command, [verb], {
    cwd: request.cwd, input: JSON.stringify(request), started: (child) => { started.child = child; },
  });
  const result = await withTimeout(io, finished, timeoutMs);
  if (result === null) {
    started.child?.kill();
    const wait = timeoutMs >= 60000 ? `${Math.round(timeoutMs / 60000)} minutes` : `${Math.round(timeoutMs / 1000)} seconds`;
    return failed(EXIT.timeout, `${command} did not answer ${verb} in ${wait}, so it was stopped.`);
  }
  if (result.code === null) return failed(EXIT.spawn, `cannot run ${command}: ${result.stderr}`);
  if (result.code === DECLINE) {
    if (result.stdout.trim() === '') return null;
    return failed(EXIT.spawn, `${command} declined after printing a response. A resolver must decline before it starts anything.\n${result.stderr}`);
  }
  if (result.code !== 0) return failed(exitFor(result.code), result.stderr.trim() || `${command} exited ${result.code}`);
  try {
    return { code: EXIT.ok, response: parseResponse(verb, result.stdout), stderr: result.stderr };
  } catch (error) {
    if (!(error instanceof ContractError)) throw error;
    return failed(EXIT.spawn, `${command} broke the contract: ${error.message}`);
  }
}

// How long to wait on a resolver for a verb: a run's own timeout plus the
// backstop, else a few minutes.
export function timeoutFor<V extends Verb>(verb: V, request: Requests[V]): number {
  if (verb !== 'run') return OTHER_VERB_TIMEOUT_MS;
  return ((request as Requests['run']).timeoutMinutes + BACKSTOP_MINUTES) * 60000;
}

// Ask each candidate in turn. Answers with the one that did not decline, so
// the caller can send finish to the same resolver.
export async function resolve<V extends Verb>(verb: V, request: Requests[V], deps: LookupDeps) {
  for (const candidate of candidates(deps)) {
    const outcome = await callResolver(candidate, verb, request, { io: deps.io, timeoutMs: timeoutFor(verb, request) });
    if (outcome !== null) return { candidate, outcome };
  }
  // The default is last, and it never declines.
  throw new Error('every resolver declined, the default included');
}
