## Why

A review fails today while models sit unused, because the delegate config stores one resolver and a list of models that go stale (D1), and `lets` still guesses at run time with a PATH lookup and a special case for its built-in default. With one resolver per harness in place (#47, #48), the chain the user lists is all `lets` needs: ask each in order, stop at the first that answers (D17). This change writes that chain, and clears out what guesses.

## What Changes

- **BREAKING** The delegate config becomes `~/.config/lets-delegate/config.yaml`, under `XDG_CONFIG_HOME` when set, holding `version: 2` and `resolvers`, an ordered list of absolute paths (D8). A leftover `config.json` is refused with a message that names the new file (D3, D8). There is no migration.
- **BREAKING** The config stores nothing about models: `reviewers` and its `efforts` go (D2). `lets delegate review` sends no `reviewers` field, so a resolver chooses as it does for a request without one.
- The lookup asks `LETS_SPEC_RESOLVER` when it is set, then the config's `resolvers` in order, and stops at the first that does not decline (D17). A listed resolver that is missing or not executable stops the command with a usage error that names it.
- **BREAKING** The `lets-delegate-resolver` PATH lookup goes, and so does the built-in special case: the subagent resolver is no longer appended to every chain. With no config, the release's own `contrib/lets-delegate-subagent` answers, and nothing else (D9).
- A chain where every resolver declines fails with exit 2 and a message that says no resolver answered here and names the config file (D10).
- **BREAKING** `lets delegate setup` is removed: the command, its help text, its module and tests, the `delegate-setup` spec and the README's *Set up delegation* section (D13). The README says how to write the config by hand, and the resolver READMEs stop telling the user to run setup.
- The delegate help text and the README's *Resolvers* section describe the chain.
- A decision record says the chain is chosen in the config and never detected, amending ADR-001 and ADR-002 where they describe the default and the single `resolver`.

Out of scope, as the ledger splits it: what a resolver reports it can run (#58), how a skill chooses a model and the `delegations` guidance blocks (#59), and the new setup, which is reshaped later with #44 and #50.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `delegate-config`: the file is YAML with `version` and `resolvers`; the order of resolvers is the environment, then the list, then nothing; a missing listed resolver stops the command; a chain that all declines exits 2; the `reviewers` requirements, the effort filtering and the handoff's reviewers rule are removed.
- `delegate-default`: the default answers only when there is no config, or when the config lists it and every resolver before it declines; the PATH lookup no longer exists; a missing or broken default fails the request only on the paths that reach it.

The `delegate-setup` capability is withdrawn with the command. Its main spec is deleted in this change rather than emptied by deltas, so no delta file is written for it.

## Impact

- `lets/src/delegate/config.ts`: YAML, `version: 2`, `resolvers`; the `config.json` refusal.
- `lets/src/delegate/lookup.ts`: `candidates` and `resolve` lose `RESOLVER_COMMAND`, `resolverOnPath`, the `builtIn` branch and the `configured` flag; the no-config default and the all-declined error.
- `lets/src/delegate/review.ts`, `handoff.ts`: no `reviewers`; `lets/src/delegate/setup.ts` deleted; `lets/src/cli.ts`: the `setup` command and `SETUP_HELP` go, `DELEGATE_HELP` describes the chain.
- `lets/package.json`: a YAML parser as a dependency, bundled by `build.mjs`.
- Tests: `tests/lets/delegate/config.test.ts`, `lookup.test.ts`, `review.test.ts`, `handoff.test.ts`, `cli.test.ts`; `setup.test.ts` deleted; the fixtures that wrote `config.json`.
- Specs: `openspec/specs/delegate-config`, `delegate-default` through deltas; `openspec/specs/delegate-setup` deleted.
- Docs: `README.md` (*Set up delegation*, *Resolvers*, *The T3 Code and herdr resolvers*), `contrib/t3-resolver/README.md`, `contrib/herdr-resolver/README.md`, `docs/resolver-contract.md` where they say to run setup; `docs/decisions/` gains one record.
- The resolver protocol, the kit and the contrib resolvers do not change.
