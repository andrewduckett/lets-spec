## 1. One contract in the kit

- [x] 1.1 [easy] `lets` lists `"resolver-kit": "workspace:*"` under `devDependencies` in `lets/package.json`, and `pnpm-lock.yaml` links it, so `lets/node_modules/resolver-kit` points at `contrib/resolver-kit` (verify: `pnpm install --frozen-lockfile --offline && test "$(readlink -f lets/node_modules/resolver-kit)" = "$PWD/contrib/resolver-kit"`) (✓ `pnpm install --frozen-lockfile --offline` and the readlink check passed)
- [x] 1.2 [easy] The protocol tests run against the kit: `tests/lets/delegate/protocol.test.ts` moves to `tests/resolver-kit/protocol.test.ts` and imports `../../contrib/resolver-kit/src/protocol.ts` and `errors.ts` (verify: `node --test tests/resolver-kit/protocol.test.ts`) (✓ `node --test tests/resolver-kit/protocol.test.ts` passed, 24 tests as before)
- [x] 1.3 [medium] `lets/src/cli.ts` and every file in `lets/src/delegate/` import the protocol and the errors from `resolver-kit/protocol.ts` and `resolver-kit/errors.ts`. The `config`, `git` and `lookup` tests import them from `../../../contrib/resolver-kit/src/`. `lets/src/delegate/protocol.ts` and `errors.ts` are deleted (verify: `node --test "tests/lets/**/*.test.ts" && pnpm check`) (✓ `node --test "tests/lets/**/*.test.ts"` passed, 249 tests, and `pnpm check` passed)
- [ ] 1.4 [easy] The kit's files are the only copy: `tests/resolver-kit/copies.test.ts` is deleted, the "Copied from" headers are gone, and the top comment of the kit's `protocol.ts` says the kit owns the contract and `lets` imports it (verify: `node --test "tests/resolver-kit/*.test.ts" && ! git grep -n -e "Copied from" -e "keeps a copy" -- contrib/resolver-kit/src`)
- [ ] 1.5 [easy] The docs point at the kit: `docs/resolver-contract.md` links to `contrib/resolver-kit/src/protocol.ts`, and the README Layout row for `contrib/resolver-kit/` says it owns the contract and `lets` imports it (verify: `! git grep -n -e "lets/src/delegate/protocol.ts" -e "keeps copies of the protocol" -- docs README.md && git grep -q "contrib/resolver-kit/src/protocol.ts" -- docs/resolver-contract.md`)

## 2. The whole build [depends-on: 1]

- [ ] 2.1 [medium] Every check passes, and the Nix `lets-cli` output holds one `libexec/lets` file with no `node_modules`, with the pnpm hash in `flake.nix` unchanged (verify: `pnpm test && nix flake check && ! find "$(nix build .#lets-cli --no-link --print-out-paths)" -name node_modules | grep -q .`)

## Deviations Ledger

<!-- Dated notes on small departures from the plan, written during apply. Stop and ask the user about a large one. -->
