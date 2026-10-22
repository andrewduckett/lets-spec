## Context

`lets delegate` finds its resolver in `lets/src/delegate/lookup.ts`. `candidates()` builds a list from four sources: `LETS_SPEC_RESOLVER`, the config's single `resolver`, `lets-delegate-resolver` on `PATH`, and the release's `contrib/lets-delegate-subagent`, which it marks `builtIn` and runs with its own Node. `resolve()` walks the list and has two special branches: a `configured` candidate that is missing is a usage error, and a `builtIn` one that is missing or fails with any exit but 0 or 3 becomes "this install is incomplete". `config.ts` parses `config.json` by hand with no YAML dependency anywhere in `lets`; `commander` is its only runtime dependency, and `build.mjs` bundles everything into `bin/lets`. `review.ts` reads the config's `reviewers`, filters them by effort, and puts them in the `run` request. `setup.ts` is the only writer of the config, and `cli.ts` registers it as `lets delegate setup`.

All of it is tested through `tests/lets/delegate/*.test.ts` against a fake `Io` (`fixtures/fake-io.ts`) that holds files in a map, and through `tests/lets/delegate/fixtures/fake-resolver`, a real script the lookup tests run. The release checks in `flake.nix` already run `lets delegate handoff` with nothing configured and expect `"resolver":"subagent"`.

Nix fetches the workspace's npm dependencies from `pnpm-lock.yaml` into a fixed-output derivation whose hash lives in `flake.nix`; the comment there says how to refresh it.

## Goals / Non-Goals

**Goals:**
- One lookup rule, with no special case for the default and nothing read from `PATH`.
- A config a person can write by hand, in the file the later guidance blocks (#59) will share.
- Every failure path names the file or the path at fault and exits 2.
- Nothing about models in `lets`: no `reviewers`, no listing, no setup.

**Non-Goals:**
- Changing the resolver protocol, the kit or any contrib resolver (#58).
- Any command that lists options or guidance (#59).
- A replacement for setup, or installing anything.
- The `delegations` blocks: the parser accepts only `version` and `resolvers` here, and the file format leaves room for them.

## Test Seams

- **Primary test seam:** the delegate unit tests under `tests/lets/delegate/`, through `pnpm test`. `config.test.ts` proves the file rules against the fake `Io`'s file map. `lookup.test.ts` proves the order, the stop, the missing path and the all-declined error against `fixtures/fake-resolver`, which declines or answers as its environment says. `review.test.ts` and `handoff.test.ts` prove the request carries no `reviewers` and the no-config path. `cli.test.ts` proves `setup` is gone and the help text describes the chain.
- **Existing seams reused:** the release checks in `flake.nix` and `tests/release-build.bats` for the no-config default; `tests/lets/delegate/source-tree.test.ts` for the source tree's `contrib/` link.

## Scrutiny Tier & Blast Radius

- **Tier:** medium
- **Blast radius:** `lets/src/delegate/{config,lookup,review,handoff,setup}.ts` and `lets/src/cli.ts`; the user's config file; the README and the two resolver READMEs. No resolver, kit or protocol file changes. Every `lets delegate` command reads the config, so a parse bug breaks them all, which the unit tests cover before the release checks run.

## Decisions

1. **YAML through the `yaml` package, not a hand-written subset.** Alternatives: keep JSON, which is painful for the prose blocks #59 adds and the user asked for a file written by hand; or parse a subset by hand, which would break the first time someone writes a flow scalar or a comment. `yaml` is pure JavaScript, has no dependencies, and `build.mjs` bundles it, so the release still needs nothing beside Node. Cost: a lockfile change and a new `pnpmDeps` hash in `flake.nix`.

2. **The parser accepts exactly `version` and `resolvers`, and nothing else is an error.** A stricter parser than the proposal needs, so that a typo such as `resolver:` or `reviewers:` left from the old file is refused rather than silently ignored. #59 adds `delegations` to the accepted keys. Alternative: ignore unknown keys, which is how most configs behave, but here every unknown key is a stale one.

3. **No config means a two-entry list built in `candidates()`: the override, then the release's subagent.** The `builtIn` flag and the "incomplete install" message stay for that one path, because the kept requirement "A missing or broken default fails the request" still needs them. With a config, no candidate is `builtIn`: a listed subagent is a path like any other, and a missing one is "A missing configured resolver stops the command". Alternative: drop the `builtIn` branch too and treat the no-config subagent as a listed path, which would turn a broken install into "run setup", the message we are removing.

4. **Every listed path is checked when reached, not up front.** As today for the one configured resolver: a chain where the first answers never looks at the second, so a stale path later in the list does not break a machine where it is never needed. The spec's "An earlier listed resolver answers first" scenario fixes this.

5. **Every resolver declining is a `UsageError`.** Exit 2, naming the config file, because the only way to reach it is a config that leaves the subagent out or lists resolvers that answer nowhere here, and the fix is to edit that file. Today's `throw new Error('every resolver declined, the default included')` was a bug guard; it becomes a user-facing path.

6. **`config.json` is refused only when `config.yaml` is missing.** A file nobody reads any more should not block a machine that has moved on, but one that is still the only config there means the user has not, and the message names the new file. Checked in `readConfig()` before the YAML path is read.

7. **`reviewers` leaves `lets` now, not in #59.** The ledger's D2 says nothing about models is stored. Carrying `reviewers` into a brand-new file format only to delete it in the next story would mean writing a parser, tests and spec text for a dead field. `review.ts` sends no `reviewers`, and the resolver's own choice applies, which the kept requirement "No list keeps the resolver's own choice" already describes. The conformance check still sends `reviewers` through its own request, so the resolver-side requirements and the kit stay.

8. **Setup is deleted, not disabled.** The module, its tests, the command, its help text and the `delegate-setup` main spec go. A disabled command that prints "removed" would still have to be documented and tested, and the reshaped setup will not share its shape.

9. **The decision record amends ADR-001 and ADR-002 rather than replacing either.** ADR-001's decision, that the default starts no session, stands; its context says the default answers "when none is installed", which becomes "when there is no config". ADR-002's decision, that only `lets` reads the config, stands; its decision text about `lets` sending reviewers no longer applies, and #58 will supersede that part fully. The new record says the chain is written in the config and nothing in `lets` detects a harness. The ADR step decides its exact scope.

## Risks / Trade-offs

- [The `pnpmDeps` hash in `flake.nix` goes stale when `yaml` is added, and `nix flake check` fails until it is refreshed] → The task that adds the dependency refreshes the hash as the comment in `flake.nix` says, and `nix flake check` is in the pre-push checks.
- [A user with the old `config.json` and no `config.yaml` is stopped by every `lets delegate` command] → The message names both files; there are no users yet, and the README's new paragraph shows the file to write.
- [With `reviewers` gone, a review from T3 again picks the first catalog entry for the family, which is the `gpt-6-astra` failure] → That is today's behavior for a config with no reviewers, and #58 fixes it at its root. It is recorded in #58's packet, which supersedes #34.
- [The release's README and resolver READMEs tell users to run `lets delegate setup`] → Every mention is listed in the proposal's Impact and replaced in one task.
- [Removing the `delegate-setup` main spec by deleting the folder leaves no REMOVED record in the specs] → The proposal records the withdrawal, and the git history keeps the spec.

## Migration & Rollback

No migration: there are no users, and the old file is refused with a message that names the new one. To roll back, revert the change's commits; nothing persisted changes shape beyond the user's own config file.

## Open Questions

None.
