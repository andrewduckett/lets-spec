## Why

`contrib/` ships one combined resolver, `lets-delegate-resolver`, which picks between T3 Code and herdr at run time with a `detect()` switch. A user installs code for a harness they may not use. Anyone reading the resolver has to follow two adapters behind one switch. This story is the walking skeleton of epic #46: one program per harness, on a shared kit that later stories build on.

## What Changes

- **New:** `contrib/resolver-kit/`, a workspace package. It holds the code the resolvers share: the protocol, io, errors, env, wait and families. esbuild bundles it into each program (D5).
- **New:** `contrib/t3-resolver/` builds `lets-delegate-t3`, and `contrib/herdr-resolver/` builds `lets-delegate-herdr`. Each package has its own dev entry, bundle, README and tests.
- **New:** each resolver answers only when the process runs inside its own harness. Anywhere else it declines with exit 75, and never looks for the other harness (D2). When it declines, stderr names the resolver and its harness (D10).
- **New:** the resolver contract moves to `docs/resolver-contract.md`, with the `sh` example (D3).
- **BREAKING:** `lets-delegate-resolver` goes: its package, its Nix package and its file in the release folder. There is no alias (D4). A user installs the program for their harness, and names it with `lets delegate setup --resolver <path> --write` (D1).
- **Changed:** `flake.nix` builds one derivation per resolver. The release folder's `contrib/` holds `headless-resolver`, `lets-delegate-herdr` and `lets-delegate-t3` (D6). `pnpm conformance` checks each of the three (D11).
- **Unchanged:** `contrib/headless-resolver`, the resolver protocol, and everything in `lets`: the delegate config, the lookup order, the PATH fallback, the built-in default and setup (D1).

## Capabilities

### New Capabilities

- `contrib-resolvers`: the resolver programs this repository ships in `contrib/`. Covers which programs there are, when each answers or declines, what each does with a handle it never made (D7), what `probe` names (D8), and what the release folder holds.

### Modified Capabilities

None. The `delegate-config`, `delegate-default` and `delegate-setup` specs still name `lets-delegate-resolver` on `PATH`. That behavior of `lets` stays until #49 and #44 change it (D1).

## Impact

- **Code:** `contrib/lets-delegate-resolver/` is split into `contrib/resolver-kit/`, `contrib/t3-resolver/` and `contrib/herdr-resolver/`. `tests/lets-delegate-resolver/` is split the same way, and the copies test follows the kit (D9).
- **Build:** `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.json`, the `test` and `conformance` scripts in `package.json`, and in `flake.nix` the derivations, `dist` and the checks.
- **Tests:** `tests/release-build.bats`, and the `skill-interfaces.bats` test that checks the documented `sh` example.
- **Docs:** the README's *Contrib resolver*, *The T3 Code and herdr resolver*, *Write your own resolver* and layout sections, and the install steps. Plus the new `docs/resolver-contract.md` and a README per resolver.
- **Users:** anyone who installed `lets-delegate-resolver` by Nix, mise or a checkout must switch to `lets-delegate-t3` or `lets-delegate-herdr`. Until #49 and #44 land, `lets` still looks for the old name on `PATH` and finds nothing, so do not cut a release in between.
