**Why:** The README's mise example installs 0.1.0, a release without the `lets` command, from the old repository name, and it makes every project bump two lines by hand at each release.

## Story

#25 readme-pin-or-latest — the mise section says when to pin and when to follow latest. https://github.com/sidereal-io/lets-spec/issues/25

## Decisions

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | Which files change? | `README.md` only: *With mise* under *Set it up*, and *With mise* under *Updating*. `docs/upgrading.md` already holds the per-release steps and stays as it is. | User |
| D2 | Which form does the example show? | `"github:sidereal-io/lets-spec" = "latest"`. It has no version, so no release needs to bump it, and the release checklist gains no step. | User |
| D3 | Does `latest` work without `asset_pattern`? | Yes. With mise 2026.10.3, `latest` installed 0.5.0 and put `lets` on the path. Each release has one asset, so mise finds it alone. | Evidence: `mise install` in a scratch project |
| D4 | Which repository does the example name? | `sidereal-io/lets-spec`, as this repository's `mise.toml` does. | Evidence: `mise.toml` |
| D5 | How does a reader pin an exact release? | One sentence: replace `latest` with a release number. No version number in the text, so it cannot go stale. | User |
| D6 | What does the README say about `latest`? | It installs the newest release once, and stays on it until `mise upgrade`. | Evidence: issue #25, tested with 0.3.0 |
| D7 | What does the README say about `mise.lock`? | Run `mise lock` and commit `mise.lock`, so every clone and CI get the release `latest` resolved to. | Evidence: `mise lock` in a scratch project wrote version 0.5.0 for `latest` |
| D8 | Does the README show `auto_update`? | No example. One sentence warns against it: it moves the release on its own, and the enter hook then rewrites committed skills on whatever branch you are on. | User |
| D9 | What about the OpenSpec CLI pin? | The existing paragraph already says to pin it to the release's version, and that `lets sync` warns when it differs. Add nothing; #26 owns it. | User |
| D10 | What does *Updating → With mise* say? | Run `mise upgrade`, set the OpenSpec CLI to the version in the release notes, run `lets sync`, and commit `mise.lock` with what `lets sync` wrote. Drop the Dependabot and Renovate lines and the `asset_pattern` bullet: with `latest`, there is no pin in `mise.toml` to bump. | User |
| D11 | Does this change any spec? | No. It changes README text only, so the change sets `skip_specs: true`. | Evidence: `openspec list --specs` has no capability for the README |

## Changes from the story

- Cut: an `auto_update` example. The story allowed recommending it with `LETS_SPEC_SKILLS=ignored`, or not at all. We chose not at all, with one warning sentence, because it adds text and risk for little gain.
- Cut: the release checklist step from the 2026-10-22 review. The example has no version, so it needs no bump.
- Cut: the Dependabot and Renovate sentences under *Updating → With mise*, because a `latest` entry gives them nothing to bump.

Confirmed by user: yes
