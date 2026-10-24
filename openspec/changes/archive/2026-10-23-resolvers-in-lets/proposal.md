## Why

The resolvers are first-party programs that ship with `lets`, but the source tree files them as four workspace packages under `contrib/`, a name that reads as third-party code. That costs five `package.json` files, `workspace:*` links and one Nix build per package. Four open issues (#85, #87, #89, #102) edit resolver source, so moving it first keeps their rebases to path changes.

## What Changes

- The kit and the three adapters move into `lets/src/resolvers/{kit,t3,cli,subagent}/`. The dev entries and the `sh` example move into `lets/resolvers/` (D3).
- The four `contrib/*` packages, their `package.json` files and the `workspace:*` links are deleted. Imports become relative paths (D13).
- One `lets/build.mjs` bundles `lets` and the three programs, from an explicit list of entries (D7). One Nix derivation builds every bundle.
- The unit tests move to `tests/lets/resolvers/<id>/`. The hand-kept test and type-check lists become globs (D6).
- A new unit test keeps the folder rule: nothing under `lets/src/resolvers/` imports from outside it (D5).
- The resolver READMEs move to `docs/resolvers/<id>.md` (D4). The README, the contract, ADR-009 and a new `0.6` section of `docs/upgrading.md` name the new paths (D11, D12).
- No install changes. The release folder, the Nix `lets` package and the default resolver's path keep `contrib/`; the source tree's `lets/contrib/` link points at the moved dev entry (D2). No resolver, kit or `lets` behaviour changes (D9).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `delegate-verify`: scenarios that check the `sh` example name its new source path, `lets/resolvers/headless-resolver`.
- `contrib-resolvers`: the verify requirement and the `sh` example's requirement name `lets/resolvers/headless-resolver`. The release-folder requirement stays for #105 (D10).

## Impact

- Code: every file under `contrib/`; `lets/package.json`, `lets/src/main.ts`, `lets/src/delegate/*.ts` (imports only); the `lets/contrib/lets-delegate-subagent` link.
- Build: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.json`, `flake.nix` (one build, and a new `pnpmDeps` hash).
- Tests: `tests/resolver-kit/`, `tests/{t3,cli,subagent}-resolver/`, `tests/lets/delegate/` (source paths), `tests/release-build.bats`, `tests/skill-interfaces.bats`.
- Docs: `README.md`, `docs/resolver-contract.md`, `docs/upgrading.md`, `docs/decisions/ADR-009-the-kit-owns-the-contract.md`, and the three resolver READMEs.
- Users: a checkout user who linked a resolver's dev entry re-links it from `lets/resolvers/`. Nix, mise and tarball users see no change.
