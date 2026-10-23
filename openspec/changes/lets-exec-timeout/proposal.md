## Why

`lets` runs a resolver through an `execFile` that has no deadline. It builds the deadline around it instead: a separate wait helper, a callback that hands back the child process, and a kill, written out twice. The resolver kit already has the simpler shape, with tests: `execFile` takes a deadline and stops the command itself. The three `lets delegate` commands also repeat one error wrapper, and `review run` throws away its mandatory `--for`, which epic #71 decided should be recorded (C8).

## What Changes

- `io.execFile` in `lets` takes `timeoutMs`. When time runs out, it stops the command and returns `timedOut: true`, as the kit's does (D2). A command that cannot start still returns `code: null` (D3, D4).
- `callResolver` and `verify` pass their deadline to `execFile` and read `timedOut`. Their messages and exit codes do not change (D6).
- Removed: `lets/src/delegate/wait.ts`, the `Child` type, `ExecOptions.started`, `Io.sleep`, and the test fakes' `killed`, `sleeps` and `sleep` (D5).
- `review run`, `handoff run` and `instructions` share one error wrapper in `lets` (D7). `handoff run`'s extra remapping of exit codes goes, because it never changes a code (D8). The lookup's dependencies are built from the command's own `deps`, not copied field by field.
- `lets delegate review run` puts `for`, the intent `--for` gives, first in its JSON line on stderr (D9). `REVIEW_HELP` and the two review skills say so (D11). `handoff run` does not change (D10).

No change is breaking. Every exit code stays as it is.

## Capabilities

### New Capabilities

- `delegate-review`: what `lets delegate review run` records on stderr about a review, including what the review was for.

### Modified Capabilities

None. The deadline and the wrapper change only how `lets` works, not what it does.

## Impact

- Code: `lets/src/io.ts`, `lets/src/delegate/lookup.ts`, `verify.ts`, `review.ts`, `handoff.ts`, `instructions.ts`, `lets/src/cli.ts`. `lets/src/delegate/wait.ts` is deleted.
- Tests: `tests/lets/io.test.ts`, `tests/lets/delegate/fixtures/fake-io.ts`, `command-deps.ts`, `tests/lets/sync/fixtures/fake-io.ts`, and the lookup, verify and review tests.
- Skills: `skills/lets-review-code/SKILL.md` and `skills/lets-review-plan/SKILL.md`. They reach projects, and this repository's own copies, at the next release.
- No dependency changes. The kit is not changed.
