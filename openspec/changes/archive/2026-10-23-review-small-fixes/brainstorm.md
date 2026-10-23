**Why:** The 2026-10-22 review (#70) found three small bugs where the code breaks a promise the docs make: `lets sync` can write files and then exit 1, the t3 token ignores `XDG_CONFIG_HOME`, and a git failure after a review reports "the tree changed". Each is cheap to fix now, before the README rewrite under #71 describes this behaviour.

## Story

#74 review-small-fixes — sync checks before it writes, the t3 token follows XDG, a git failure exits 4: https://github.com/sidereal-io/lets-spec/issues/74

## Decisions

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | Which findings does this change close? | C12, C14 and C18. C11 moved to #19. | Evidence: #71 Shared decisions, #74 body |
| D2 | C12: where does the unowned-path check run? | Call `releasePaths({ release, io })` right after `requireRelease` at the top of `steps` in `lets/src/sync/main.ts`, so the check runs before any write, in both `lets sync` and `lets sync --check`. | Evidence: `lets/src/sync/main.ts:44-47`, `managed.ts:20`, #70 C12 |
| D3 | C12: what does the user see? | The same as today: `error: <release> ships <path>, which lets sync does not own.` and exit 1. The only change is that nothing is written first. | Evidence: `lets/src/sync/main.ts:24-31` |
| D4 | C12: does the README need an edit? | No. "It changes nothing when it exits with any other code" (README.md:777) becomes true. | Evidence: README.md:776-777 |
| D5 | C12: is it recorded in a spec? | Yes: a new requirement on `lets-sync` saying a release that ships a path `lets sync` does not own changes nothing. | Evidence: openspec/specs/lets-sync has no such requirement |
| D6 | C14: where does the token go? | `$XDG_CONFIG_HOME/lets-delegate/t3-token` when `XDG_CONFIG_HOME` is set and not empty, otherwise `~/.config/lets-delegate/t3-token`. This is the same rule as `configPath` in `lets/src/delegate/config.ts`. | Evidence: `lets/src/delegate/config.ts:23-25`, `contrib/t3-resolver/src/t3.ts:31,199` |
| D7 | C14: what happens to a token saved at the old path? | Nothing. The resolver reads only the new path, and issues a fresh token when nothing is there. The old file expires within 30 days. | User |
| D8 | C14: what does the t3 README say? | Where the token lives under both rules, and that `T3CODE_HOME` sets the T3 base directory the resolver reads and issues tokens against. | Evidence: `contrib/t3-resolver/README.md:124`, #70 D10 table |
| D9 | C14: is it recorded in a spec? | Yes: a new requirement on `contrib-resolvers` for where `lets-delegate-t3` keeps its token. | Evidence: openspec/specs/contrib-resolvers has no token requirement |
| D10 | C18: what does `review run` return when `git status` fails after the session? | Exit 4 (`EXIT.spawn`, "outcome unknown"), not 7 (`EXIT.dirty`, "the session changed files"). The stderr message and the call to finish the session stay as they are. | Evidence: `lets/src/delegate/review.ts:57-65`, `lets/src/cli.ts:113-117` |
| D11 | C18: is it recorded in a spec? | No. A test covers it; the help text already defines exit 4. | User |
| D12 | How is each fix tested? | Each fix gets a failing test first: a sync test that no file is written, t3 tests for both token paths, and a review test for the git failure. | Evidence: #74 body, `tests/lets/sync/main.test.ts`, `tests/t3-resolver/t3.test.ts`, `tests/lets/delegate/review.test.ts` |

## Changes from the story

None.

Confirmed by user: yes
