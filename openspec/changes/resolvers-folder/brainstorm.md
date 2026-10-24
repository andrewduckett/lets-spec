## Story

#105 resolvers-folder — every install ships the resolvers in resolvers/, and lets finds its default there
https://github.com/sidereal-io/lets-spec/issues/105

Stacked on #104 (`resolvers-in-lets`, pull request #107), which moved the resolvers' source and dev entries into `lets/` and kept every install at `contrib/`.

## Decisions

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | Does the story stay one change? | Yes. About eight tasks: one path constant, one deleted link, the flake, the tests, two specs, the docs and ADR-004. | User |
| D2 | Where does `lets` find its default? | At `resolvers/lets-delegate-subagent` from its package root. In a checkout that is the dev entry `lets/resolvers/lets-delegate-subagent` itself, so `lets/contrib/` and its symlink are deleted. | User |
| D3 | What does each install hold? | The release folder and the Nix `lets` package put the resolvers in `resolvers/`. The release folder's `resolvers/` holds exactly `headless-resolver`, `lets-delegate-cli`, `lets-delegate-subagent` and `lets-delegate-t3`. | User |
| D4 | Is there a compatibility link from `contrib/`? | No. The upgrade note tells mise users to re-link. No resolvers go in `bin/` or `libexec/`. | User |
| D5 | What stays as it is? | The bin names, the protocol self-names, the config word `subagent`, absolute paths for installed resolvers, `headless-resolver` as one `sh` file beside the programs, the flake packages `lets-delegate-t3` and `lets-delegate-cli`, exit 4 for a missing or broken default, and no lookup on `PATH`. | User |
| D6 | Which specs change? | `contrib-resolvers`: the release-folder requirement and its four scenarios say `resolvers/`. `delegate-default`: "The default answers when nothing else does" and the four scenarios of "A missing or broken default fails the request" that name the file say `resolvers/lets-delegate-subagent`. | Evidence: `openspec/specs/contrib-resolvers/spec.md`, `openspec/specs/delegate-default/spec.md` |
| D7 | Do the capability's name and Purpose change? | No. #106 renames `contrib-resolvers` and rewrites its Purpose; a delta cannot change a Purpose, and this delta shows only real changes. | User |
| D8 | Where does the upgrade note go? | In the existing `0.6` section of `docs/upgrading.md`, which #104 added. Its heading and intro widen to say the release folder moved too, a mise row is added, and it says Nix profile and home-manager users need nothing. Older sections stay as written. | User |
| D9 | Which docs change? | `docs/resolver-contract.md` (the default's path, and "The resolvers in `contrib/`"), the three pages in `docs/resolvers/`, the README's Layout row for `lets/` and its Releases paragraph, and the flake's comments. | Evidence: `git grep contrib` on this branch |
| D10 | Which records stay? | `openspec/discovery.md`, archived changes and old upgrade sections record what was true then. ADR-004 is amended in place; no new ADR. | User |
| D11 | How is it accepted? | `pnpm test` and `nix flake check` pass. The `dist` check lists `resolvers/` and runs the tarball's `lets` with nothing else installed; `source-tree.test.ts` runs the checkout's `lets` with no link; `git grep -n contrib` finds nothing outside the kept records, the upgrade note and the capability's name and Purpose. | User |
| D12 | Are there glossary edits? | No. The project has no glossary, and this story agrees no new terms. | Evidence: #103 Shared decisions |

## Changes from the story

- Added: the `0.6` section's heading and intro in `docs/upgrading.md` are rewritten, not only given a mise row. They say a release and mise installs are unchanged, which this story makes false.
- Added: the README's Layout row for `lets/` loses its sentence about the `lets/contrib/` link. The packet named only the Releases paragraph.
- Left for #106: the `contrib-resolvers` Purpose line, which still says `contrib/`. It goes with the capability's rename.

Confirmed by user: yes
