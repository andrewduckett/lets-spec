// The error lets sync reports to the user: their setup or the release is
// wrong, not lets. run() prints its message and exits 1.

export class UsageError extends Error {}
