## 1. The kit's verb layer

- [x] 1.1 [medium] A program built on the kit's new verb layer prints its `answer`'s response as one JSON line, prints nothing when `answer` returns `null`, and maps the kit's errors to exit codes with `<program>: ` before stderr; `runResolver(createAdapter)` keeps its signature and sits on that layer, so the T3 and herdr programs answer exactly as before (design D4) (verify: node --test tests/resolver-kit/*.test.ts tests/t3-resolver/*.test.ts tests/herdr-resolver/*.test.ts) (✓ node --test tests/resolver-kit/*.test.ts tests/t3-resolver/*.test.ts tests/herdr-resolver/*.test.ts passed, 76 tests)

## 2. The lets-delegate-subagent program [depends-on: 1]

- [x] 2.1 [medium] A new workspace package `contrib/subagent-resolver/` builds `lets-delegate-subagent` on the verb layer. `probe` answers `{"resolver":"subagent"}` and never declines, and `run` exits 3 with stderr that contains "no resolver" and "subagent" but not "installed", and starts no process. Its tests in `tests/subagent-resolver/` join the `pnpm test` list and `tsconfig.json` (design D5) (verify: node --test tests/subagent-resolver/*.test.ts) (✓ node --test tests/subagent-resolver/*.test.ts passed)
- [x] 2.2 [medium] `lets-delegate-subagent start` saves the prompt to `<cwd>/.workspace/lets-delegate/<name>.prompt.md`, and answers `handle` `null` with instructions that hold the prompt and that path, the same whichever CLIs are on `PATH`; `finish` exits 0 and prints nothing for any handle. These are the tests moved from `tests/lets/delegate/default-resolver.test.ts`, with `subagent` for `default` (verify: node --test tests/subagent-resolver/*.test.ts) (✓ node --test tests/subagent-resolver/*.test.ts passed, 8 tests)
- [x] 2.3 [easy] `pnpm conformance` checks `contrib/subagent-resolver/bin/lets-delegate-subagent` in place of the fixture `tests/lets/delegate/fixtures/default-resolver`, which is deleted (verify: pnpm conformance) (✓ pnpm conformance passed, 4 resolvers)

## 3. lets runs the program [depends-on: 2]

- [x] 3.1 [complex] The lookup's last candidate is an external command: the Node that runs `lets` (`process.execPath`, passed in through `Deps`), with `<packageRoot>/contrib/lets-delegate-subagent` as a leading arg before the verb. The `default` candidate kind, `lets/src/delegate/default-resolver.ts` and its test are gone, and the committed symlink `lets/contrib/lets-delegate-subagent` points to `../../contrib/subagent-resolver/bin/lets-delegate-subagent` (design D1, D2) (verify: node --test tests/lets/delegate/lookup.test.ts) (✓ node --test tests/lets/delegate/lookup.test.ts passed, 19 tests)
- [x] 3.2 [medium] When the lookup reaches the default and its file is missing, `lets delegate` exits 4 with stderr that names the path and says the install is incomplete. When the file exists and its call comes back as exit 4, the same install message comes before the program's own stderr (design D3) (verify: node --test tests/lets/delegate/lookup.test.ts) (✓ node --test tests/lets/delegate/lookup.test.ts passed, 22 tests)
- [x] 3.3 [medium] `commandDeps()` runs the default's command as the real source program in a temporary folder that stands in for `/repo`. The handoff and review tests with no resolver expect `"resolver":"subagent"`, the saved prompt file, exit 3 for a review, and exit 4 with no file written when the default is missing (design D6) (verify: node --test tests/lets/delegate/handoff.test.ts tests/lets/delegate/review.test.ts tests/lets/delegate/cli.test.ts) (✓ node --test tests/lets/delegate/handoff.test.ts tests/lets/delegate/review.test.ts tests/lets/delegate/cli.test.ts passed, 39 tests)
- [ ] 3.4 [easy] Running the real `lets/bin/lets delegate handoff` as a process, in a temporary git repository with no other resolver, prints a JSON line with `"resolver":"subagent"`, so the source-tree symlink works (verify: node --test tests/lets/delegate/source-tree.test.ts)

## 4. Every lets carries the program [depends-on: 2]

- [ ] 4.1 [parallel] [medium] The flake builds `lets-delegate-subagent`, and the release folder's `contrib/` holds exactly `headless-resolver`, `lets-delegate-herdr`, `lets-delegate-subagent` and `lets-delegate-t3`. The `dist` check lists all four, and a copy of the subagent alone answers `probe` with `{"resolver":"subagent"}`. `tests/release-build.bats` bundles it alone the same way (verify: bats tests/release-build.bats && nix build .#checks.x86_64-linux.dist --no-link)
- [ ] 4.2 [parallel] [medium] The Nix `lets-cli` package installs the bundle at `$out/contrib/lets-delegate-subagent`, and `workspaceSource` leaves out the `lets/contrib/` symlink. The `commands` check runs the packaged `lets delegate handoff` in its test project and gets `"resolver":"subagent"` (verify: nix build .#checks.x86_64-linux.commands --no-link)

## 5. Docs and the whole check [depends-on: 3, 4]

- [ ] 5.1 [easy] The README, `docs/resolver-contract.md` and the T3 and herdr READMEs name `lets-delegate-subagent` and its name `subagent` where they describe the default, and a new `contrib/subagent-resolver/README.md` says what it does and that `lets` ships it (verify: grep -q lets-delegate-subagent README.md && grep -q lets-delegate-subagent docs/resolver-contract.md && test -f contrib/subagent-resolver/README.md)
- [ ] 5.2 [easy] The whole project passes its checks (verify: pnpm test && nix flake check)

## Deviations Ledger

<!-- Dated notes on small departures from the plan, written during apply. Stop and ask the user about a large one. -->
