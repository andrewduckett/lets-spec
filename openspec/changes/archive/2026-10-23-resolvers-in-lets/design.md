## Context

Today the pnpm workspace has five members: `lets` and the four packages under `contrib/`. `lets` and each resolver import the kit as `resolver-kit/<file>.ts` through a `workspace:*` link. The tests import the kit by relative path into `contrib/`. `contrib/resolver-kit/build.mjs` bundles one program per run, from the folder it runs in, into `dist/<package name>` or the path given as its first argument. The flake's `program` function builds each package on its own with `pnpm --filter <name> build`, so a change to the workspace builds four times.

Constraints that shape the approach:

- Nothing a user installs moves (D2). The flake's `lets-cli` and `dist` outputs and their checks keep `contrib/`.
- No logic changes (D9). Moved files keep their content apart from import paths and comments that name paths.
- The flake's `workspaceSource` must hold every workspace member, or the lockfile does not match.

## Goals / Non-Goals

**Goals:**

- Move files with `git mv`, so `git log --follow` and blame still work for #85, #87, #89 and #102.
- One build that writes every bundle, used by the tests, `pnpm build` and the flake alike.

**Non-Goals:**

- Moving the release folder, the Nix `lets` package's `contrib/`, or `DEFAULT_RESOLVER`. That is #105.
- Renaming the `contrib-resolvers` capability. That is #106.
- Tidying code while it moves.

## Test Seams

- **Primary test seam:** `pnpm test`: the Node tests by glob, the type check, `pnpm verify` against the four dev entries, and the bats tests. `nix flake check` runs the same tests in the sandbox and builds the packages and the release folder.
- **Existing seams reused:** every moved unit test, unchanged apart from its imports; `tests/lets/delegate/source-tree.test.ts`, which catches a dangling `lets/contrib/` link; `tests/release-build.bats`, which runs each bundle with no `node_modules`; the flake's `dist` and `commands` checks, which prove no install moved. The one new test, for the folder rule (D5), sits in `tests/lets/resolvers/`.

## Scrutiny Tier & Blast Radius

- **Tier:** medium. The change is mechanical, but it touches the build, the flake and every resolver's source.
- **Blast radius:** the source tree, the workspace manifest and lockfile, and the flake's package derivations. No protocol, config or release layout changes.

## Decisions

### The workspace keeps `pnpm-workspace.yaml`, listing `lets` alone

The packet asks for whichever shape moves fewer lines in `flake.nix` (D8). Keeping `lets` as the one member moves almost none: `workspaceSource` already lists `./lets`, the version still comes from `./lets/package.json`, and `pnpm --filter lets build` still works. Making the root `package.json` the package would move `version`, `bin/lets`, the dependencies and every path the flake reads from `lets/`. The root `package.json` keeps the shared devDependencies (`typescript`, `@types/node`) and the scripts. `allowBuilds: esbuild: false` stays.

### `lets/build.mjs` bundles every entry into one output folder

The script runs from `lets/`. Its entries are a literal list of four pairs: `lets` from `src/main.ts`, and `lets-delegate-<id>` from `src/resolvers/<id>/main.ts` for `t3`, `cli` and `subagent` (D7). Each bundle gets the banner it has today, naming its own program. The one optional argument is the output folder, which defaults to `dist`; the bundles are written to `<folder>/<program>`.

Alternatives: keep one entry per run, chosen by argument. That keeps a build per program in the flake, which the story removes. An output-file argument no longer fits a script that writes four files.

`lets/package.json` runs it as `"build": "node build.mjs"`, lists `esbuild` as a devDependency, and names the four programs under `bin` (D13). The root `build` script becomes `pnpm --filter lets build`.

### The flake builds once, and each program installs one file from that build

A new derivation, `bundles`, runs `pnpm --filter lets build` and installs `lets/dist/*` into `$out/libexec/`. `program name` becomes a small `runCommand` that copies `${bundles}/libexec/${name}` to `$out/libexec/${name}` and writes the same `bin/${name}` wrapper as today, with `meta.mainProgram`. `lets-bundle`, `lets-delegate-t3`, `lets-delegate-cli` and `lets-delegate-subagent` each call it with a name only, so every output that reads `.../libexec/<name>` from them stays as it is. `dist` installs the example from `./lets/resolvers/headless-resolver`. `workspaceSource` drops `./contrib` and keeps excluding `lets/contrib`. Its comment changes too: the link now points inside `lets/`, and the build still never reads it. The lockfile changes, so `pnpmDeps`'s hash is reset with `lib.fakeHash` and replaced with the hash Nix prints.

`node-tests` runs `node --test "tests/**/*.test.ts"` and `patchShebangs tests lets/resolvers`. The `.bats` files sit outside the glob, so the runner never sees them.

### The dev entries move beside each other, and the link follows

`lets/resolvers/lets-delegate-<id>` is the old `bin/` entry, with its import changed to `../src/resolvers/<id>/main.ts` and its comment naming `lets/build.mjs`. `lets/bin/lets`'s comment names the same script. `lets/contrib/lets-delegate-subagent` is re-pointed at `../resolvers/lets-delegate-subagent` (D2). `headless-resolver`'s "Check it with" comment names its new path.

