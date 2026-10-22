**Why:** `lets-delegate-herdr` answers only inside herdr, so a plain terminal with `codex`, `claude` or `agy` on PATH falls through to `lets-delegate-subagent` and gets no real review; one resolver for every family CLI on PATH fixes that, and the rest of the epic (#58) builds on its name.

## Story

#57 cli-resolver — herdr becomes lets-delegate-cli, one resolver for every family CLI on PATH.
https://github.com/andrewduckett/lets-spec/issues/57

## Decisions

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | Without the herdr check, how does it run a session? | Headless, as a child process of the family's CLI. It revives the argv of the old built-in default (`codex exec -s read-only …`, `claude -p --permission-mode plan …`, `agy --mode plan … -p`) and adds the model flags from herdr's `agentArgs`. The herdr tab code goes. The handle has kind `process`. `finish` removes the session's scratch files in `.workspace/lets-delegate/` when the session ended ok. | User |
| D2 | Where does it sit in the chain? | The docs and the README's example config list harness resolvers first, then `lets-delegate-cli`, then `lets-delegate-subagent`. `lets` does not enforce the order; the setup story writes it. | User |
| D3 | Do the stale packets change? | Yes. #46's Shared decisions now name `lets-delegate-cli`. #44 was deleted, so there was nothing to edit. | User |
| D4 | Do the old name and binary keep working? | No. It is a clean break, with no alias. `nix build .#lets-delegate-herdr` fails. The README's "Switching from lets-delegate-resolver" table names `lets-delegate-cli`, and there is no separate note on switching from herdr. | User |
| D5 | What name does it answer with? | `cli`, in `probe` and in its responses. | Evidence: #58 |
| D6 | When does it answer, and when does it decline? | It answers when at least one of `codex`, `claude` or `agy` is on PATH. Otherwise `probe` and `run` exit 75 with nothing on stdout. | Evidence: #57 |
| D7 | What does the decline say? | `lets-delegate-cli: none of codex, claude or agy is on PATH`. The kit lets an adapter give its own reason; `lets-delegate-t3` keeps `not inside T3 Code`. | Assumption |
| D8 | What does `start` do? | It declines with exit 75 and nothing on stdout, and stderr says `lets-delegate-cli: this resolver only runs headless`, as `contrib/headless-resolver` does. A handoff falls through to the next resolver. | Evidence: #57; `contrib/headless-resolver` |
| D9 | What does the kit need for headless runs? | The kit's `execFile` gains stdin input and a timeout that kills the child. A timeout is a `TimeoutError`, a CLI that cannot start is a `SpawnError`, and a non-zero exit or empty text is `SessionFailed`, as in the old default. | Assumption; old default in `git show 41b65b8^:lets/src/delegate/default-resolver.ts` |
| D10 | How does `run` choose and explain families? | Only families whose CLI is on PATH are available. A skipped reviewer reads `<cmd> is not on PATH`, as in herdr today. | Evidence: `contrib/herdr-resolver/src/herdr.ts` |
| D11 | The live check fails any resolver that declines `start`. Does that change? | Yes. In `--live`, a `start` that exits 75 passes, with a note that the next resolver answers handoffs. | User |
| D12 | Does `lets delegate conformance` keep its name? | No. It becomes `lets delegate verify`, and `pnpm conformance` becomes `pnpm verify`, with no alias. Archived changes and ADRs keep the old word, as history. | User |
| D13 | How do the tests and checks follow? | The tests move to `tests/cli-resolver/`. The release-build test checks that the bundle, run alone with none of the CLIs on PATH, declines. The flake check expects the D7 decline, since the Nix sandbox has none of the CLIs. | Assumption |
| D14 | What else names herdr? | The README, `docs/resolver-contract.md`, the contrib READMEs and the `delegate-config` scenarios that say "the resolver runs in herdr" follow. The ADRs stay as they are. | Assumption |

## Changes from the story

- **Changed:** sessions run headless, not in herdr tabs (D1). The story drops the herdr check, and without herdr there are no tabs to open.
- **Added:** the kit lets an adapter give its own decline reason, and its `execFile` gains stdin input and a timeout (D7, D9). The headless argv needs both.
- **Added:** `lets delegate verify --live` passes a declined `start` (D11). Without it, the live check always fails `lets-delegate-cli`.
- **Added:** `lets delegate conformance` becomes `lets delegate verify` (D12). The rename touches the same files as this story, so a separate pull request would conflict with it.
- **Packets:** #46's Shared decisions now name `lets-delegate-cli` (D3).

Confirmed by user: yes
