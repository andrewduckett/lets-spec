## Context

`lets delegate` finds its resolver in `lets/src/delegate/lookup.ts`. `candidates()` builds a list from four sources. They are `LETS_SPEC_RESOLVER`, the config's single `resolver`, `lets-delegate-resolver` on `PATH`, and the release's `contrib/lets-delegate-subagent`, which it marks `builtIn` and runs with its own Node. `resolve()` walks the list and has two special branches: a `configured` candidate that is missing is a usage error, and a `builtIn` one that is missing or fails with any exit but 0 or 3 becomes "this install is incomplete". `config.ts` parses `config.json` by hand with no YAML dependency anywhere in `lets`; `commander` is its only runtime dependency, and `build.mjs` bundles everything into `bin/lets`. `review.ts` reads the config's `reviewers`, filters them by effort, and puts them in the `run` request. `setup.ts` is the only writer of the config, and `cli.ts` registers it as `lets delegate setup`.

All of it is tested through `tests/lets/delegate/*.test.ts` against a fake `Io` (`fixtures/fake-io.ts`) that holds files in a map, and through `tests/lets/delegate/fixtures/fake-resolver`, a real script the lookup tests run. The release checks in `flake.nix` already run `lets delegate handoff` with nothing configured and expect `"resolver":"subagent"`.

Nix fetches the workspace's npm dependencies from `pnpm-lock.yaml` into a fixed-output derivation whose hash lives in `flake.nix`; the comment there says how to refresh it.

## Goals / Non-Goals

