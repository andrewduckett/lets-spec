## 1. The config file

- [x] 1.1 [easy] One function names the `lets` config folder, `$XDG_CONFIG_HOME/lets` when the variable is set and not empty, else `~/.config/lets`. `lets delegate` reads `config.yaml` there, and `t3` reads and writes `t3-token` there. The `CONFIG` and `HOME_CONFIG` fixtures, `cli.test.ts`'s config writer and the token paths in `tests/lets/resolvers/t3/` follow (design: *One function names the config folder*) (verify: `node --test tests/lets/delegate/config.test.ts tests/lets/delegate/cli.test.ts tests/lets/resolvers/t3/*.test.ts`) (✓ node --test tests/lets/delegate/config.test.ts tests/lets/delegate/cli.test.ts tests/lets/resolvers/t3/*.test.ts passed, 102 tests)
- [x] 1.2 [complex] A `version: 3` config's `delegate.resolvers` is the chain. A file with no `delegate`, a null `delegate`, or no `delegate.resolvers` gets the default `subagent`. A `version: 2` file exits 2 and says the version must be `3`. A `delegate` that is not a mapping, or a `delegate.resolvers` that is not a list, exits 2 naming the key. Unknown keys at the top level and under `delegate` are ignored. Every test that writes config text uses the new shape: the files design.md lists under *Tests change their text, not their structure* (verify: `pnpm check && node --test tests/lets/delegate/*.test.ts tests/lets/resolvers/*/delegate.test.ts`) (✓ pnpm check && node --test tests/lets/delegate/*.test.ts tests/lets/resolvers/*/delegate.test.ts passed, 160 tests)
- [x] 1.3 [easy] A `config.json` beside a missing `config.yaml` is not read and stops nothing: the command asks the default. The tests of the old refusal go with it (verify: `node --test tests/lets/delegate/config.test.ts tests/lets/delegate/handoff.test.ts`) (✓ node --test tests/lets/delegate/config.test.ts tests/lets/delegate/handoff.test.ts passed, 38 tests)

## 2. Guidance [depends-on: 1]

- [x] 2.1 [medium] `lets delegate <strategy> instructions --for <intent>` prints the guidance at `delegate.<strategy>.<intent>.guidance`, or `null`. A strategy entry or intent entry that is not a mapping, or a guidance that is not a string, exits 2 and names the dotted key, such as `delegate.review.code.guidance`. Entries for the other strategy and other intents are not checked, and `run` still ignores a bad guidance (verify: `node --test tests/lets/delegate/config.test.ts tests/lets/delegate/instructions.test.ts tests/lets/delegate/review.test.ts`) (✓ node --test tests/lets/delegate/config.test.ts tests/lets/delegate/instructions.test.ts tests/lets/delegate/review.test.ts passed, 65 tests)

## 3. What users read [depends-on: 2]

- [x] 3.1 [parallel] [easy] `lets delegate --help` gives the new path and a `version: 3` example with `delegate.resolvers`, `delegate.review` and `delegate.handoff`. The `instructions` help names `delegate.<strategy>.<intent>.guidance` (verify: `node --test tests/lets/delegate/cli.test.ts`) (✓ node --test tests/lets/delegate/cli.test.ts passed, 25 tests)
- [x] 3.2 [easy] The README's *Set up delegation* shows the new file and its shape only, with no sentence about `config.json` or the old folder. `docs/resolvers.md` gives the token at `lets/t3-token`. `tests/skill-interfaces.bats` checks the README for `delegate.<strategy>.<intent>.guidance` (verify: `bats tests/skill-interfaces.bats && ! git grep -nE 'lets-delegate/(config|t3-token)|delegations|\bconfig\.json' -- README.md docs/resolvers.md`) (✓ bats tests/skill-interfaces.bats passed, 24 tests; the git grep found nothing)
- [x] 3.3 [easy] `skills/lets-build`, `skills/lets-review-code` and `skills/lets-review-plan` name `delegate.handoff.apply.guidance`, `delegate.review.code.guidance` and `delegate.review.plan.guidance`, and `tests/skill-interfaces.bats` checks each skill for its path (verify: `bats tests/skill-interfaces.bats && ! git grep -n 'delegations\.' -- skills`) (✓ bats tests/skill-interfaces.bats passed, 24 tests; the git grep found nothing)

## 4. Acceptance [depends-on: 3]

- [ ] 4.1 [easy] No file outside `docs/upgrading.md`, `docs/decisions/`, `openspec/` and `pnpm-lock.yaml` names the old config path, the old token path, `delegations` or a `version: 2` config. A rehearsed archive in a copy under `.workspace/` applies all four deltas, and `openspec validate --specs --strict` passes there (verify: `! git grep -nE 'lets-delegate/(config|t3-token)|delegations|version: 2' -- ':!docs/upgrading.md' ':!docs/decisions' ':!openspec' ':!pnpm-lock.yaml'`, then `openspec archive lets-config-home --yes` in the copy)
- [ ] 4.2 [easy] Every check passes (verify: `pnpm test && nix flake check`)

## Deviations Ledger

<!-- Dated notes on small departures from the plan, written during apply. Stop and ask the user about a large one. -->

- 2026-10-24, task 1.2: `Config` keeps the top-level `delegations` key until task 2.1 moves guidance under `delegate`, so the guidance tests stay green in between. The `config.json` tests from task 1.3 follow the folder move in task 1.1 until 1.3 deletes them.
- 2026-10-24, task 3.2: `docs/resolvers.md` also had a `version: 2` example and three mentions of the "delegate config". They now show `version: 3` with `delegate.resolvers`, which task 4.1's search needs.
