## Why

A review fails today while models sit unused. The delegate config stores one resolver and a list of models that go stale (D1), and `lets` still guesses at run time: it looks on `PATH`, and it treats its own default as a special case. With one resolver per harness in place (#47, #48), the list the user writes is all `lets` needs: ask each in order, stop at the first that answers (D17). This change writes that list, the chain, and removes what guesses.

## What Changes

- **BREAKING** The delegate config becomes `~/.config/lets-delegate/config.yaml`, under `XDG_CONFIG_HOME` when set. It holds `version: 2` and `resolvers`: the chain, an ordered list whose entries are absolute paths or the word `subagent`, which names the default that ships beside the running `lets` (D8). `lets` ignores keys it does not know, so a later `lets` can add one without breaking an older pin that reads the same file. When `config.yaml` is missing and `config.json` is there, `lets` refuses to run and names the new file (D3, D8). There is no migration.
- **BREAKING** The config stores nothing about models: `reviewers` and its `efforts` go (D2). `lets delegate review` sends no `reviewers` field, so a resolver chooses as it does for a request without one.
- The lookup asks `LETS_SPEC_RESOLVER` when it is set, then the config's `resolvers` in order, and stops at the first that does not decline (D17). A listed resolver that is missing or not executable stops the command with a usage error that names it.
- **BREAKING** The `lets-delegate-resolver` PATH lookup goes, and `lets` no longer appends the default to every chain. The default answers only with no config (D9), or where the chain lists `subagent`. On both paths `lets` runs its own copy with its own Node, and a missing or broken copy still means the install is incomplete.
- A chain where every resolver declines fails with exit 2 and a message that says every resolver declined and names the config file (D10). The help text for `review` and `handoff` names this case under exit 2.
- **BREAKING** `lets delegate setup` is removed: the command, its help text, its module and tests, the `delegate-setup` spec and the README's *Set up delegation* section (D13). The README says how to write the config by hand, and the resolver READMEs stop telling the user to run setup.
- The delegate help text and the README's *Resolvers* section describe the chain.
- A decision record says the chain is chosen in the config and never detected, amending ADR-001 and ADR-002 where they describe the default and the single `resolver`.

Out of scope, as the ledger splits it: what a resolver reports it can run (#58), how a skill chooses a model and the `delegations` guidance blocks (#59), and the new setup, which is reshaped later with #44 and #50.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `delegate-config`: the file is YAML with `version` and `resolvers`, and unknown keys are ignored; the order is the environment, then the list, then nothing; a missing listed path stops the command; a chain that all declines exits 2; a `run` request from `lets` has no `reviewers`; the `reviewers` requirements on `lets`'s side and the handoff's reviewers rule are removed. The resolver-side `reviewers` requirements stay, because the conformance check still sends the field; they leave with the change that replaces it. A task edits the main spec's Purpose, which deltas cannot reach, so it no longer says the config decides the model.
- `delegate-default`: the default answers with no config, or where the chain lists `subagent`, and only when every resolver before it declines; the PATH lookup no longer exists; a missing or broken default fails the request on those two paths, and a missing listed absolute path is the config's error. A task edits the main spec's Purpose so it covers the `subagent` entry.

The `delegate-setup` capability is withdrawn with the command. Its main spec is deleted in this change rather than emptied by deltas, so no delta file is written for it.

## Impact

- `lets/src/delegate/config.ts`: YAML, `version: 2`, `resolvers` with the `subagent` entry; unknown keys ignored; the `config.json` refusal.
- `lets/src/delegate/lookup.ts`: `candidates` and `resolve` lose `RESOLVER_COMMAND`, `resolverOnPath` and the `configured` flag; the `builtIn` candidate stays for the no-config path and the `subagent` entry; the all-declined error.
- `lets/src/delegate/review.ts`, `handoff.ts`: no `reviewers`; `lets/src/delegate/setup.ts` deleted; `lets/src/cli.ts`: the `setup` command and `SETUP_HELP` go, `DELEGATE_HELP` describes the chain, `REVIEW_HELP` and `HANDOFF_HELP` name the all-declined case under exit 2.
- `lets/package.json`: a YAML parser as a dependency, bundled by `build.mjs`.
- Tests: `tests/lets/delegate/config.test.ts`, `lookup.test.ts`, `review.test.ts`, `handoff.test.ts`, `cli.test.ts`; `setup.test.ts` deleted; `fixtures/command-deps.ts`, which writes the config and routes the subagent call to the real program, and every test that wrote `config.json`.
- Specs: `openspec/specs/delegate-config` and `delegate-default` through deltas, and the Purpose of `delegate-config` edited in place; `openspec/specs/delegate-setup` deleted.
- Docs: `README.md`, in *Set up delegation*, *What a review gets* where the rung table says the resolver picks the family from the config, *Resolvers* and *The T3 Code and herdr resolvers*; `contrib/t3-resolver/README.md` and `contrib/herdr-resolver/README.md` where they say to run setup; `contrib/subagent-resolver/README.md` where it says the default answers last; `docs/resolver-contract.md` where it lists the lookup order, says `lets` sends reviewers, and tells a resolver author to run setup; the comment in `lets/src/delegate/protocol.ts` that says `lets` sends reviewers in the config's order; `docs/decisions/` gains one record, and ADR-001 and ADR-002 get a note.
- The resolver protocol, the kit and the contrib resolvers do not change.
