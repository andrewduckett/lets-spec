## 1. The kit's surviving names

- [ ] 1.1 [medium] `lets delegate` and the adapters import the family, effort and model names and `parseModel` from `kit/families.ts`, and `Handle`, `ModelString`, `normalizeName` and `DEFAULT_TIMEOUT_MINUTES` from `kit/adapter.ts`; `strategies.ts` types its verb with `Kind`; the `parseModel`, `normalizeName` and timeout cases move to `kit/families.test.ts` and `kit/adapter.test.ts`, and every command test passes unchanged (verify: `pnpm check && node --test "tests/**/*.test.ts"`)

## 2. The command and the protocol go [depends-on: 1]

- [ ] 2.1 [easy] `lets delegate verify` exits 2 as an unknown command: `verify.ts`, the command, `VERIFY_HELP`, `verify.test.ts`, `fixtures/fake-resolver` and the verify case go, and `pnpm test` no longer runs `pnpm verify` (verify: `node --test tests/lets/delegate/cli.test.ts`)
- [ ] 2.2 [medium] Only `lets` is built and installed: `lets/resolvers/`, each program's `main.ts`, `kit/main.ts`, `verbs.ts`, `resolver.ts`, `protocol.ts`, `ContractError`, `createAnswer`, `PROGRAM` and the `Adapter` fields `program`, `harness` and `whyDeclined` go, `build.mjs` bundles only `lets`, and `package.json` lists only its bin, with the tests design D8 lists (verify: `pnpm check && node --test "tests/**/*.test.ts"`)
- [ ] 2.3 [easy] With no config, `lets delegate review instructions --for code` answers `subagent` with no options, and no command test names a retired program in a path entry (verify: `node --test tests/lets/delegate/*.test.ts`)

## 3. Packaging [depends-on: 2]

- [ ] 3.1 [medium] The release folder has no `resolvers/`, the flake exports no resolver package and runs no `pnpm verify`, and the tarball's and the Nix package's `lets` still answer `handoff run` as `subagent` with no config; `tests/release-build.bats` loses its three bundle tests (verify: `bats tests/release-build.bats && nix build .#dist .#lets-cli --no-link`)

## 4. Docs [depends-on: 2]

- [ ] 4.1 [parallel] [medium] `docs/resolvers.md` describes the three resolvers in one page, the README's resolver table and *After a T3 Code update* link to it, the README's *Layout*, *Releases* and *Testing* name no resolver bundle or `pnpm verify`, and `docs/resolver-contract.md` is gone with the two bats tests that read it (verify: `bats tests/skill-interfaces.bats`)
- [ ] 4.2 [parallel] [easy] The 0.6 upgrade note says the release folder has no `resolvers/` and `lets delegate verify` is gone; `AGENTS.md`'s *Checks*, `delegate-default`'s Purpose and the journey map in `openspec/discovery.md` stop naming the programs (verify: `bats tests/skill-interfaces.bats`)

## 5. Acceptance [depends-on: 3, 4]

- [ ] 5.1 [easy] The packet's search finds nothing outside `docs/upgrading.md`, `docs/decisions/` and `openspec/changes/`, and a rehearsed archive in a copy under `.workspace/` retires `delegate-verify` and `resolvers` and applies the three other deltas (verify: `! git grep -nE 'lets-delegate-(t3|cli|subagent)|headless-resolver|LETS_SPEC_RESOLVER|delegate verify|resolver-contract|DECLINE' -- ':!docs/upgrading.md' ':!docs/decisions' ':!openspec/changes'`, then `openspec archive retire-resolver-programs --yes` in the copy)
- [ ] 5.2 [easy] Every check passes (verify: `pnpm test && nix flake check`)

## Deviations Ledger
