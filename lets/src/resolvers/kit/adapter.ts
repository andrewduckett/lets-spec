// What a resolver needs from its harness. Each resolver is one adapter,
// which makes sessions in one harness. lets delegate calls it in process.
// Also the names the adapters and lets delegate share about sessions.
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
  // The resolver's name in the config and in each command's output, such
  // as t3.
  name: string;
  // True when this process runs inside the adapter's harness. When false,
  // the resolver declines.
  detect(): boolean;
  // The models this harness can run now, in its own order. It never
  // chooses one: the caller does. warn adds a line to stderr.
  options(warn: (message: string) => void): Promise<ModelString[]>;
  // Runs a read-only session and waits for its final message. Throws
  // Refused when the harness says no before the model gives output, after
  // cleaning up what it made. An error after the session exists names it.
  run(input: RunInput, options: { timeoutMs: number }): Promise<{ handle: Handle; text: string }>;
  // Starts an interactive session and returns its handle, or the
  // instructions a person needs when it starts none. Throws Refused when
  // the harness says no. Without it, the resolver declines every handoff.
  start?(input: StartInput): Promise<Handle | { instructions: string }>;
  // Cleans up after a session it made, on ok. cwd is the repository.
  // Throws when it cannot.
  finish(handle: Handle, ok: boolean, options: { cwd: string }): Promise<void>;
};
