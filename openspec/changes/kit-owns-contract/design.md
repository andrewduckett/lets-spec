## Context

- `lets/src/delegate/protocol.ts` and `errors.ts` are the originals. `contrib/resolver-kit/src/protocol.ts` and `errors.ts` are the same files under a four-line "Copied from" header. `tests/resolver-kit/copies.test.ts` fails when they differ.
- The three TypeScript resolvers already depend on the kit as `"resolver-kit": "workspace:*"`, import it as `resolver-kit/<file>.ts` through its `exports` map, and bundle it with esbuild under Nix. `lets` would do the same.
- `lets/bin/lets` runs the TypeScript source with Node's type stripping. pnpm links `lets/node_modules/resolver-kit` to `contrib/resolver-kit`, and Node follows the link to the real path, which is outside `node_modules`. So the source tree's `lets` can import the kit's `.ts` files.
- The spike (brainstorm D2) already ran this change in a scratch checkout: `tsc --noEmit`, `pnpm --filter lets build`, `nix build .#lets-cli` and a forced rebuild of the pnpm dependencies all passed, and the pnpm hash in `flake.nix` did not change.

## Goals / Non-Goals

**Goals:**

- One file for the protocol and one for its errors, both in the kit.
- `dist/lets` stays one file that runs with no `node_modules`.
- Every test that ran before still runs, against the one copy.

**Non-Goals:**

- Changing any request, response, exit code or error class.
- Moving `lets/src/sync/errors.ts`, which is not part of the contract.
- Changing the `lets-cli` derivation, the build script or the pnpm hash.

## Test Seams

- **Primary test seam:** the existing protocol unit tests, moved to `tests/resolver-kit/protocol.test.ts`. They pin every request and response the contract allows, so they prove the one copy behaves as the two did.
- **Existing seams reused:** the `lets` delegate unit tests in `tests/lets/delegate/`, `tsc --noEmit`, `pnpm verify` on every resolver, `tests/lets/delegate/source-tree.test.ts` (the source tree's `lets` runs end to end), and `nix flake check`, which builds `lets-cli` and the release folder.

## Scrutiny Tier & Blast Radius

- **Tier:** medium. It changes the dependency direction between two packages, but no contract, data or trust boundary.
- **Blast radius:** `lets/src/cli.ts`, `lets/src/delegate/`, the kit's `protocol.ts` and `errors.ts`, their tests, `lets/package.json` and `pnpm-lock.yaml`. Resolvers see the same requests as before.

## Decisions

- **`lets` imports the kit through the workspace link, as the resolvers do.** It imports `resolver-kit/protocol.ts` and `resolver-kit/errors.ts`, never a relative path into `contrib/`. The alternatives were a relative import, which skips the package boundary and the `exports` map, and a third package such as `contrib/protocol/`, which adds a package the spike showed is not needed. This is the decision ADR-009 records.
- **devDependency, not dependency.** The kit only feeds the bundle, so nothing needs it at run time (brainstorm D3). The resolvers list it under `dependencies`; changing them is out of scope.
- **Tests import the kit by relative path.** The kit's other tests already import `../../contrib/resolver-kit/src/<file>.ts`, so the moved protocol test and the `lets` tests do the same.
- **The kit's header comment says who owns the file.** The "Copied from" header and the "keeps a copy" sentence go. The top comment of `protocol.ts` says the kit owns the contract and `lets` imports it. `errors.ts` keeps its own first comment.
- **No other code is removed.** With one copy, every export is used by `lets`, a resolver or a test (brainstorm D5).

## Risks / Trade-offs

- [The pnpm hash changes in a clean CI build] → The spike forced a rebuild of the pnpm dependency derivation and got the same hash. `nix flake check` before push confirms it again.
- [A resolver change now reaches `lets` without a second edit to catch it] → That is the point. The protocol tests and `pnpm verify` still run on every push.
- [Moving the test drops it from a test run] → `pnpm test` and the flake check already run `tests/resolver-kit/*.test.ts`. The task checks the moved test's count in the output.

## Migration & Rollback

N/A. Nothing a user installs changes shape. To undo, revert the change's commits.
