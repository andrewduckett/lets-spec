// Copied from lets/src/delegate/protocol.ts, so each resolver installs on its own.
// Keep the two the same: a test compares them, and the verify check runs
// against each resolver in CI.

// The resolver contract. lets runs a resolver as `<resolver> <verb>`, writes
// one JSON request to its stdin, and reads one JSON response from its stdout.
// The contrib resolver keeps a copy of this file; a test and the verify
// check keep the two in step.
import { isAbsolute } from 'node:path';
import { ContractError, EXIT, UsageError } from './errors.ts';

export const PROTOCOL = 2;
// The exit code a resolver declines with: it does not handle this request
// here, and it has started nothing.
export const DECLINE = 75;

export const VERBS = ['probe', 'run', 'start', 'finish'] as const;
export const FAMILIES = ['gpt', 'claude', 'gemini'] as const;
export const EFFORTS = ['low', 'medium', 'high'] as const;
export type Verb = (typeof VERBS)[number];
export type Family = (typeof FAMILIES)[number];
export type Effort = (typeof EFFORTS)[number];

export const DEFAULT_TIMEOUT_MINUTES: Record<Effort, number> = { low: 15, medium: 15, high: 45 };

// A session a resolver made. kind says what it is, such as thread, tab or
// process. A resolver may add fields; lets passes the handle back whole.
export type Handle = { kind: string; id: string; [field: string]: unknown };

// The model a session runs, as <family> or <family>/<id>. A bare family is
// the harness's own default model for that family.
export type ModelString = string;

// A model string split into its family and id. A null model is the
// harness's default.
export type Model = { family: Family; model: string | null };

// The family and id of a model string, or null when it is not
// <family> or <family>/<id>. The id is everything after the first slash,
// and has no whitespace.
export function parseModel(text: string): Model | null {
  const slash = text.indexOf('/');
  const family = slash === -1 ? text : text.slice(0, slash);
  if (!(FAMILIES as readonly string[]).includes(family)) return null;
  if (slash === -1) return { family: family as Family, model: null };
  const model = text.slice(slash + 1);
  return model !== '' && !/\s/.test(model) ? { family: family as Family, model } : null;
}

export type ProbeRequest = { protocol: typeof PROTOCOL; cwd: string };
export type RunRequest = {
  protocol: typeof PROTOCOL; cwd: string; name: string; prompt: string; sourceFamily: Family;
  readOnly: true; interactive: false; effort: Effort; timeoutMinutes: number; model: ModelString;
};
export type StartRequest = {
  protocol: typeof PROTOCOL; cwd: string; name: string; prompt: string; readOnly: false; interactive: true; model: ModelString;
};
export type FinishRequest = { protocol: typeof PROTOCOL; cwd: string; handle: Handle; ok: boolean };
export type Requests = { probe: ProbeRequest; run: RunRequest; start: StartRequest; finish: FinishRequest };
export type Request = Requests[Verb];

// options: the models this resolver can run now, in the harness's order.
export type ProbeResponse = { resolver: string; options: ModelString[] };
export type RunResponse = { resolver: string; text: string; family: Family; model?: string | null; handle?: Handle | null };
export type StartResponse = { resolver: string; handle: Handle } | { resolver: string; handle: null; instructions: string };
export type FinishResponse = Record<string, unknown>;
export type Responses = { probe: ProbeResponse; run: RunResponse; start: StartResponse; finish: FinishResponse };
export type Response = Responses[Verb];

// What a caller gives buildRequest: the request without what the verb sets.
export type Fields = {
  probe: { cwd: string };
  run: { cwd: string; name: string; prompt: string; sourceFamily: Family; effort: Effort; timeoutMinutes?: number; model: ModelString };
  start: { cwd: string; name: string; prompt: string; model: ModelString };
  finish: { cwd: string; handle: Handle; ok: boolean };
};

const builders: { [V in Verb]: (fields: Fields[V]) => Requests[V] } = {
  probe: ({ cwd }) => ({ protocol: PROTOCOL, cwd }),
  run: ({ cwd, name, prompt, sourceFamily, effort, timeoutMinutes, model }) => ({
    protocol: PROTOCOL, cwd, name, prompt, sourceFamily, readOnly: true, interactive: false, effort,
    timeoutMinutes: timeoutMinutes ?? DEFAULT_TIMEOUT_MINUTES[effort], model,
  }),
  start: ({ cwd, name, prompt, model }) => ({ protocol: PROTOCOL, cwd, name, prompt, readOnly: false, interactive: true, model }),
  finish: ({ cwd, handle, ok }) => ({ protocol: PROTOCOL, cwd, handle, ok }),
};

// The request for a verb. run takes the default timeout for its effort when
// none is given.
export function buildRequest<V extends Verb>(verb: V, fields: Fields[V]): Requests[V] {
  return (builders[verb] as (fields: Fields[V]) => Requests[V])(fields);
}

