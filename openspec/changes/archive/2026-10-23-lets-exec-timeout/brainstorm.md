## Story

#81 lets-exec-timeout — lets uses the kit's exec shape, one command wrapper, and records --for. https://github.com/sidereal-io/lets-spec/issues/81

## Decisions

The user handed every question in this brainstorm to the agent, and asked it to prefer the option that removes code. Rows marked `User` are the agent's recommendation, which the user accepted in advance.

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | Does the open blocker #80 stop this story? | No. #80 is built lower in this stack, so the code it touches is already on the base branch, `kit-owns-contract`. | User |
| D2 | Where does the deadline live? | In `io.execFile`. It takes `timeoutMs`, kills the child when time runs out, and returns `timedOut: true`, as the kit's `execFile` does. | Evidence: `contrib/resolver-kit/src/io.ts` |
| D3 | When a command cannot start, does `lets` switch to the kit's way and reject? | No. `lets` keeps `code: null`. `repoRoot`, `treeStatus`, `callResolver` and `verify` already read it, and a reject would add a `try` to each. | User |
| D4 | Does `lets` import the kit's `ExecResult` and `ExecOptions` types? | No. They differ on `code: null` (D3). `lets` keeps its own types and adds the same two fields, `timeoutMs` and `timedOut`. | User |
| D5 | What goes? | `lets/src/delegate/wait.ts`, `Child`, `ExecOptions.started`, `Io.sleep`, and the fakes' `killed`, `sleeps` and `sleep`, in both the delegate and the sync fakes. Nothing else in `lets` calls `sleep`. | Evidence: `grep` of `lets/src` and `tests/lets` |
| D6 | Do the timeout messages and exit codes change? | No. `callResolver` still gives exit 6 with "did not answer <verb> in <time>, so it was stopped". `verify`'s `call` still gives `code: null` with "no answer in <n> seconds". | User |
| D7 | Where does the shared command wrapper live? | In `lets`, not the kit. Its `errors.ts` moved to the kit under #78, and the kit does not know `lets`'s `Deps`. Design picks the file. | Evidence: `contrib/resolver-kit/src/errors.ts`, `lets/src/delegate/` |
| D8 | `handoff run` maps every caught error that is not usage to exit 4. Does the wrapper keep that? | No, it is dead code. Every error that can reach that `catch` is a `UsageError`, which `exitCodeOf` already maps to 2. The three commands share one plain wrapper, and exit codes do not change. | Evidence: `lets/src/delegate/handoff.ts`, `git.ts`, `prompt-file.ts`, `lookup.ts` |
| D9 | Where does `for` go in `review run`'s stderr JSON line? | As its first field, `"for": "<intent>"`, as `instructions` puts `for` near the front of its line. The other fields stay as they are. | User |
| D10 | Does `handoff run` record `--for` too? | No. Its stdout is the resolver's own response, and this story does not change it. `--for` stays mandatory on both `run` commands. | Evidence: issue #81 scope; epic #71 shared decisions |
| D11 | What else must say `for`? | `REVIEW_HELP` in `lets/src/cli.ts`, and the meta-line sentence in `skills/lets-review-code/SKILL.md` and `skills/lets-review-plan/SKILL.md`. | Evidence: issue #81 scope |
| D12 | How is it accepted? | A real-process test shows `timeoutMs` stops `sleep 30` and returns `timedOut`. The lookup and verify timeout tests pass through `timedOut`, not a fake timer. A review test shows `for` in the stderr line. `pnpm test` and `nix flake check` pass. | User |

## Changes from the story

- The wrapper does not go in `lets/src/delegate/errors.ts`, which no longer exists (D7).
- `handoff run`'s remapping of exit codes goes, as dead code (D8).

Confirmed by user: yes
