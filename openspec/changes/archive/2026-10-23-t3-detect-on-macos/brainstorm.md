**Why:** On macOS, which has no `/proc`, `lets-delegate-t3` cannot follow its parent processes, so it declines inside T3 Code even though the flake builds it for `aarch64-darwin`.

## Story

#72 t3-detect-on-macos — lets-delegate-t3 detects T3 Code on macOS, https://github.com/sidereal-io/lets-spec/issues/72

## Decisions

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | What does the fallback do? | Read `/proc/<pid>/status` first. Run `ps -o ppid= -p <pid>` only when `/proc/self` does not exist. Return `null` for output that is not a number. This is the same as `lets/src/io.ts:156-161`. | Evidence: `lets/src/io.ts` |
| D2 | Does `isAncestor` or `detect` change? | No. Only the kit's `parentPid` changes. | Evidence: `contrib/t3-resolver/src/t3.ts` |
| D3 | Is the unit test with a fake `ps` enough to close the issue? | Yes. The pull request says the fix has not been run on a Mac. | User |
| D4 | How does the test swap in a fake `spawnSync`? | `io.ts` exports a standalone `parentPid(pid, sys)` that defaults to the real `readFileSync`, `existsSync` and `spawnSync`. `realIo().parentPid` calls it. | User |
| D5 | Where does the t3 README say macOS is supported? | One line in *Install it*, next to the Node version: "It runs on Linux and macOS." | User |
| D6 | Does the spec change? | Yes. Add a scenario under "T3 Code has its own resolver": `probe` on a system with no `/proc`, where `ps` gives the parent processes, still answers `t3`. | User |
| D7 | Does the unused copy in `lets/src/io.ts` go? | No. The dead-code chore deletes it. | Evidence: #72 Scope |

## Changes from the story

None.

Confirmed by user: yes
