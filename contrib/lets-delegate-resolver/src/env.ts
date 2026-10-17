// Copied from lets/src/delegate/env.ts, so this resolver installs on its own.
// Keep the two the same: a test compares them, and the conformance check runs
// against this resolver in CI.

// The variables that tie a process to the session that started it. A new
// session must not inherit them, or it would think it is a child session.

export const SESSION_MARKERS = ['CLAUDE_CODE_CHILD_SESSION', 'CLAUDE_CODE_SESSION_ID',
  'CLAUDE_CODE_BRIDGE_SESSION_ID', 'CLAUDE_CODE_MESSAGING_SOCKET', 'CLAUDE_CODE_MESSAGING_TOKEN',
  'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_PID', 'CLAUDE_EFFORT', 'CLAUDECODE'];

export type Env = Record<string, string | undefined>;

// A copy of env without the session markers.
export function scrubbedEnv(env: Env): Env {
  const copy = { ...env };
  for (const name of SESSION_MARKERS) delete copy[name];
  return copy;
}
