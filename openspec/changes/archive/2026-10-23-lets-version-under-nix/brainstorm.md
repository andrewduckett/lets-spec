**Why:** Under Nix, `lets --version` always prints `0.0.0-dev` and the OpenSpec CLI version warning never fires, so a Nix user cannot check an upgrade, and the README promises a warning they never get.

## Story

#19 lets-version-under-nix — lets --version prints the release version on every install
https://github.com/sidereal-io/lets-spec/issues/19

## Decisions

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | Which of the issue's two fixes? | One version source that the flake and the release workflow both read. It also lets the warning fire under Nix, so the docs-only fix is not needed. | User (delegated: prefer one source if it fixes the warning too) |
| D2 | Where does the version live? | The `version` field of `lets/package.json`, which exists and is unused. No new `VERSION` file. | User (delegated: fewest new parts) |
| D3 | What does the release workflow do with it? | It checks that the tag, without its `v`, equals that version, and fails with a clear message if not. It no longer rewrites `release.json` with `jq`. | User (delegated) |
| D4 | Where does the Nix build put `release.json`? | In the `lets` package itself, beside `libexec/`, where `lets` already looks for it. `dist` copies that same file, so both installs ship one file built one way. | Evidence: `lets/src/main.ts` reads `<packageRoot>/release.json` |
| D5 | Where does the version warning read `release.json`? | From the package folder, the same file `--version` reads, not two folders above the release. In the tarball these are the same file. | Evidence: `lets/src/sync/release.ts:31`, `findRelease` |
| D6 | What version does the file hold now? | `0.5.0`, the last tag. A release bumps it in the commit it tags. | User (delegated) |
| D7 | What does a run from the source tree print? | Still `0.0.0-dev`: it has no `release.json`. | Evidence: `lets/src/main.ts` `version()` |
| D8 | What if `WORKFLOW_RELEASE` points at some other release folder? | The warning compares against the `lets` package's own `release.json`. Under Nix the wrapper always sets a release built from the same flake, so they match. | Assumption |
| D9 | Which docs change? | One line in the README's *Releases* section: bump `lets/package.json` before you tag. The README's warning claim becomes true under Nix, so it stays. | User (delegated: scope allows one line) |
| D10 | How do we prove it? | The flake checks assert that the Nix `lets --version` and the `dist` `lets --version` print the `lets/package.json` version, and unit tests cover the warning reading the package's `release.json`. | Assumption |

## Changes from the story

- Dropped the second suggestion (document `nix flake metadata` in *Updating*). The one version source makes it unnecessary.
- The story's last section, the OpenSpec CLI version warning under Nix, is in scope and is fixed by the same change (D5).

Confirmed by user: yes
