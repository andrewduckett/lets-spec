## Story

#48 subagent-resolver — the built-in default becomes lets-delegate-subagent, built, shipped and run like the others.
https://github.com/andrewduckett/lets-spec/issues/48

## Decisions

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | Which ways of shipping `lets` carry `lets-delegate-subagent`? | All three: the release tarball, the Nix `lets` package, and the source tree that `lets/bin/lets` runs from. Each `lets` keeps a working default. | User |
| D2 | What name does it answer with, in `probe` and in its responses? | `subagent`. The `delegate-default` scenarios that expect `"resolver":"default"` change to `"subagent"`. | User |
| D3 | What happens when `lets` cannot run its own `lets-delegate-subagent`? | Exit 4. Stderr names the missing or broken file and says the `lets` install is incomplete. Reviews and handoffs stop and show it. | User |
| D4 | Does its behaviour change? | No. `probe` answers, `run` exits 3 with the same message, `start` saves the prompt to `.workspace/lets-delegate/<name>.prompt.md` and returns `handle` `null` with instructions, and `finish` exits 0 and prints nothing. | Evidence: #48 Scope; `lets/src/delegate/default-resolver.ts` |
| D5 | Where does it sit in the lookup, and can it decline? | Last, where the in-process default sits now, and it never declines. | Evidence: `lets/src/delegate/lookup.ts`; #48 Scope |
| D6 | Are the config list, the lookup order, and setup installing it under `$XDG_DATA_HOME/lets-delegate/` in scope? | No. The chain story and the setup story change them. | Evidence: #48 Scope (out); #46 Shared decisions |
| D7 | What does `pnpm conformance` check for the default? | The real `lets-delegate-subagent`. The fixture `tests/lets/delegate/fixtures/default-resolver`, which wraps the in-process code, goes. | Evidence: `package.json`; the fixture |
| D8 | Does ADR-001 still hold? | Yes. The default still starts no session and picks no family. Only where its code runs changes. | Evidence: `docs/decisions/ADR-001-default-delegate-starts-no-session.md` |
| D9 | Do the docs that say "the built-in default" change? | Yes. The README, `docs/resolver-contract.md` and the contrib READMEs name `lets-delegate-subagent` where they describe the default. | Assumption |

## Changes from the story

- **Added:** the Nix `lets` package and the source tree carry `lets-delegate-subagent` too, not only the release folder (D1). Without this, a Nix user's `lets delegate` would have no default.
- **Changed:** the resolver name in `probe` and in the handoff's JSON line becomes `subagent`, not `default` (D2).
- **Added:** what happens when `lets` cannot run its own resolver (D3). The story did not say, because the in-process default could not fail.
- **Cut:** the conformance fixture that wraps the in-process default (D7).

Confirmed by user: yes
