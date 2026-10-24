## Context

`lets` finds its default at `join(packageRoot, DEFAULT_RESOLVER)` in `lets/src/delegate/lookup.ts`, and runs it with its own Node. `packageRoot` is the folder above the running `lets` file (`lets/src/main.ts:23`): the release folder for the tarball, the Nix `lets-cli` output, or `lets/` in a checkout. Today `DEFAULT_RESOLVER` is `contrib/lets-delegate-subagent`, so the checkout needs the symlink `lets/contrib/lets-delegate-subagent` → `../resolvers/lets-delegate-subagent`.

`flake.nix` has four places that name `contrib/`: `workspaceSource` excludes `lets/contrib`, `lets-cli` installs the default at `$out/contrib/`, `dist` copies four files into `$out/contrib/`, and the `dist` check lists, probes and copies from `${dist}/contrib`.

## Goals / Non-Goals

**Goals:**
- One path, `resolvers/lets-delegate-subagent`, that is true from every package root, so no install needs a link.
- Every check that guards the packaging today guards the new folder.

**Non-Goals:**
- Any change to the lookup's logic, the resolvers' code, the protocol or the config.
- A check that `contrib/` is absent. The `dist` output is built fresh, and the `ls` check pins `resolvers/` exactly.
- The `contrib-resolvers` capability's name and Purpose (#106).

## Test Seams

- **Primary test seam:** the flake's `dist` check. It lists `${dist}/resolvers`, runs each bundle alone, and runs the tarball's `lets delegate handoff run` with nothing else installed, so a packaging miss fails it.
- **Existing seams reused:** `tests/lets/delegate/source-tree.test.ts`, which runs the checkout's `lets/bin/lets` as a process and now proves no link is needed; `tests/lets/delegate/lookup.test.ts` and the `handoff` and `review` tests, which pin the default's path; `tests/release-build.bats`'s `bundle_alone`.

## Scrutiny Tier & Blast Radius

- **Tier:** medium. One constant and the packaging change; a miss is exit 4 at run time for every user with no config.
- **Blast radius:** `lets/src/delegate/lookup.ts`, the flake's `lets-cli` and `dist` outputs, and the paths mise users link. No data, no protocol.

## Decisions

### Change the constant, not the lookup

`DEFAULT_RESOLVER` becomes `'resolvers/lets-delegate-subagent'`. Because `packageRoot` is `lets/` in a checkout, the path lands on the dev entry `lets/resolvers/lets-delegate-subagent`, which already runs with `node <path>` today through the link. The alternative, a second candidate path for checkouts, adds a branch to the lookup for no gain.

### Delete `lets/contrib/` and its exclusion

`git rm lets/contrib/lets-delegate-subagent`. `workspaceSource` drops its `lib.fileset.difference` and becomes the plain `unions` of the workspace files, and the comment about `lets/contrib/` goes. A compatibility link is ruled out (D4).

### The flake installs into `resolvers/`

- `lets-cli`: `install -Dm755 … $out/resolvers/lets-delegate-subagent`, and its comment says `resolvers/`.
- `dist`: `mkdir -p $out/bin $out/releases $out/resolvers`, then the same four copies into `$out/resolvers/`. Its comment drops the word "contrib".
- The `dist` check: every `${dist}/contrib` becomes `${dist}/resolvers`, including the exact `ls` list, the shebang loop, `declines` and the copy-alone step.
- The `node-tests` comment "the contrib resolvers" becomes "the resolvers".

The `lets-delegate-t3`, `lets-delegate-cli` and `lets-delegate-subagent` derivations keep `libexec/`; they are build inputs and profile packages, not the release layout.

### Tests first, then the constant

The unit tests pin the path, so they go red first: `SUBAGENT` in `lookup.test.ts` and `fixtures/command-deps.ts` becomes `/pkg/resolvers/lets-delegate-subagent`, the source-tree case in `lookup.test.ts` expects `join(SOURCE.packageRoot, 'resolvers/lets-delegate-subagent')`, and the `handoff` and `review` matches name `resolvers/lets-delegate-subagent`. The constant then turns them green. `source-tree.test.ts` stays green throughout; its header says it runs the checkout's default dev entry with no link. `lookup.test.ts`'s comment about `contrib/` linking goes the same way. `release-build.bats`'s `bundle_alone` copies into `$BATS_TEST_TMPDIR/resolvers/`, and its comment says the tarball ships `resolvers/<program>`.

### Docs

- `docs/resolver-contract.md`: the default runs from `resolvers/lets-delegate-subagent`; "The resolvers in `contrib/`" becomes "The resolvers that ship with `lets`".
- `docs/resolvers/subagent.md`: the opening line and the "Where lets finds it" table name `resolvers/lets-delegate-subagent`; the checkout row is `lets/resolvers/lets-delegate-subagent`, the dev entry, with no link.
- `docs/resolvers/t3.md` and `cli.md`: the release-folder sentence and the mise `ln -sf` line name `resolvers/lets-delegate-<id>`.
- `README.md`: the Layout row for `lets/` loses its sentence about `lets/contrib/`; the Releases paragraph says "the four resolvers in `resolvers/`".
- `docs/upgrading.md`: the `0.6` section is retitled `0.6: the resolvers moved to resolvers/`. Its intro says the release folder ships the resolvers in `resolvers/` and the dev entries moved in a checkout, and that Nix profile and home-manager users need nothing. It gains a mise row above the checkout row: remove the old link from `~/.local/bin`, and link `resolvers/lets-delegate-t3` or `resolvers/lets-delegate-cli` from the release folder. The 0.5 sections stay (D8, D10).
- ADR-004: the Decision says each `lets` carries the default in a `resolvers/` folder beside itself, and that in a checkout the dev entry sits at that path, so no link is needed. A dated `## Amendments` entry records the change, as ADR-009's does (D10).

## Risks / Trade-offs

- [A flake output installs the default in the old folder, so `lets` exits 4] → the `dist` check runs the tarball's `lets` with nothing installed; the `commands` check runs the packaged `lets`.
- [A stale `contrib/` path in prose] → no test reads release paths in prose. A task greps the tree for `contrib/` and allows only the archived changes, `openspec/discovery.md`, the 0.5 upgrade section and the `contrib-resolvers` name and Purpose.
- [Mise users' links break on upgrade] → accepted (D4). The `0.6` note says how to re-link; the link already names one version, so they re-run it on every update anyway.

## Migration & Rollback

Mise users re-link from `resolvers/` after updating, as the `0.6` note says. Nix users need nothing. Rollback is a revert of the change; no data changes shape.
