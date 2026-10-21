## Context

`contrib/lets-delegate-resolver/` is one pnpm workspace package. `src/resolver.ts` takes both adapters, `{ t3, herdr }`. It sends `probe`, `run` and `start` to the first one whose `detect()` is true, and routes `finish` by handle kind (`thread` to T3, `tab` to herdr). `src/main.ts` wires the real io to it. The other files are shared or harness-specific:

| Shared by both adapters | T3 only | herdr only |
|---|---|---|
| `protocol.ts`, `errors.ts` (copies of `lets/src/delegate/`, checked by `copies.test.ts`), `io.ts`, `env.ts`, `wait.ts`, `families.ts`, `adapter.ts` | `t3.ts` | `herdr.ts` |

`build.mjs` bundles `src/main.ts` with esbuild into one file. It puts a Node 26 check on top, and `bin/` runs the source through type stripping. The flake builds one derivation from the whole workspace with a fixed `pnpmDeps` hash. `dist` copies the bundle into the release folder's `contrib/`, and `dist-check` asserts what that folder lists. The tests in `tests/lets-delegate-resolver/` use `fixtures/fake-io.ts`, and so do `tsconfig.json` and the root `test` script.

## Goals / Non-Goals

**Goals:**
- Each program's code is its harness's adapter plus a short entry. Everything else comes from the kit.
- The protocol logic in `resolver.ts` moves into the kit almost unchanged. The only logic that changes is that "pick the adapter that detects" becomes "the one adapter detects, or decline".
- Git history follows each file: moves are `git mv`.

