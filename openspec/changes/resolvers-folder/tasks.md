## 1. The default's path

- [x] 1.1 [easy] `lets` asks its default at `<packageRoot>/resolvers/lets-delegate-subagent`: first make the unit tests expect it and fail (`SUBAGENT` in `tests/lets/delegate/lookup.test.ts` and `fixtures/command-deps.ts`, the source-tree case and its comment in `lookup.test.ts`, the matches in `handoff.test.ts` and `review.test.ts`), then set `DEFAULT_RESOLVER` in `lets/src/delegate/lookup.ts` (design.md, "Change the constant, not the lookup") (verify: `node --test "tests/lets/delegate/*.test.ts"`) (✓ `node --test "tests/lets/delegate/*.test.ts"` passed: 182 pass, 0 fail; 17 failed before the constant changed)
- [x] 1.2 [easy] The checkout's `lets/bin/lets` finds the default's dev entry with no link: `git rm` `lets/contrib/lets-delegate-subagent`, and rewrite `source-tree.test.ts`'s header to say so (verify: `test ! -e lets/contrib && node --test tests/lets/delegate/source-tree.test.ts`) (✓ `test ! -e lets/contrib && node --test tests/lets/delegate/source-tree.test.ts` passed: 1 pass)

## 2. Ship the resolvers in resolvers/ [depends-on: 1]

- [x] 2.1 [medium] The flake's `lets-cli` installs the default at `$out/resolvers/`, `dist` copies the four files into `$out/resolvers/`, and the `dist` check lists, probes and copies from `${dist}/resolvers` and fails if `${dist}/contrib` exists; `workspaceSource` loses its `lets/contrib` exclusion, and the comments say `resolvers/` (design.md, "Delete `lets/contrib/` and its exclusion" and "The flake installs into `resolvers/`") (verify: `nix build --no-link .#lets-cli ".#checks.$(nix eval --impure --raw --expr builtins.currentSystem).dist"`) (✓ `nix build --no-link .#lets-cli .#checks.x86_64-linux.dist` passed)
- [ ] 2.2 [parallel] [easy] `tests/release-build.bats`'s `bundle_alone` copies each bundle into a `resolvers/` folder, and its comment says the tarball ships `resolvers/<program>` (verify: `bats tests/release-build.bats`)

## 3. Point the docs at resolvers/ [depends-on: 1]

- [ ] 3.1 [parallel] [easy] `docs/resolver-contract.md`, `docs/resolvers/{subagent,t3,cli}.md` and `README.md` name `resolvers/` for the default, the release folder and the mise `ln -sf` lines; the subagent page's checkout row is the dev entry with no link; the README's Layout row loses its `lets/contrib/` sentence (design.md, "Docs") (verify: `! grep -n contrib README.md docs/resolver-contract.md docs/resolvers/*.md && bats tests/skill-interfaces.bats`)
- [ ] 3.2 [parallel] [easy] `docs/upgrading.md`'s `0.6` section is headed `0.6: the resolvers moved to resolvers/`, says Nix profile and home-manager users need nothing, and gains a mise row to re-link `resolvers/lets-delegate-t3` or `resolvers/lets-delegate-cli` from the release folder; the 0.5 sections stay as written (verify: `sed -n '/^## 0.6/,/^## 0.5/p' docs/upgrading.md | grep -q 'resolvers/lets-delegate-cli' && grep -q 'contrib/t3-resolver/bin/lets-delegate-t3' docs/upgrading.md`)
- [ ] 3.3 [parallel] [easy] ADR-004, amended in place, says each `lets` carries the default in a `resolvers/` folder beside itself and a checkout needs no link, with a dated `## Amendments` entry like ADR-009's (verify: `grep -q 'resolvers/' docs/decisions/ADR-004-default-resolver-is-a-program.md && grep -q '^## Amendments' docs/decisions/ADR-004-default-resolver-is-a-program.md`)

## 4. Check the whole change [depends-on: 2, 3]

- [ ] 4.1 [medium] No `contrib` mention is left outside OpenSpec's own files, the upgrade notes and ADR-004's amendment (review each of those by hand against design.md's Risks list), and both project checks pass (verify: `! git grep -n contrib -- ':!openspec' ':!docs/upgrading.md' ':!docs/decisions/ADR-004-default-resolver-is-a-program.md' && pnpm test && nix flake check`)

## Deviations Ledger
