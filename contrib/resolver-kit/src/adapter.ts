// What a resolver needs from its harness. Each program has one adapter,
// which makes sessions in one harness; resolver.ts turns protocol verbs into
// these calls.
import type { Available } from './families.ts';
import type { Effort, Family, Handle } from './protocol.ts';

// run: read-only, and the resolver waits for the final message.
// start: interactive, and the resolver returns at once.
export type SpawnRequest = {
  kind: 'run' | 'start';
  name: string;
  prompt: string;
  cwd: string;
  family: Family;
  model: string | null;
  effort: Effort | null;
  readOnly: boolean;
};

// A session this process made. handle is what goes back to lets; the rest
// is what waitForResult needs in this process.
export type Session = { handle: Handle; [field: string]: unknown };

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
  availableFamilies(options: { effort: Effort }): Available;
  // Why a family is not available here, when the adapter can say more than
  // that it is not.
  whyNot?(family: Family): string;
  spawn(request: SpawnRequest): Promise<Session>;
  waitForResult(session: Session, options: { timeoutMs: number }): Promise<{ text: string }>;
  // Cleans up after a session on ok. Throws when it cannot.
  finish(handle: Handle, ok: boolean): Promise<void>;
};
