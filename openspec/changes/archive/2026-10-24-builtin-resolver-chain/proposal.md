## Why

Today a fresh-session review needs resolver programs installed for the user and listed in the delegate config by absolute path. The maintainer decided the resolvers become part of `lets` (epic #110). This story is its walking skeleton: the config takes names, `lets` calls the adapters in process, and the skills see no change.

## What Changes

- **BREAKING:** a `resolvers` entry is a name, `t3`, `cli` or `subagent`. A path, or any other value, exits 2 when the config is read, naming the file, the entry and the three names (D2, D3, D4). With no config the chain is `[subagent]`.
- `lets delegate` calls each listed adapter directly, and enforces decline, refusal, empty final message, finish and the exit codes in process (D5, D6). `lets` checks every `--model` itself before it asks an adapter (D8).
- `subagent` gains an adapter, whose `start` returns instructions in place of a handle (D7).
- **BREAKING:** `LETS_SPEC_RESOLVER` is no longer read, even by tests. Tests pass fake adapters.
- Removed from `lets`: path entries, the default program's path, the "this lets install is incomplete" exit 4, the process call to a resolver, and the backstop timer (D9).
- Exit 4 means "the outcome is unknown". An unexpected error inside an adapter exits 4 with its message; "broke the contract" goes.
- The resolver programs, their bundles and `lets delegate verify` stay and still work, but `lets` no longer runs them (D10).
- The help texts, the README, `docs/resolvers/`, `docs/upgrading.md` and `skills/lets-build/SKILL.md` describe names, not installs (D13).
- One new decision record, "The resolvers are built into lets", supersedes ADR-003, ADR-004 and ADR-009; ADR-005 is amended (D14).

Every `lets delegate` command keeps its names, flags, stdout, the stderr JSON line of `review run`, and exit codes 0 and 2–7.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `delegate-config`: entries are names; the chain has no `LETS_SPEC_RESOLVER`; an unknown name replaces a missing configured resolver; the intent, model and refusal rules are worded for adapters; an adapter's unexpected error exits 4 (D2, D4, D6, D11).
- `delegate-default`: the default is built into `lets` and needs no file or Node of its own; the missing-default failure is removed (D12).
- `delegate-instructions`: the scenarios no longer set `LETS_SPEC_RESOLVER` or list a path; a probe asks for the verb its strategy uses (D11).
- `resolvers`: the example resolver can no longer be listed in the config, so its scenario that lists it by path now exits 2 (D11).

## Impact

- Code: `lets/src/delegate/lookup.ts`, `config.ts`, `review.ts`, `handoff.ts`, `instructions.ts`, `strategies.ts`; `lets/src/io.ts` (`Deps`); `lets/src/main.ts` (`realDeps`, help texts); `lets/src/resolvers/kit/adapter.ts` and `resolver.ts` (`adapterAnswer`); `lets/src/resolvers/subagent/subagent.ts`.
- Tests: `tests/lets/delegate/` and its `fixtures/command-deps.ts`; `tests/lets/resolvers/subagent/subagent.test.ts`. The flake checks that expect `subagent` with no config must still pass.
- Docs: `README.md`, `docs/resolvers/`, `docs/upgrading.md`, `docs/decisions/` (ADR-003, ADR-004, ADR-005, ADR-009 and the new record), `skills/lets-build/SKILL.md`.
- Users: a config with path entries stops working; the 0.6 upgrade note says to list names and remove the installed programs.
