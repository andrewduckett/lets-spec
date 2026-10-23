## 1. The README's mise sections

The decisions are in brainstorm.md (D1 to D11). Every task edits `README.md`.

- [x] 1.1 [easy] The example under *Set it up → With mise* installs `"github:sidereal-io/lets-spec" = "latest"`, with no `asset_pattern` and no `andrewduckett` (verify: `! grep -qE 'asset_pattern|andrewduckett' README.md && grep -qF '"github:sidereal-io/lets-spec" = "latest"' README.md`) (✓ verify passed)
- [x] 1.2 [easy] The sentence that says to change the version and the `asset_pattern` together is gone. In its place, *With mise* says that `latest` installs the newest release once and stays on it until `mise upgrade`, and that to pin an exact release you replace `latest` with its number (verify: `! grep -q 'Change them together' README.md && grep -q 'until `mise upgrade`' README.md`) (✓ verify passed)
- [x] 1.3 [easy] *With mise* tells the reader to run `mise lock` and commit `mise.lock`, so every clone and CI get the same release (verify: `grep -q 'mise lock' README.md`) (✓ verify passed)
- [ ] 1.4 [easy] *With mise* has one sentence that warns against `auto_update`: it moves the release on its own, and the enter hook then rewrites committed skills on whatever branch you are on (verify: `grep -q 'auto_update' README.md`)
- [ ] 1.5 [easy] Step 4's list of files to commit names `mise.lock` beside `mise.toml` (verify: `grep -qF '`mise.toml` and `mise.lock`, if you use mise' README.md`)
- [x] 1.6 [easy] *Updating → With mise* says: run `mise upgrade`, set the OpenSpec CLI to the version in the release notes, run `lets sync`, and commit `mise.lock` with what `lets sync` wrote. The Dependabot, Renovate and `asset_pattern` lines are gone (verify: `! grep -qE 'Dependabot does not read|Renovate' README.md && grep -q 'mise upgrade' README.md`) (✓ verify passed)
- [ ] 1.7 [easy] The project's checks pass with the new README (verify: `pnpm test`)

## Deviations Ledger

- Order: 1.2 and 1.6 are done before 1.1. The check for 1.1 needs `asset_pattern` gone from the whole README, and 1.2 and 1.6 remove the other two mentions.
