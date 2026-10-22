// Copied from lets/src/delegate/errors.ts, so each resolver installs on its own.
// Keep the two the same: a test compares them, and the verify check runs
// against each resolver in CI.

// The exit codes of lets delegate, and the errors that map to them. A command
// catches only these classes; anything else is a bug and propagates.

export const EXIT = { ok: 0, usage: 2, noSession: 3, spawn: 4, session: 5, timeout: 6, dirty: 7 } as const;

// The command line or a request is malformed. A resolver exits 2 with it.
export class UsageError extends Error {}
// A resolver broke the contract: a bad response, a bad exit code.
export class ContractError extends Error {}
// No fresh session can run here: the harness or the account said no before
// the model gave any output. The harness is not running or not set up,
// there are no tokens left, or it cannot run the model.
export class Refused extends Error {}
// A resolver bug, a broken contract, or an outcome the resolver cannot know,
// such as no reply from the harness.
export class SpawnError extends Error {}
// The session started and failed: an error, it stopped to ask, an empty
// final message. The message is the reason.
export class SessionFailed extends Error {}
// The session did not finish in time.
export class TimeoutError extends Error {}

// The exit code for one of the errors above, or null for any other error.
export function exitCodeOf(error: unknown): number | null {
  if (error instanceof UsageError) return EXIT.usage;
  if (error instanceof Refused) return EXIT.noSession;
  if (error instanceof ContractError || error instanceof SpawnError) return EXIT.spawn;
  if (error instanceof SessionFailed) return EXIT.session;
  if (error instanceof TimeoutError) return EXIT.timeout;
  return null;
}
