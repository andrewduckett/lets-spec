<!-- Each section is one finding from #70 and one commit. Commit a section only when all its tasks are ticked.
     The decisions are in brainstorm.md (D1 to D13). -->

## 1. C2: lets's Io has no process-probing members

- [x] 1.1 [medium] `Io` in `lets/src/io.ts` has no `commandExists`, `pid`, `parentPid` or `processAlive`, and `Child` has no `pid`. Remove them from the type, from `realIo()`, and from the fakes in `tests/lets/delegate/fixtures/fake-io.ts`, `tests/lets/sync/fixtures/fake-io.ts` and the `ioWith` helper in `tests/lets/delegate/lookup.test.ts`. Drop the `child.pid` assertion in `tests/lets/io.test.ts`. Keep `ExecOptions.env`: tests use it (D3). Drop imports that become unused (verify: pnpm check) (✓ pnpm check passed)
- [x] 1.2 [easy] The delegate fixtures take no `commands` option. Remove it from `fake-io.ts` and `command-deps.ts` and their header comments, and from each test that passes it. Delete the handoff test "the default's handoff instructions are the same whichever CLIs are on PATH, and name none" (D4) (verify: node --test "tests/lets/**/*.test.ts" && pnpm check) (✓ node --test and pnpm check passed)

## 2. C3: one list of session markers

- [x] 2.1 [easy] `lets/src/delegate/env.ts` is gone. `config.ts` and `lookup.ts` type `env` as `Deps['env']`. `docs/resolver-contract.md` sends resolver authors to `contrib/resolver-kit/src/env.ts` for `SESSION_MARKERS` (verify: pnpm check && ! grep -rn "delegate/env" lets docs tests) (✓ pnpm check passed, grep found nothing)

## 3. C9: no unreachable guards

- [x] 3.1 [easy] `verify.ts` has no check for a missing resolver command, and `resolveWithModels` in `lookup.ts` has no check for an empty model list. Commander rejects both first. Add no tests (D5) (verify: node --test "tests/lets/**/*.test.ts" && pnpm check) (✓ node --test and pnpm check passed)

## 4. C10: the default resolver is checked once

- [x] 4.1 [medium] `resolve()` in `lookup.ts` has no pre-check that the default exists, and `incompleteInstall` takes only the path. A missing default reports "lets cannot run its default resolver at <path>, so this lets install is incomplete" with exit 4. Delete the two lookup tests that expect a thrown `SpawnError` for a missing default. In `command-deps.ts`, when the default file is absent, answer its call as Node does: exit 1 and "Cannot find module" on stderr. The review and handoff tests for a missing default still pass (D6, D7) (verify: node --test "tests/lets/**/*.test.ts" && pnpm check) (✓ node --test and pnpm check passed)

## 5. C15: small leftovers

- [ ] 5.1 [easy] The headers of `contrib/resolver-kit/src/families.ts` and `env.ts` name no deleted file. `syncSkills` and `checkSkills` take no `schemaName`; update `sync/main.ts` and every test that passes it (verify: node --test "tests/lets/**/*.test.ts" && pnpm check)
- [ ] 5.2 [easy] The sync `UsageError` lives in a new `lets/src/sync/errors.ts`, with the same name. `main.ts`, `managed.ts` and `release.ts` import it from there, so `managed.ts` and `release.ts` no longer import `main.ts` (D9) (verify: pnpm check && ! grep -n "from './main.ts'" lets/src/sync/managed.ts lets/src/sync/release.ts)
- [ ] 5.3 [medium] The kit exports no `handle()`. It moves to a test helper under `tests/resolver-kit/`, and the kit, cli, t3 and subagent tests import it from there (D8) (verify: node --test "tests/resolver-kit/*.test.ts" "tests/t3-resolver/*.test.ts" "tests/cli-resolver/*.test.ts" "tests/subagent-resolver/*.test.ts" && pnpm check)
- [ ] 5.4 [easy] Inside T3 Code with no `model-manifest.json`, `lets-delegate-t3 probe` exits 0, prints `{"resolver":"t3","options":[]}`, and warns on stderr with the manifest's path. Update the two t3 tests that expect empty stderr. Also add a comment that the t3 handle's `origin` is for people to read (D11) (verify: node --test "tests/t3-resolver/*.test.ts")
- [ ] 5.5 [easy] `SCRATCH` is one export in `contrib/resolver-kit/src/io.ts`, used by the cli and subagent resolvers. The fake `PATH` entries `herdr` and `lets-delegate-resolver` in the cli, subagent and lookup tests are `some-tool`. `flake.nix` lists `./contrib` in the fileset without `builtins.pathExists` (D10, D12) (verify: pnpm check && ! grep -rn "herdr\|lets-delegate-resolver'" tests/cli-resolver tests/subagent-resolver tests/lets/delegate/lookup.test.ts)

## 6. Check everything

- [ ] 6.1 [easy] The whole suite and the Nix build pass (verify: pnpm test && nix flake check)
