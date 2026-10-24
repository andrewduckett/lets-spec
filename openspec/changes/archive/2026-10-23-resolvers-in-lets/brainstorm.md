## Story

#104 resolvers-in-lets — the resolvers' source, tests and dev entries live in the lets package, built once.
https://github.com/sidereal-io/lets-spec/issues/104

## Decisions

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | Does the story stay one change, or split into 1a and 1b? | One change. The split leaves an in-between tree and moves the `lets/contrib/` link and the verify paths twice. | User |
| D2 | Does any install change? | No. The release folder, the Nix `lets` package and `DEFAULT_RESOLVER` keep `contrib/`. The `lets/contrib/lets-delegate-subagent` link is re-pointed at `../resolvers/lets-delegate-subagent`. #105 moves the release. | User |
| D3 | Where does each file go? | As the packet's target layout: the kit and the three adapters in `lets/src/resolvers/{kit,t3,cli,subagent}/`; the three dev entries and `headless-resolver` in `lets/resolvers/`. | User |
| D4 | Where do the three resolver READMEs go? | `docs/resolvers/<id>.md`, for `t3`, `cli` and `subagent`. `lets/src/` holds only code. | User |
| D5 | Does a test check the folder rule (the kit and the adapters import nothing from the command)? | Yes: one unit test fails when a file under `lets/src/resolvers/` imports a path outside that folder. No test checks bundle contents; the import rule already keeps `commander` and `yaml` out. | User |
| D6 | Where do the unit tests go, and how are they listed? | `tests/lets/resolvers/{kit,t3,cli,subagent}/`, fixtures with them. `test`, `tsconfig.json` and the flake's `node-tests` use globs. `verify` names the four dev entries. | User |
| D7 | How is the list of bundles kept? | Three explicit resolver entries beside `lets`'s in `lets/build.mjs`. No discovery machinery in the flake or the verify script. | User |
| D8 | Does `pnpm-workspace.yaml` list `lets` alone, or does the root `package.json` become the package? | The design picks whichever moves fewer lines in `flake.nix`. `allowBuilds: esbuild: false` stays either way. | Evidence: #104 packet, "The workspace" |
| D9 | What does the change do to behaviour, and how is it accepted? | Nothing: files move, and their imports and comments follow. Accepted when `pnpm test` and `nix flake check` pass, with the `dist` check still asserting `contrib/`. | User |
| D10 | Which specs change? | Scenarios that name `contrib/headless-resolver` as a source path, in `delegate-verify` and `contrib-resolvers`, name `lets/resolvers/headless-resolver`. The release-folder requirement and `delegate-default` stay as they are. | Evidence: `openspec/specs/delegate-verify/spec.md`, `openspec/specs/contrib-resolvers/spec.md` |
| D11 | Which decision records change? | ADR-009 is amended in place: the kit's ownership of the contract is now a folder rule inside one package. ADR-004 waits for #105. No new ADR. | User |
| D12 | What does `docs/upgrading.md` get? | One new section, headed `0.6`, the release after v0.5.0, with the checkout row: link `lets/resolvers/lets-delegate-t3` or `lets/resolvers/lets-delegate-cli`. The 0.5 sections stay as written. | Evidence: `git tag` (v0.5.0 is the last release); #103 Shared decisions |
| D13 | What does `lets/package.json` declare? | Package name `lets`; bin `lets`, `lets-delegate-t3`, `lets-delegate-cli`, `lets-delegate-subagent`; `esbuild` as a devDependency; no `resolver-kit`. | User |

## Changes from the story

- The packet left the resolver READMEs' new place to the design. The brainstorm settled it: `docs/resolvers/<id>.md` (D4).
- The packet left the folder-rule test to the brainstorm. It adds one small unit test for the import rule, and no bundle-contents test (D5).

Confirmed by user: yes
