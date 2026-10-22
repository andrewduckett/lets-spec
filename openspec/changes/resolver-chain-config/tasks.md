<!-- One task is one behavior, its test, and the code that passes it. -->

## 1. The config file

- [x] 1.1 [medium] `readConfig` reads `config.yaml` under `XDG_CONFIG_HOME` or `~/.config`, through the `yaml` package added to `lets/package.json`, and returns `{ version: 2, resolvers }` where each entry is an absolute path or the word `subagent`; it ignores unknown keys, and exits 2 naming the file and the bad value for a non-number `version`, a `resolvers` that is not such a list, or a document that is not YAML (verify: `node --test tests/lets/delegate/config.test.ts`) (✓ `node --test tests/lets/delegate/config.test.ts` passed, 7 tests)
- [x] 1.2 [easy] When `config.yaml` is missing and `config.json` exists beside it, `readConfig` throws a usage error that names both files and says the config is now `config.yaml`; when both exist, it reads `config.yaml` and ignores the JSON (verify: `node --test tests/lets/delegate/config.test.ts`) (✓ `node --test tests/lets/delegate/config.test.ts` passed, 9 tests)
- [x] 1.3 [easy] `nix flake check` builds with the new dependency: refresh the `pnpmDeps` hash in `flake.nix` as its comment says, after `pnpm install` updates `pnpm-lock.yaml` (verify: `nix flake check`) (✓ the `commands`, `dist`, `flake-module` and `flows` checks passed; `node-tests` fails only on the 12 tests the ledger names, which tasks 3.1 and 3.2 remove)

## 2. The lookup [depends-on: 1]

- [x] 2.1 [medium] `candidates` returns the `LETS_SPEC_RESOLVER` override, then one candidate per `resolvers` entry in order, where `subagent` is the `builtIn` candidate run as `<nodePath> <packageRoot>/contrib/lets-delegate-subagent`; with no config it returns the override, then the `builtIn` candidate; nothing on `PATH` is ever a candidate, and `RESOLVER_COMMAND` and `resolverOnPath` are gone (verify: `node --test tests/lets/delegate/lookup.test.ts`) (✓ `node --test tests/lets/delegate/lookup.test.ts` passed, 26 tests)
- [x] 2.2 [medium] `resolve` asks each candidate in order and answers with the first that does not decline, so `/a` declining means `/b` answers and `/a` answering means `/b` is never run; a listed absolute path that does not exist or is not an executable file throws a usage error naming the path and the config file when the lookup reaches it, and not before (verify: `node --test tests/lets/delegate/lookup.test.ts`) (✓ `node --test tests/lets/delegate/lookup.test.ts` passed, 29 tests)
- [x] 2.3 [easy] When every candidate declines, `resolve` throws a usage error that says every resolver declined and names the config file, so `review` and `handoff` exit 2 with nothing on stdout; a missing or broken `builtIn` copy still exits 4 and says the install is incomplete, through no config and through a `subagent` entry alike (verify: `node --test tests/lets/delegate/lookup.test.ts`) (✓ `node --test tests/lets/delegate/lookup.test.ts` passed, 34 tests)

## 3. The commands [depends-on: 2]

- [x] 3.1 [medium] `lets delegate review` sends a `run` request with no `reviewers` field whatever the config holds, and `fixtures/command-deps.ts` writes `config.yaml`, gains an `executables` option, and keeps routing the Node-run subagent call to the real program; `handoff` reads the same config (verify: `node --test tests/lets/delegate/review.test.ts tests/lets/delegate/handoff.test.ts`) (✓ `node --test tests/lets/delegate/review.test.ts tests/lets/delegate/handoff.test.ts` passed, 35 tests)
- [ ] 3.2 [medium] `lets delegate setup` is gone: `lets/src/delegate/setup.ts` and `tests/lets/delegate/setup.test.ts` are deleted, `cli.ts` registers no `setup` command, `lets delegate setup --help` exits 2, and `DELEGATE_HELP`, `REVIEW_HELP` and `HANDOFF_HELP` describe the chain and name "every resolver declined" under exit 2 (verify: `node --test tests/lets/delegate/cli.test.ts`)
- [ ] 3.3 [easy] The type check and the conformance check pass with the field and the module gone (verify: `pnpm check && pnpm conformance`)

## 4. Specs and docs [depends-on: 3]

- [ ] 4.1 [easy] [parallel] `openspec/specs/delegate-setup/` is deleted, the Purpose of `openspec/specs/delegate-config/spec.md` says the config decides which resolver answers and no longer says it decides the model, and the Purpose of `delegate-default/spec.md` covers the `subagent` entry (verify: `openspec validate resolver-chain-config --strict`)
- [ ] 4.2 [medium] [parallel] The README's *Set up delegation* section becomes a paragraph that shows a complete `config.yaml` with full absolute paths and `subagent`, says `~` is not expanded, and says that until #58 a T3 entry runs the first catalog model for the family with no fallback; *What a review gets*, *Resolvers* and *The T3 Code and herdr resolvers* describe the chain and name no setup; `contrib/t3-resolver/README.md`, `contrib/herdr-resolver/README.md`, `contrib/subagent-resolver/README.md`, `docs/resolver-contract.md` and the comment in `lets/src/delegate/protocol.ts` say nothing about setup, a PATH lookup, the default answering last, or `lets` sending reviewers (verify: `! grep -rn "delegate setup\|lets-delegate-resolver on\|sends them in the order" README.md contrib/*/README.md docs/resolver-contract.md lets/src`)

## 5. Integration [depends-on: 4]

- [ ] 5.1 [easy] The whole suite and every flow build pass: the Node tests, the type check, the conformance check, the bats tests, and the flake's checks that run `lets delegate handoff` with no config from the Nix package and the release tarball (verify: `pnpm test && nix flake check`)

## Deviations Ledger

<!-- Dated notes on small departures from the plan, written during apply. Stop and ask the user about a large one. -->

- 2026-10-21, task 1.1: from this commit until tasks 3.1 and 3.2, the full suite has failing tests, 12 at first and 13 from task 1.2. They test behavior this change removes: the `reviewers` tests in `review.test.ts`, the tests in `setup.test.ts`, and, from task 1.2, the handoff test that writes `config.json`, which is now refused. Tasks 3.1 and 3.2 replace and delete them. The config error no longer ends with "Run `lets delegate setup`", since setup goes in task 3.2.
- 2026-10-21, task 1.3: `lets/build.mjs` also changed. esbuild bundles `yaml`'s CommonJS build, which calls `require` on Node's own modules, and an ES module bundle has no `require`, so the `dist` check failed with "Dynamic require of \"process\" is not supported". The banner now defines `require` with `createRequire`. The release still needs nothing beside Node.
- 2026-10-21, task 2.1: `resolverOnPath` moved from `lookup.ts` into `setup.ts`, its last user, so the CLI still loads until task 3.2 deletes `setup.ts`.