// A request as a resolver reads it from stdin. Throws a UsageError that names
// the problem, so the resolver exits 2.
export function parseRequest(verb: string, text: string): Request {
  if (!(VERBS as readonly string[]).includes(verb)) throw new UsageError(`unknown verb: ${verb}`);
  const request = parseObject(text, 'the request', (message) => new UsageError(message));
  if (request.protocol !== PROTOCOL) {
    throw new UsageError(`unknown protocol ${JSON.stringify(request.protocol)}; this resolver speaks protocol ${PROTOCOL}`);
  }
  const check = checker(request, 'the request', (message) => new UsageError(message));
  check.absolutePath('cwd');
  if (verb === 'run' || verb === 'start') {
    check.name('name');
    check.text('prompt');
    check.exactly('readOnly', verb === 'run');
    check.exactly('interactive', verb === 'start');
    check.model('model');
  }
  if (verb === 'run') {
    check.oneOf('sourceFamily', FAMILIES);
    check.oneOf('effort', EFFORTS);
    check.wholeNumber('timeoutMinutes');
  }
  if (verb === 'finish') {
    check.handle('handle', false);
    check.boolean('ok');
  }
  return request as Request;
}

// A response as lets reads it from a resolver's stdout. Throws a
// ContractError that names the problem. finish may answer nothing at all.
export function parseResponse<V extends Verb>(verb: V, text: string): Responses[V] {
  if (verb === 'finish' && text.trim() === '') return {} as Responses[V];
  const response = parseObject(text, 'the response', (message) => new ContractError(message));
  const check = checker(response, 'the response', (message) => new ContractError(message));
  if (verb === 'finish') return response as Responses[V];
  check.text('resolver');
  if (verb === 'probe') check.models('options');
  if (verb === 'run') {
    if (typeof response.text !== 'string') throw new ContractError('the response has no text');
    check.oneOf('family', FAMILIES);
    if (response.model !== undefined && response.model !== null && typeof response.model !== 'string') {
      throw new ContractError('the response\'s model must be a string or null');
    }
    check.handle('handle', true);
  }
  if (verb === 'start') {
    check.handle('handle', true);
    if (response.handle === undefined || response.handle === null) {
      check.text('instructions');
      return { resolver: response.resolver, handle: null, instructions: response.instructions } as Responses[V];
    }
  }
  return response as Responses[V];
}

// The exit lets gives for a resolver's exit. A resolver's usage error (2) is
// a contract problem for lets, so it, a decline that reached here, and any
// other code are 4.
export function exitFor(resolverExit: number | null): number {
  const passedOn: number[] = [EXIT.ok, EXIT.noSession, EXIT.spawn, EXIT.session, EXIT.timeout];
  return resolverExit !== null && passedOn.includes(resolverExit) ? resolverExit : EXIT.spawn;
}

// Lowercase, kebab-case, a letter first, at most 32 characters.
export function normalizeName(raw: string): string {
  const trim = (s: string) => s.replace(/^[-_]+/, '').replace(/[-_]+$/, '');
  let name = trim(raw.toLowerCase().replace(/[^a-z0-9_-]+/g, '-'));
  if (!/^[a-z]/.test(name)) name = `x${name}`;
  return trim(name.slice(0, 32));
}

type Json = Record<string, unknown>;

const MODEL_FORMAT = `<family> or <family>/<id>, for a family of ${FAMILIES.join(', ')}`;

const preview = (text: string) => JSON.stringify(text.length > 200 ? `${text.slice(0, 200)}...` : text);

// The one JSON object in text.
function parseObject(text: string, what: string, fail: (message: string) => Error): Json {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw fail(`${what} is not JSON: ${preview(text)}`);
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw fail(`${what} is not a JSON object: ${preview(text)}`);
  return value as Json;
}

// Checks on the fields of a parsed object. Each throws fail(message) with a
// message that names the field.
function checker(object: Json, what: string, fail: (message: string) => Error) {
  const missing = (field: string) => object[field] === undefined;
  const bad = (field: string, expected: string) => fail(missing(field)
    ? `${what} has no ${field}`
    : `${what}'s ${field} must be ${expected}, got ${JSON.stringify(object[field])}`);
  const isHandle = (value: unknown) => typeof value === 'object' && value !== null && !Array.isArray(value)
    && typeof (value as Json).kind === 'string' && typeof (value as Json).id === 'string';

  return {
    text(field: string) {
      if (typeof object[field] !== 'string' || object[field] === '') throw bad(field, 'a non-empty string');
    },
    absolutePath(field: string) {
      if (typeof object[field] !== 'string' || !isAbsolute(object[field])) throw bad(field, 'an absolute path');
    },
    name(field: string) {
      const value = object[field];
      if (typeof value !== 'string' || value === '' || normalizeName(value) !== value) {
        throw bad(field, 'lowercase, a letter first, at most 32 characters');
      }
    },
    oneOf(field: string, values: readonly string[]) {
      if (!values.includes(object[field] as string)) throw bad(field, `one of ${values.join(', ')}`);
    },
    exactly(field: string, value: boolean) {
      if (object[field] !== value) throw bad(field, String(value));
    },
    boolean(field: string) {
      if (typeof object[field] !== 'boolean') throw bad(field, 'true or false');
    },
    wholeNumber(field: string) {
      if (!Number.isInteger(object[field]) || (object[field] as number) < 1) throw bad(field, 'a whole number of minutes');
    },
    model(field: string) {
      if (typeof object[field] !== 'string' || parseModel(object[field]) === null) throw bad(field, MODEL_FORMAT);
    },
    // A list of model strings, which may be empty.
    models(field: string) {
      const value = object[field];
      if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string' && parseModel(entry) !== null)) {
        throw bad(field, `a list of ${MODEL_FORMAT}`);
      }
    },
    // nullable: the field may be null or absent.
    handle(field: string, nullable: boolean) {
      if (nullable && (object[field] === undefined || object[field] === null)) return;
      if (!isHandle(object[field])) throw bad(field, 'an object with a string kind and id');
    },
  };
}
