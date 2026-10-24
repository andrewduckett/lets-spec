## Story

#112 resolver-specs-by-command — every t3 and cli adapter behaviour is specified and tested through `lets delegate`.
https://github.com/sidereal-io/lets-spec/issues/112

## Decisions

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | Is this one story, or should it split? | One story. The packet's Scope, Kept, Deleted and Won't lists stand. It moves rules and tests, with no behaviour change and no new requirement. | User |
| D2 | Which requirements move, and which stay? | The 16 the packet's Scope item 1 names move to a new capability, `delegate-resolvers`. The 7 in Scope item 2 stay in `resolvers` for the deletion story. The `subagent` requirements stay in `delegate-default`, and `delegate-config` is not changed. | User |
| D3 | How is a scenario restated? | Through a `lets delegate` command (`review run`, `review instructions`, `handoff run` or `handoff instructions`) with that resolver's name in the config's `resolvers`. Each keeps what it asserts, in the command's own outputs. | User |
| D4 | Where does each field of a program's answer show at the command level? | `options` is the `options` of `instructions`. A review's final message is `review run`'s stdout. `family`, `model` and `handle` are fields of the review's JSON line on stderr. A warning is a `lets delegate:` line on stderr. A refusal is a `<model>: <reason>` line on stderr, with exit 3. | Evidence: `lets/src/delegate/review.ts`, `instructions.ts` |
| D5 | What does a decline become? | The next name in the chain answers, or the command exits 2 when every name declines. `lets` prints no decline reason, so the scenarios assert the decline and that nothing started, not the program's stderr text, such as `lets-delegate-cli: none of codex, claude or agy is on PATH`. | Evidence: `lets/src/delegate/lookup.ts` `pick` prints nothing |
| D6 | Do any two requirements merge? | One merge. *The cli resolver declines a probe for start* folds into *The cli resolver declines every handoff*. At the command level both say that a handoff skips `cli` and runs nothing. Its "probe for a review" scenario repeats *One resolver runs every family CLI on PATH*. The delta says so. No other merge. | User |
| D7 | Does any requirement's wording have to change beyond the restatement? | Only where the program's words become false. *A refusal exits 3* keeps exit 4 for "the outcome is unknown", such as no reply from T3. It drops "a request they cannot read" and "a broken contract": there is no request to read in process, and epic #110 retired the contract meaning of exit 4. | Evidence: #110 Shared decisions, exit 4 |
| D8 | How is the move written as a delta? | The `resolvers` delta lists each moved requirement under REMOVED, with a Reason and a Migration that name `delegate-resolvers`. The `delegate-resolvers` delta lists them under ADDED. `resolvers` keeps 7 requirements, so it is not retired. | Evidence: archived `2026-10-23-resolvers-capability` |
| D9 | What do the tests do? | Each case in `tests/lets/resolvers/t3/resolver.test.ts` and `cli/resolver.test.ts` gets one twin that runs a `lets delegate` command, with the real adapter on the kit's fake io. A case with no meaning at the command level moves to the adapter itself. Then both `resolver.test.ts` files go. `t3.test.ts` and `cli.test.ts` stay as they are. | User |
| D10 | Which cases have no command-level twin? | Three. *finish removes nothing for a process handle whose id is not a session name* calls the cli adapter's `finish` directly, because the chain only finishes handles the adapter made. *finish refuses a handle of another kind* is a rule that stays in `resolvers`; `kit/resolver.test.ts` checks it for any adapter, so each adapter's test checks only its `handleKind`. *a run with no model* is a rule that stays in `resolvers`; at the command level, `review.test.ts` already checks that a bad or missing `--model` asks no resolver. | User |
| D11 | Do moved scenarios that only `t3.test.ts` or `cli.test.ts` test get new tests? | No. Those unit tests stay and still check them, such as the token path and the manifest order. Verify maps each scenario to its test. | User |
| D12 | How is it accepted? | `openspec validate --strict` passes. A rehearsed archive writes `delegate-resolvers` with the 15 requirements and leaves exactly 7 in `resolvers`. A check shows that each moved scenario keeps its assertions. No file under `tests/lets/resolvers/t3/` or `cli/` imports `protocol.ts` or `resolver.ts`. `lets/src/resolvers/` is unchanged. `pnpm test` and `nix flake check` pass. | User |
| D13 | Does the story touch the glossary? | No. The project has no glossary file, and no term here needs one. | Evidence: `openspec/glossary.md` is absent |

## Changes from the story

- Merged: *The cli resolver declines a probe for start* into *The cli resolver declines every handoff* (D6), as the packet allows. So `delegate-resolvers` holds 15 requirements, not 16.
- Changed: *A refusal exits 3* loses two words of program detail from its exit 4 sentence (D7).
- Added: none.

Confirmed by user: yes
