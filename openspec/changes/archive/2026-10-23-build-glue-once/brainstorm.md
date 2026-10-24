**Why:** The four Node programs each carry their own copy of the same bundle script, and `flake.nix` builds them with two copies of the same derivation, so a fix to one copy can miss the others; the critical review (#70, C16) asks for one of each now, while the build is fresh in mind from #78.

## Story

#79 build-glue-once — one bundle script and one Nix derivation function for the four programs. https://github.com/sidereal-io/lets-spec/issues/79

## Decisions

The user handed every choice in this brainstorm to the agent, and asked for the option that removes the most code. Each `User` row below is a choice made on that mandate.

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | What is in scope? | Only the build glue. Each program's bundle stays as it is today: one executable file, `#!/usr/bin/env node` first, the Node 26 check, no `node_modules` beside it. | Evidence: #79, #70 C16 |
| D2 | Where does the one bundle script live? | `contrib/resolver-kit/build.mjs`, run as a script from a package's folder: `node node_modules/resolver-kit/build.mjs`. Delete the four `build.mjs` files in `lets/` and the three resolvers. The kit already holds the bundle step, and all four packages already depend on the kit, so no new folder or dependency is needed. | User |
| D3 | Where does the script get the program name? | From `name` in the `package.json` of the folder it runs in. Each package's name is already its program's name. The bundle goes to `dist/<name>`, or to the path given as the one optional argument, which the tests use. | Evidence: `lets/package.json`, `contrib/*/package.json` |
| D4 | Where does the script get the entry file? | Always `src/main.ts`. Rename `lets/src/cli.ts` to `lets/src/main.ts` so `lets` follows the resolvers' layout, and update `lets/bin/lets`. This drops the entry as a setting. | User |
| D5 | One banner, or one per program? | One banner for all four: the shebang, the Node 26 check with the program's name, and the `createRequire` line `lets` needs for `yaml`. The `require` line does no harm in a resolver. | User |
| D6 | What happens to the package fields the old scripts needed? | `lets` drops its `esbuild` devDependency, since the kit's own `esbuild` runs the bundle. The kit drops `./build.mjs` from `exports`, since nothing imports it any more. If the lockfile change moves the `pnpmDeps` hash, update the hash. | User |
| D7 | What does the one Nix function look like? | `program = name: dir:` builds `pnpm --filter <name> build`, installs `<dir>/dist/<name>` in `libexec/` and wraps it as `bin/<name>`. `lets-cli` is `program "lets" "lets"` with a `postInstall`, through `overrideAttrs`, that copies the default resolver into `contrib/`. The three resolvers call the same function. | User |
| D8 | How do we know nothing broke? | The existing checks: `tests/release-build.bats` builds each bundle through the new script and runs it with no `node_modules`, and `nix flake check` builds `lets-cli` and `dist` and checks `dist` holds single files and no `node_modules`. No new tests. | Evidence: `tests/release-build.bats`, `flake.nix` `checks.dist` |
| D9 | Which docs and comments name the old scripts? | The README layout row for `lets/`, the comment in each `bin/` entry, and the kit's `build.mjs` header. Update them to name the one script. | Evidence: `grep build.mjs` |

## Changes from the story

None. The story stands as written.

Confirmed by user: yes