**Goals:**
- One lookup order, read from the config, with nothing read from `PATH` and nothing appended. The default keeps one difference, which decision 3 names: `lets` runs its own copy with its own Node.
- A config a person can write by hand, in the file the later guidance blocks (#59) will share.
- Every failure the config causes names the file or the path at fault and exits 2. A missing or broken copy of `lets`'s own default stays exit 4, as today.
- Nothing about models in `lets`: no `reviewers`, no listing, no setup.

**Non-Goals:**
- Changing the resolver protocol, the kit or any contrib resolver (#58).
- Any command that lists options or guidance (#59).
- A replacement for setup, or installing anything.
- The `delegations` blocks: the parser accepts only `version` and `resolvers` here, and the file format leaves room for them.

## Test Seams

- **Primary test seam:** the delegate unit tests under `tests/lets/delegate/`, through `pnpm test`. `config.test.ts` proves the file rules against the fake `Io`'s file map. `lookup.test.ts` proves the order, the stop, the missing path, the `subagent` entry and the all-declined error. One listed resolver is `fixtures/fake-resolver`, which declines or answers as its environment says; a chain of two or more uses `fakeIo`'s result queue, one answer per listed path, since the fake resolver's environment is the same for every call. `review.test.ts` and `handoff.test.ts` prove the request carries no `reviewers` and the no-config path. `cli.test.ts` proves `setup` is gone and the help text describes the chain. `fixtures/command-deps.ts` writes `config.yaml` instead of `config.json`, gains an `executables` option so a test can list a path other than the fake resolver, and keeps routing the Node-run subagent call to the real program.
- **Existing seams reused:** the checks in `flake.nix` that run `lets delegate handoff` from the Nix package and the release tarball with nothing configured; `tests/lets/delegate/source-tree.test.ts` for the source tree's `contrib/` link.

## Scrutiny Tier & Blast Radius

- **Tier:** medium
- **Blast radius:** `lets/src/delegate/{config,lookup,review,handoff,setup}.ts` and `lets/src/cli.ts`; the user's config file; the README and the two resolver READMEs. No resolver, kit or protocol file changes. Every `lets delegate` command reads the config, so a parse bug breaks them all, which the unit tests cover before the release checks run.

## Decisions

1. **YAML through the `yaml` package, not a hand-written subset.** Alternatives: keep JSON, which is painful for the prose blocks #59 adds and the user asked for a file written by hand; or parse a subset by hand, which would break the first time someone writes a flow scalar or a comment. `yaml` is pure JavaScript, has no dependencies, and `build.mjs` bundles it, so the release still needs nothing beside Node. Cost: a lockfile change and a new `pnpmDeps` hash in `flake.nix`.

2. **The parser reads `version` and `resolvers`, and ignores every other key.** One user-level file serves every project on the machine, and each project pins its own `lets`. The next story adds `delegations` to the same file; a parser that refused unknown keys would break every project still pinned to this one the day that key is written. A key added later keeps `version: 2`; the version moves only when a key this `lets` reads changes meaning. Alternative: refuse unknown keys, so that a stale `resolver:` or `reviewers:` from the old file is caught. The `version` check catches the old file as a whole, and a stale key beside a valid `resolvers` does no harm.

3. **The default is named `subagent` in the chain, and `lets` runs its own copy with its own Node.** `candidates()` builds the `builtIn` candidate, `nodePath` plus `<packageRoot>/contrib/lets-delegate-subagent`, in two cases: there is no config, where it is the only entry after the override; and the chain holds the word `subagent`, where it takes that position. The `builtIn` flag and the "incomplete install" message stay for both, because the copy is `lets`'s own and a missing one is a broken install, not a wrong config. A listed absolute path is never `builtIn`, even when it points at some other copy of the program. Alternative: list the default by absolute path, like any other resolver. That fails on Nix for two reasons. The copy sits at a store path that moves with every update. And `flake.nix` installs it with `dontPatchShebangs`, so it starts with `#!/usr/bin/env node`, and a profile install of `lets` does not guarantee a Node on `PATH`. Another alternative: install the default under a stable path. That is the deferred setup's job, and it would make this change install something.

4. **The lookup checks a listed path when it reaches it, not up front.** As today for the one configured resolver: a chain where the first answers never looks at the second, so a stale path later in the list does not break a machine where it is never needed. The spec's "An earlier listed resolver answers first" scenario fixes this.

5. **Every resolver declining is a `UsageError`: exit 2, naming the config file.** The only way to reach it is a chain that leaves `subagent` out, or lists resolvers that answer nowhere here, and the fix is to edit that file. Exit 3 would tell the review skills to run a subagent, which is what listing `subagent` asks for; a chain without it is the user's way to say "fail instead". The help text for `review` and `handoff` names the case under exit 2. Today's `throw new Error('every resolver declined, the default included')` was a bug guard; it becomes a user-facing path.

6. **`lets` refuses `config.json` only when `config.yaml` is missing.** A file nobody reads any more should not block a machine that has moved on, but one that is still the only config there means the user has not, and the message names the new file. Checked in `readConfig()` before the YAML path is read.

7. **`reviewers` leaves `lets` now, not in #59.** The ledger's D2 says nothing about models is stored. Carrying `reviewers` into a brand-new file format only to delete it in the next story would mean writing a parser, tests and spec text for a dead field. `review.ts` sends no `reviewers`, and the resolver's own choice applies, which the kept requirement "No list keeps the resolver's own choice" already describes. The conformance check still sends `reviewers` through its own request, so the resolver-side requirements and the kit stay. This reverses the part of ADR-002 that says `lets` sends the reviewers; the note on ADR-002 and the manifest record that, and the record for what replaces it belongs to the change that makes resolvers report what they can run.

8. **Setup is deleted, not disabled.** The module, its tests, the command, its help text and the `delegate-setup` main spec go. A disabled command that prints "removed" would still have to be documented and tested, and the reshaped setup will not share its shape.

9. **The decision record amends ADR-001 and ADR-002 rather than replacing either.** ADR-001's decision, that the default starts no session, stands; its context says the default answers "when none is installed", which becomes "when there is no config". ADR-002's decision, that only `lets` reads the config, stands; its decision text about `lets` sending reviewers no longer applies, and #58 will supersede that part fully. The new record says the chain is written in the config and nothing in `lets` detects a harness. The ADR step decides its exact scope.

## Risks / Trade-offs

- [The `pnpmDeps` hash in `flake.nix` goes stale when `yaml` is added, and `nix flake check` fails until it is refreshed] → The task that adds the dependency refreshes the hash as the comment in `flake.nix` says, and `nix flake check` is in the pre-push checks.
- [A user with the old `config.json` and no `config.yaml` is stopped by every `lets delegate` command] → The message names both files; there are no users yet, and the README's new paragraph shows the file to write.
- [A chain that lists `lets-delegate-t3` runs the first model in T3's catalog for the family, which is the `gpt-6-astra` failure, and a refusal is not a decline, so a `subagent` entry after it never helps] → That is today's behavior for every machine so far, since none has a config. The README's config paragraph says so, and says to list `subagent` alone until #58 lands if that model cannot run. #58 is Must, blocked only by #57, and no release should be cut between this change and #58.
- [The release's README and resolver READMEs tell users to run `lets delegate setup`] → Every mention is listed in the proposal's Impact and replaced in one task.
- [Removing the `delegate-setup` main spec by deleting the folder leaves no REMOVED record in the specs] → The proposal records the withdrawal, and the git history keeps the spec.
- [A project pinned to an older `lets` runs `lets delegate setup --write` and writes `config.json` beside a machine's `config.yaml`] → `lets` reads `config.yaml` when it exists and ignores the JSON file; only a machine with no `config.yaml` is stopped, with a message that names both files.

## Migration & Rollback

No migration: there are no users, and the old file is refused with a message that names the new one. To roll back, revert the change's commits; nothing persisted changes shape beyond the user's own config file.

## Open Questions

None.
