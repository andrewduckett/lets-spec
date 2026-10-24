// What a resolver needs from its harness. Each program has one adapter,
// which makes sessions in one harness; resolver.ts turns protocol verbs into
// these calls.
import type { Effort, Family } from './families.ts';

// A session a resolver made. kind says what it is, such as thread, tab or
// process. An adapter may add fields; lets passes the handle back whole.
export type Handle = { kind: string; id: string; [field: string]: unknown };

// The model a session runs, as <family> or <family>/<id>. A bare family is
// the harness's own default model for that family.
export type ModelString = string;

// How long a review may run, in minutes, for each effort.
export const DEFAULT_TIMEOUT_MINUTES: Record<Effort, number> = { low: 15, medium: 15, high: 45 };

// A session's name: lowercase, kebab-case, a letter first, at most 32
// characters.
export function normalizeName(raw: string): string {
  const trim = (s: string) => s.replace(/^[-_]+/, '').replace(/[-_]+$/, '');
  let name = trim(raw.toLowerCase().replace(/[^a-z0-9_-]+/g, '-'));
  if (!/^[a-z]/.test(name)) name = `x${name}`;
  return trim(name.slice(0, 32));
}

// The request for a read-only session, whose final message the resolver
// waits for. A null model is the harness's default for the family.
export type RunInput = { name: string; prompt: string; cwd: string; family: Family; model: string | null; effort: Effort };
// The request for an interactive session, which the resolver returns at once.
export type StartInput = Omit<RunInput, 'effort'>;

export type Adapter = {
  // What probe answers, such as t3.
  name: string;
  // The program's own name, which starts each line it prints on stderr.
  program: string;
  // The harness, as the decline message names it, such as T3 Code.
  harness: string;
  // The one kind of handle this adapter makes, such as thread.
  handleKind: string;
  // True when this process runs inside the adapter's harness.
  detect(): boolean;
  // Why this process declines, when detect() is false and the adapter can
  // say more than "not inside <harness>".
  whyDeclined?(): string;
  // The models this harness can run now, in its own order. It never
  // chooses one: the caller does. warn adds a line to stderr.
  options(warn: (message: string) => void): Promise<ModelString[]>;
  // Runs a read-only session and waits for its final message. Throws
  // Refused when the harness says no before the model gives output, after
  // cleaning up what it made. An error after the session exists names it.
  run(input: RunInput, options: { timeoutMs: number }): Promise<{ handle: Handle; text: string }>;
  // Starts an interactive session and returns its handle, or the
  // instructions a person needs when it starts none. Throws Refused when
  // the harness says no. Without it, the kit declines start, and a probe for it.
  start?(input: StartInput): Promise<Handle | { instructions: string }>;
  // Cleans up after a session on ok. cwd is the finish request's folder.
  // Throws when it cannot.
  finish(handle: Handle, ok: boolean, options: { cwd: string }): Promise<void>;
};