### Imports become relative paths

- `lets/src/delegate/*.ts`: `resolver-kit/<file>.ts` becomes `../resolvers/kit/<file>.ts`. `lets/src/main.ts` uses `./resolvers/kit/<file>.ts`.
- Each adapter: `resolver-kit/<file>.ts` becomes `../kit/<file>.ts`. The kit's own imports are already relative within the folder.
- Tests under `tests/lets/resolvers/<id>/` import `../../../../lets/src/resolvers/<id>/<file>.ts`, and the shared kit fixtures as `../kit/fixtures/<file>.ts`. Tests under `tests/lets/delegate/` import `../../../lets/src/resolvers/kit/<file>.ts`, and name `lets/resolvers/...` where they name a dev entry or the example.

### One test keeps the folder rule

`tests/lets/resolvers/folder-rule.test.ts` reads every `.ts` file under `lets/src/resolvers/`. It collects the specifier of each `import ... from`, `export ... from` and `import(...)`, matching only at the start of a statement, so a comment that names a package is not read as an import. A relative specifier must resolve inside `lets/src/resolvers/`, and a bare one must start with `node:` (D5). That covers both halves of the rule: nothing from the command's own files, and no `commander` or `yaml`.

The test reads text with regular expressions and parses no TypeScript. TypeScript 7, the version the project uses, has no JavaScript compiler API to parse with, and a parser would be a new dependency. The rule runs one way, as #103's Shared decisions state it: the test does not check what `lets/src/delegate/` imports from the kit.

### The resolver READMEs move to `docs/resolvers/<id>.md`

Each README moves with `git mv` (D4). Its relative links are rewritten for the new folder: the contract becomes `../resolver-contract.md`, the main README `../../README.md`, and a sibling resolver `cli.md` or `t3.md`. The "A checkout of this repository" rows, the `ln -sf "$PWD/contrib/..."` lines and the test commands name `lets/resolvers/...` and `tests/lets/resolvers/...`. Their release-folder lines (`contrib/lets-delegate-<id>`) stay for #105. `tests/skill-interfaces.bats` reads `docs/resolvers/*.md` in place of `contrib/*/README.md`.

### The release-build tests copy one bundle into an empty folder

`tests/release-build.bats` builds every bundle once per test into `$BATS_TEST_TMPDIR/build`, with `node build.mjs "$BATS_TEST_TMPDIR/build"` run from `lets/`. The `lets` test and `bundle_alone` then copy the one program they check into an empty folder. `bundle_alone` takes the program's name alone, such as `bundle_alone lets-delegate-t3`, since no package folder is left to name.

Each test keeps its assertions on the copied file. It is the only file in its folder, it is executable, and its first line is `#!/usr/bin/env node`. This matches the spec's "copied into an empty directory".

### The docs and ADR-009

- `README.md`: the Layout table gets one `lets/` row that names `src/resolvers/`, `resolvers/` and `build.mjs`, in place of the four `contrib/...` rows. The Testing rows for `pnpm verify` and `pnpm build` name the new paths. The links at the resolver table, the example and "After a T3 update" point at `docs/resolvers/` and `lets/resolvers/headless-resolver`. The release-folder sentence that says `contrib/` stays.
- `docs/resolver-contract.md`: the links to `protocol.ts`, `env.ts` and the example name their new paths, and the sentence about the kit says it is a folder in `lets`. The "How lets finds a resolver" text about `contrib/` stays for #105.
- `docs/upgrading.md`: one new section at the top, `## 0.6: the resolvers' dev entries moved`, with one row for a checkout of this repository (D12).
- ADR-009 is amended in place (D11): its context names `lets/src/resolvers/kit/`, its decision says the kit owns the contract as a folder rule inside one package that a test checks, and a dated note records that one package replaced the kit package.

## Risks / Trade-offs

- [The flake's packages lose a file or install the wrong one] → the `dist` check lists the release folder's `contrib/` and runs each bundle; the `commands` check runs the packaged `lets` and its default.
- [The `lets/contrib/` link dangles after the move] → `tests/lets/delegate/source-tree.test.ts` runs the source tree's `lets` through it.
- [A missed import or path] → the type check covers every `.ts` file under `lets/src` and `tests`; `pnpm verify` runs each dev entry; a stale link in a README goes unchecked, so the task that moves the docs greps for `contrib/` afterwards.
- [Open pull requests that edit resolver source conflict] → files move with `git mv` and their content is unchanged, so a rebase is a path change. This lands first.
- [Each bats test now builds four bundles, not one] → esbuild takes well under a second per bundle; the cost is small.

## Migration & Rollback

A checkout user who linked a dev entry, such as `contrib/t3-resolver/bin/lets-delegate-t3`, re-links `lets/resolvers/lets-delegate-t3`; the new `docs/upgrading.md` section says so. Mise, Nix and tarball installs are unchanged. Rollback is reverting the pull request.
