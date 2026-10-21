// What the resolver needs from a harness. Each adapter makes sessions in
// one harness; resolver.ts turns protocol verbs into these calls.
import type { Available } from 'resolver-kit/families.ts';
import type { Effort, Family, Handle } from 'resolver-kit/protocol.ts';

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
  name: string;
  // True when this process runs inside the adapter's harness.
  detect(): boolean;
  availableFamilies(options: { effort: Effort }): Available;
  // Why a family is not available here, when the adapter can say more than
  // that it is not.
  whyNot?(family: Family): string;
  spawn(request: SpawnRequest): Promise<Session>;
  waitForResult(session: Session, options: { timeoutMs: number }): Promise<{ text: string }>;
  // Cleans up after a session on ok. Throws when it cannot.
  finish(handle: Handle, ok: boolean): Promise<void>;
};
