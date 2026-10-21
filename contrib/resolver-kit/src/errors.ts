// Copied from lets/src/delegate/errors.ts, so each resolver installs on its own.
// Keep the two the same: a test compares them, and the conformance check runs
// against each resolver in CI.

// The exit codes of lets delegate, and the errors that map to them. A command
// catches only these classes; anything else is a bug and propagates.

export const EXIT = { ok: 0, usage: 2, noSession: 3, spawn: 4, session: 5, timeout: 6, dirty: 7 } as const;

// The command line or a request is malformed. A resolver exits 2 with it.
export class UsageError extends Error {}
// A resolver broke the contract: a bad response, a bad exit code.
export class ContractError extends Error {}
// No fresh session can run here: no resolver started one, or none of its
// families is available.
export class NoFamilyError extends Error {}
// The harness refused to start the session.
export class SpawnError extends Error {}
// The session started and failed: an error, it stopped to ask, an empty
// final message. The message is the reason.
export class SessionFailed extends Error {}
// The session did not finish in time.
export class TimeoutError extends Error {}

// The exit code for one of the errors above, or null for any other error.
export function exitCodeOf(error: unknown): number | null {
  if (error instanceof UsageError) return EXIT.usage;
  if (error instanceof NoFamilyError) return EXIT.noSession;
  if (error instanceof ContractError || error instanceof SpawnError) return EXIT.spawn;
  if (error instanceof SessionFailed) return EXIT.session;
  if (error instanceof TimeoutError) return EXIT.timeout;
  return null;
}
