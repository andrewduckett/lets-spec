// The exit codes and the errors that map to them. run() in main.mjs catches
// only these classes; anything else is a bug and propagates.

export const EXIT = { ok: 0, usage: 2, noReviewer: 3, spawn: 4, reviewer: 5, timeout: 6, dirty: 7 };

export class UsageError extends Error {}
export class NoReviewerError extends Error {}
export class SpawnError extends Error {}
// The message is the reason the reviewer failed.
export class ReviewerFailed extends Error {}
export class TimeoutError extends Error {}
