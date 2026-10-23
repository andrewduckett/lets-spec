## Context

- `lets/src/io.ts` `execFile` has no deadline. It passes the child process to an optional `started` callback, so a caller can kill it.
- `lookup.ts callResolver` and `verify.ts call` each race `execFile` against `withTimeout` from `lets/src/delegate/wait.ts`, which waits on `Io.sleep`. When the sleep wins, they kill the child through `started`. Nothing else in `lets` uses `Io.sleep`.
- The test fakes record `sleeps` and `killed` so the lookup tests can see the race. The sync fake has a `sleep` only because `Io` requires one.
- `contrib/resolver-kit/src/io.ts` `execFile` takes `timeoutMs`, starts a timer, kills the child when it fires, and resolves with `timedOut: true`. It rejects when the command cannot start. `lets` resolves with `code: null` instead (brainstorm D3).
- `review.ts`, `handoff.ts` and `instructions.ts` each catch an error, map it with `exitCodeOf`, print `lets delegate: <message>`, and rethrow anything `exitCodeOf` does not know. Each builds `LookupDeps` by copying four fields from `deps`.
- `cli.ts` takes `--for` on `review run` and `handoff run` and discards it as `_intent`.

## Goals / Non-Goals

**Goals:**

- One deadline, inside `execFile`, with the kit's option and result fields.
- One error wrapper for the three commands.
- `review run` records `for`.

**Non-Goals:**

- Changing the kit, or importing its `Io` or exec types into `lets`.
- Changing any exit code or message.
- Using the wrapper in `verify` or `sync`, which handle errors their own way.

## Test Seams

- **Primary test seam:** the delegate command tests, through `commandDeps` in `tests/lets/delegate/fixtures/command-deps.ts`. It runs the real fake resolver as a real process, so a deadline there is real. The review tests read the stderr JSON line through it.
- **Existing seams reused:** `tests/lets/io.test.ts` for the real `execFile`; `fakeIo` in `tests/lets/delegate/fixtures/fake-io.ts` for `callResolver` and `resolve`, where a queued result with `timedOut: true` stands for a deadline.

## Scrutiny Tier & Blast Radius

- **Tier:** medium
- **Blast radius:** `lets` only: its `Io` type, the real `execFile`, the resolver lookup, `verify`, and the three delegate commands. A mistake in the deadline could leave a resolver running, or stop one too early. No contract with resolvers changes. The stderr line gains one field.

## Decisions

1. **`execFile` owns the deadline, as in the kit.** `ExecOptions` loses `started` and gains `timeoutMs?: number`. `ExecResult` gains `timedOut?: boolean`. The real `execFile` copies the kit's timer: set it after the child starts, `child.kill()` and set `timedOut` when it fires, clear it in the exit callback. When the command cannot start, it still resolves `{ stdout: '', stderr, code: null }`. *Alternative:* import the kit's `execFile`. Rejected: it rejects on a failed start (D3), and its `Io` carries fields `lets` does not have.
2. **Callers read `timedOut` first.** `callResolver` passes `timeoutMs` to `execFile`. When `result.timedOut`, it returns exit 6 with the message it gives today. `verify`'s `call` does the same, and returns `code: null` with its message today. The `Child` type, `ExecOptions.started`, `Io.sleep` and `wait.ts` are deleted.
3. **The fakes lose the race.** `fakeIo` drops `killed`, `sleeps` and `sleep`. A test that needs a deadline queues `{ ..., timedOut: true }`, and checks the `timeoutMs` it was given in `io.calls`. The backstop test checks that `timeoutMs` is `16 * 60000`. `commandDeps` drops `io.sleep = real.sleep` and its `started` call; it already passes `opts`, so `timeoutMs`, to the real `execFile`. The sync fake drops `sleep`.
4. **The wrapper is `guarded(deps, fn)` in a new file, `lets/src/delegate/guarded.ts`.** It runs `fn`, returns its exit code, and on an error `exitCodeOf` knows, prints `lets delegate: <message>` and returns that code. It rethrows any other error. `deps` needs only `stderr`. `review.ts`'s outer `run`, `handoff.ts` and `instructions.ts` call it. `handoff.ts` keeps mapping an *outcome* that is not ok to 3 or 4, but its `catch` remapping goes (D8). *Alternative:* put it in `lookup.ts`, which all three import. Rejected: lookup is about finding a resolver, not about how a command fails.
5. **`LookupDeps` is a slice of `Deps`.** `LookupDeps = Pick<Deps, 'env' | 'io' | 'packageRoot' | 'nodePath'> & { cwd: string; config: Config | null }`. Each command passes `{ ...deps, cwd, config }`. The tests' object literals still fit the type.
6. **`for` reaches `review`.** `ReviewOptions` gains `for: Intent`. `cli.ts` passes it through for `review run`, and keeps discarding it for `handoff run` (D10). `review.ts` writes `{ for, resolver, family, model, independent, handle, gitClean, durationSeconds }`, `for` first (D9). `REVIEW_HELP` names `for` first in its list. Each review skill's meta-line sentence says the line also names what the review was for.

None of these is costly to reverse, so none needs an ADR.

## Risks / Trade-offs

- [The timer fires after the child has exited, and kills a reused process ID] → The exit callback clears the timer, as in the kit, and `child.kill()` on an exited child does nothing in Node.
- [A test that waits on a real deadline is slow or flaky] → The real-process tests use a 200 ms deadline against `sleep 30`, and assert the call returns in well under 10 seconds, as the lookup test does today.
- [Dropping `Io.sleep` breaks a caller missed by the search] → The type check in `pnpm test` fails on any remaining use.

## Migration & Rollback

N/A. Nothing changes shape outside `lets`. Rollback is reverting the branch.
