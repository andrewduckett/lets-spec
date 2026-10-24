## Why

The resolver protocol and its errors live in two files that must stay the same: one in `lets`, one in the resolver kit. Every protocol edit is made twice, and a test fails if the copies drift. The next stories, the exec timeout and the adapter interface, both want one protocol source to change. #71 decided the kit owns it (D1).

## What Changes

- `lets` takes `resolver-kit` as a workspace devDependency (D3). esbuild bundles the kit's code into `dist/lets`, which stays one file with no `node_modules` (D2).
- `lets/src/delegate/*.ts` and `lets/src/cli.ts` import the protocol and the errors from `resolver-kit/protocol.ts` and `resolver-kit/errors.ts` (D1).
- Removed: `lets/src/delegate/protocol.ts`, `lets/src/delegate/errors.ts` and `tests/resolver-kit/copies.test.ts`.
- The kit's two files lose their "Copied from" headers and their comments about keeping two copies the same (D5).
- `tests/lets/delegate/protocol.test.ts` moves to `tests/resolver-kit/protocol.test.ts` (D6). The other `lets` tests import from the kit (D7).
- New: ADR-009 records that the kit owns the contract and `lets` depends on it.
- `docs/resolver-contract.md` and the README Layout row point at the kit (D9).
- No wire field changes (D4). `lets sync` keeps its own error file (D8).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. What a user or a resolver sees stays the same (D10), so the change sets `skip_specs`.

## Impact

- Code: `lets/package.json`, `pnpm-lock.yaml`, `lets/src/cli.ts`, `lets/src/delegate/*.ts`, `contrib/resolver-kit/src/protocol.ts`, `contrib/resolver-kit/src/errors.ts`.
- Tests: `tests/lets/delegate/*.test.ts`, `tests/resolver-kit/`.
- Docs: `docs/decisions/ADR-009-*.md`, `docs/resolver-contract.md`, `README.md`.
- Build: none. The `lets-cli` derivation and the pnpm dependency hash in `flake.nix` stay as they are (D2).
- Dependency direction: `lets` now depends on the kit. The kit still depends on nothing in `lets`.
