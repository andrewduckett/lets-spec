## 1. One deadline, inside execFile

- [x] 1.1 [medium] The real `execFile` takes `timeoutMs`. When time runs out, it kills the child and resolves at once with `timedOut: true`, even when a child of the command keeps stdout open, as `sh -c '(sleep 30) & sleep 30'` does. A 200 ms deadline returns in under 10 seconds. Without `timeoutMs`, results are as before (verify: node --test tests/lets/io.test.ts) (✓ node --test tests/lets/io.test.ts passed)
- [x] 1.2 [medium] `callResolver` passes its deadline to `execFile` as `timeoutMs`, and a result with `timedOut: true` gives exit 6 with "did not answer <verb> in <time>, so it was stopped". The backstop test checks that `run` is given `timeoutMs` of `16 * 60000`, from `io.calls` (verify: node --test tests/lets/delegate/lookup.test.ts) (✓ node --test tests/lets/delegate/lookup.test.ts passed)
- [x] 1.3 [easy] `verify`'s `call` passes its deadline as `timeoutMs`, and a result with `timedOut: true` counts as `code: null` with "no answer in <n> seconds, so it was stopped". A new test in `verify.test.ts` queues such a result and sees the check fail with that message (verify: node --test tests/lets/delegate/verify.test.ts) (✓ node --test tests/lets/delegate/verify.test.ts passed)
- [x] 1.4 [easy] `lets/src/delegate/wait.ts`, the `Child` type, `ExecOptions.started` and `Io.sleep` are gone, and so are `killed`, `sleeps` and `sleep` in the delegate and sync fakes and `io.sleep = real.sleep` in `command-deps.ts`. The old `started` and `sleep` tests in `io.test.ts` go (verify: test ! -e lets/src/delegate/wait.ts && ! grep -rnE 'sleeps|killed|started\?\.|Io\.sleep|io\.sleep' lets/src tests/lets && pnpm check) (✓ the verify command passed)

## 2. One command wrapper [depends-on: 1]

- [x] 2.1 [medium] `guarded(deps, fn)` in `lets/src/delegate/guarded.ts` returns `fn`'s exit code. On an error that `exitCodeOf` knows, it prints `lets delegate: <message>` on stderr and returns that code; it rethrows any other error. A test covers all three cases (verify: node --test tests/lets/delegate/guarded.test.ts) (✓ node --test tests/lets/delegate/guarded.test.ts passed)
- [x] 2.2 [medium] `review run`, `handoff run` and `instructions` use `guarded`, and `handoff`'s catch no longer remaps exit codes. Their exit codes and messages do not change (verify: node --test tests/lets/delegate/review.test.ts tests/lets/delegate/handoff.test.ts tests/lets/delegate/instructions.test.ts tests/lets/delegate/cli.test.ts) (✓ the four test files passed)
- [x] 2.3 [easy] `LookupDeps` is `Pick<Deps, 'env' | 'io' | 'packageRoot' | 'nodePath'>` plus `cwd` and `config`, and the three commands pass `{ ...deps, cwd, config }` (verify: pnpm check && node --test tests/lets/delegate/lookup.test.ts tests/lets/delegate/review.test.ts tests/lets/delegate/handoff.test.ts tests/lets/delegate/instructions.test.ts) (✓ the verify command passed)

## 3. The review records --for [depends-on: 2]

- [x] 3.1 [medium] `lets delegate review run --for code` ends stderr with a JSON line that starts `{"for":"code",` and holds `resolver`, `family`, `model`, `independent`, `handle`, `gitClean` and `durationSeconds`; with `--for plan` it starts `{"for":"plan",`. `handoff run` output does not change (verify: node --test tests/lets/delegate/review.test.ts tests/lets/delegate/cli.test.ts) (✓ both test files passed)
- [x] 3.2 [easy] [parallel] `REVIEW_HELP` in `lets/src/cli.ts` lists `for` first among the stderr line's fields, and the meta-line sentence in `skills/lets-review-code/SKILL.md` and `skills/lets-review-plan/SKILL.md` says the line also names what the review was for (verify: grep -q 'one JSON line with for, resolver' lets/src/cli.ts && grep -q 'what the review was for' skills/lets-review-code/SKILL.md && grep -q 'what the review was for' skills/lets-review-plan/SKILL.md) (✓ the verify command passed)

## 4. Checks [depends-on: 3]

- [x] 4.1 [easy] The project's checks pass (verify: pnpm test && nix flake check) (✓ pnpm test and nix flake check passed)

## Deviations Ledger

- 1.1: On a timeout, `execFile` also destroys the child's stdout and stderr streams. Without that, a child of the command that keeps the pipes open holds the Node event loop, so `lets` cannot exit until that child does.
- 1.4: The lookup test name and message said the resolver was "killed", which the task's `grep` matches. They now say "stopped".