**Non-Goals:**
- Changing an adapter's behavior inside its harness: how it spawns, waits or finishes.
- Making the kit usable outside this repository, or giving it a public API.
- Any change under `lets/` (D1).
- `lets-delegate-subagent` (#48). The kit only has to leave room for it.

## Test Seams

- **Primary test seam:** each program's request handler, driven with a verb, a JSON request and a fake io, which asserts the exit code, stdout and stderr. This is today's `handle()` seam in `tests/lets-delegate-resolver/resolver.test.ts`, bound to one real adapter on `fakeIo` instead of two fakes. It covers every spec requirement except the release folder, the flake and conformance.
- **Existing seams reused:** the adapter tests (`t3.test.ts`, `herdr.test.ts`) with `fixtures/fake-io.ts` and `t3-schema.sql`, which move with their adapters. `copies.test.ts`, which follows the kit. `pnpm conformance`, run against each dev entry. `tests/release-build.bats` for a bundle that runs with no `node_modules`. The flake's `dist-check` for the release folder and `nix build` for the packages.

## Scrutiny Tier & Blast Radius

- **Tier:** medium. Code moves between packages, but no protocol, config or `lets` behavior changes. The one new behavior is the per-harness decline. The release folder and the Nix packages change their names, which is a break for users.
- **Blast radius:** `contrib/` (three packages instead of one), `tests/` for the resolvers, `flake.nix` (packages, `dist`, `dist-check`, `node-tests`), the root build config (`package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.json`) and the docs. `lets/` is untouched.

## Decisions

### The layout

```
contrib/resolver-kit/      package "resolver-kit": src/{protocol,errors,io,env,wait,families,adapter,resolver,main}.ts, build.mjs
contrib/t3-resolver/       package "lets-delegate-t3": src/{t3,main}.ts, bin/lets-delegate-t3, build.mjs, README.md
contrib/herdr-resolver/    package "lets-delegate-herdr": src/{herdr,main}.ts, bin/lets-delegate-herdr, build.mjs, README.md
tests/resolver-kit/        copies, resolver (fake adapter), families, fixtures/fake-io.ts
tests/t3-resolver/         t3 adapter, and the program end to end on fakeIo; fixtures/t3-schema.sql
tests/herdr-resolver/      herdr adapter, and the program end to end on fakeIo
```

Tests stay under `tests/<package>/`, which is the repository's convention, and not inside each package. `fake-io.ts` is shared, so it lives in the kit's tests. The root `test` script globs `tests/{resolver-kit,t3-resolver,herdr-resolver}/*.test.ts`. `tsconfig.json` includes `contrib/*/src` and those test folders. A test imports the kit and each program's files by relative path, such as `../../contrib/resolver-kit/src/protocol.ts`. The root package does not depend on the kit, so a bare `resolver-kit` import from `tests/` would not resolve, for Node or for `tsc`.

*Alternative:* tests inside each package, run by a `test` script in each. Rejected: CI and the flake's `node-tests` run one `node --test` from the root, and splitting it adds a recursive run for no gain.

### The kit is a workspace package, imported by name

Each resolver depends on `"resolver-kit": "workspace:*"` and imports `resolver-kit/protocol.ts` and the other files through an `exports` map that points at the `.ts` sources. pnpm links the package into each resolver's `node_modules`. Node resolves the link to its real path under `contrib/resolver-kit/`, so type stripping still runs on the dev entry, which Node refuses inside `node_modules`. esbuild bundles the kit into each program, so a release copy needs no `node_modules` beside it.

*Alternative:* relative imports such as `../../resolver-kit/src/protocol.ts`. They need no package at all, but they hide the dependency from pnpm and from a reader. The packet and the epic name a workspace package (D5). The relative imports stay the fallback if the dev entry hits the type-stripping limit (see Risks).

### One adapter per program, and the kit's handler declines

The kit's `Adapter` type gains the facts a single-harness program needs, beside `detect()`, `availableFamilies()`, `spawn()`, `waitForResult()` and `finish()`:

- `name`: what `probe` answers, `t3` or `herdr` (D8).
- `program`: the prefix for every stderr line, `lets-delegate-t3` or `lets-delegate-herdr`.
- `harness`: the words in the decline message, `T3 Code` or `herdr` (D10).
- `handleKind`: the one kind it makes, `thread` or `tab`.

The kit's `handle(verb, input, adapter)` is today's `resolver.ts`, with two changes:

- **probe, run and start:** when `adapter.detect()` is false, the handler declines with exit 75, empty stdout, and `<program>: not inside <harness>` on stderr. When it is true, the verb goes to that adapter as today.
- **finish:** when `handle.kind` is not `adapter.handleKind`, the handler throws a `SpawnError` (exit 4) before it calls the adapter (D7). Otherwise the call goes to `adapter.finish` as today. `finish` does not check `detect()`, as today, so a session can be cleaned up from anywhere.

The kit's `main.ts` exports `runResolver(createAdapter)`. It reads the verb from argv and the request from stdin, calls `handle` with the adapter built on `realIo()`, and writes the answer. Each program's own `src/main.ts` is one call: `runResolver(createAdapter)`.

*Alternative:* keep a list of adapters in the kit and give each program a list of one. Rejected: it keeps the switch the epic removes, and a reader of `lets-delegate-t3` would still meet code for picking between harnesses.

### One shared bundle function

`contrib/resolver-kit/build.mjs` exports `bundle({ entry, outfile, program })`. That is today's esbuild call, with the program's name in the Node-version banner. Each resolver's `build.mjs` calls it with its own entry and its default outfile, `dist/<program>`. esbuild is a devDependency of the kit. Each `bin/<program>` keeps today's dev-entry shape: the Node check, then `import('../src/main.ts')`.

*Alternative:* a full copy of `build.mjs` in each package. It is twenty-odd lines, but the banner and the esbuild options must stay the same in each, and a third program (#48) is coming.

### One Nix function, two packages

The flake gets `resolver = program: dir: pkgs.stdenv.mkDerivation { … }`, which is today's derivation with the names as parameters, run as `pnpm --filter <program> build`. It provides `packages.lets-delegate-t3` and `packages.lets-delegate-herdr`, and no longer `packages.lets-delegate-resolver` (D4). `dist` copies each bundle to `contrib/<program>`. `dist-check` asserts three things about `contrib/`. It lists exactly `headless-resolver lets-delegate-herdr lets-delegate-t3`. Each Node program starts with the `#!/usr/bin/env node` shebang. And each declines `probe` with exit 75 and its own decline message on stderr. `tests/release-build.bats` builds both bundles in the same way, and checks the same exit code and message for each. `node-tests` runs `patchShebangs` on both new `bin/` folders. A new workspace package changes `pnpm-lock.yaml`, so `pnpmDeps`'s hash is renewed as the flake's comment says.

### The docs

- `docs/resolver-contract.md` takes the old README's *The contract* and *Write your own* sections whole, with the `sh` example (D3). Its *How `lets` finds a resolver* part still says `lets-delegate-resolver` on `PATH`, because that is still how `lets` behaves (D1). It also says that no program by that name ships any more, and that #49 removes the step.
- `contrib/t3-resolver/README.md` and `contrib/herdr-resolver/README.md` each give: what the program does, how to install it (home-manager, Nix profile, mise from the release folder, a checkout), and how to name it with `lets delegate setup --resolver <path> --write` and check it with `lets delegate conformance`. The T3 one keeps *Before the first review in T3 Code* and *After a t3 update*.
- In the main README, the *Contrib resolver* row and *The T3 Code and herdr resolver* section name the two programs and link to their READMEs. *Write your own resolver* links to `docs/resolver-contract.md`. The layout table and the `pnpm build` and `nix build` lines name the new packages. A *Switching from lets-delegate-resolver* note gives the one-line move for each install method. It also says that the config names one resolver for now. A user of both T3 Code and herdr names the one they review from most, and the other harness's reviews fall to the built-in default.
- `pnpm conformance` checks `tests/lets/delegate/fixtures/default-resolver`, as it does today, as well as the three contrib programs (D11).
- `contrib/headless-resolver`'s header comment points at `docs/resolver-contract.md`. `skill-interfaces.bats` diffs the example against that doc.

### Commits

The split lands as a few commits, one per unit of work. Each commit leaves both `pnpm test` and `nix flake check` passing. So no commit removes a path while anything still names it: `package.json`'s scripts, `tsconfig.json`, `flake.nix`, `tests/release-build.bats` or `tests/skill-interfaces.bats`.

- The new packages, the flake's new packages and the contract doc can land beside the old package, which keeps building until it goes.
- One commit deletes `contrib/lets-delegate-resolver/` and `packages.lets-delegate-resolver`. It updates every reference above at the same time. This is the `feat!` commit, with a `BREAKING CHANGE:` footer.

The tasks step sets the exact cut.

## Risks / Trade-offs

- [Node refuses to strip types for a file it sees as inside `node_modules`, so the dev entry would fail to import the kit] → Node resolves the workspace symlink to the real path by default, which is outside `node_modules`. The first task proves it by running `bin/lets-delegate-t3 probe` before anything else is built on it. If it fails, switch to relative imports and keep the package only for pnpm.
- [The `pnpmDeps` hash is stale after the lockfile changes, and every Nix build fails] → renew it in the same commit as the lockfile change, with the `lib.fakeHash` steps the flake's comment gives, and run `nix flake check` before pushing.
- [A user upgrades the pin and their reviews quietly fall back to the built-in default, because `lets-delegate-resolver` is gone from PATH] → the change is marked breaking. The README says how to switch, and the release notes must say it too. Do not cut a release before #49 and #44 (D1).
- [Two copies of the adapter seam: `Adapter` in the kit, and #48's subagent resolver may need something else] → `subagent` also makes a session in one place and declines nowhere, so the same four facts fit. #48 can widen the type if it must.
- [Moving files breaks `git blame` for a reader] → use `git mv`, with each move in a commit of its own before any edit to the moved file.

## Migration & Rollback

- **Users:** replace `lets-delegate-resolver` with `lets-delegate-t3` or `lets-delegate-herdr`. With Nix, change the package name in home-manager, or run `nix profile remove` and then `nix profile add .#lets-delegate-t3`. With mise, change the symlink to point at `contrib/lets-delegate-t3` in the release folder. Then run `lets delegate setup --resolver <path> --write`, because the PATH fallback no longer finds anything (D1).
- **Rollback:** revert the change's commits. Nothing changes shape on disk: the delegate config keeps version 1 and its single `resolver` field, so a config that names the new program still parses after a revert. It just names a file that no longer exists, and `lets` says to run setup again.
