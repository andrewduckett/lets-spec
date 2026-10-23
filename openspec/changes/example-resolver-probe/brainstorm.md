**Why:** The example resolver that authors copy answers a probe for `start` and then declines `start`, so a handoff names one resolver and another runs it, and `lets delegate verify` cannot see this because it only probes for `run`.

## Story

#73 example-resolver-probe — the sh example declines a probe for start, and verify checks for it
https://github.com/sidereal-io/lets-spec/issues/73

## Decisions

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | How does the script decline a probe for `start`? | `probe` exits 75 with nothing on stdout when the request's `verb` is `start`, with the stderr of its `start` case: `headless-resolver: this resolver only runs headless` | Evidence: #73 Scope; `contrib/headless-resolver:38` |
| D2 | Does the contract's embedded copy change too? | Yes, it stays identical to the script | Evidence: `tests/skill-interfaces.bats` pins the two equal |
| D3 | What does the shape check (no `--live`) add? | A second probe with `verb: 'start'`; it passes on a valid `{ resolver, options }` answer or a silent 75. The existing probe for `run` stays | Evidence: #73 Scope; `lets/src/delegate/verify.ts:62-65` |
| D4 | How does `--live` report a resolver that declines `start` but answered its probe? | On its own check line, printed on every `--live` run; it fails only when `start` exits 75 and the probe for `start` exited 0 | User |
| D5 | Which model does the `--live` `start` request name? | The first option from the probe for `start`; `claude` when that probe declined or listed none | User |
| D6 | Does a resolver that declines the probe for `start` but answers `start` fail? | No; the contract states no such rule, so `verify` does not check it | Assumption |
| D7 | Do the TypeScript resolvers change? | No; the kit already declines a probe for a verb its adapter does not take | Evidence: `contrib/resolver-kit/src/resolver.ts:25-26` |
| D8 | Does the contract's prose about `verify` change? | Yes: it says the example declines a probe for `start`, and that `--live` fails a resolver that declines `start` but answers its probe | Assumption |
| D9 | Does the double meaning of `run` (a `lets` command and a protocol verb) change here? | No; ADR-007 accepted it. It is filed as #85 | User |

## Changes from the story

- Added: the `--live` `start` request names the first option from the probe for `start`, not the probe for `run` (D5).
- Filed separately: renaming the protocol verbs so `run` no longer means both a `lets` command and a protocol verb, as #85, to build after epic #71. It is not part of this story.

Confirmed by user: yes
