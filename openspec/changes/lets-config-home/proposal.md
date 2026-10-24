## Why

The only file `lets` reads its settings from is `~/.config/lets-delegate/config.yaml`. It is named for one command group, and its keys assume delegation is all there is. The next `lets` setting would need a second file or a misleading home. Moving the file costs nothing now: its one user will move it by hand (D3, D4, D6).

## What Changes

- **BREAKING** `lets` reads its config from `$XDG_CONFIG_HOME/lets/config.yaml`, or `~/.config/lets/config.yaml` (D1). It no longer reads the `lets-delegate` folder, and says nothing about a file left there (D4).
- **BREAKING** The file is `version: 3`. The delegate settings move under a `delegate:` key: the chain is `delegate.resolvers` (D7). A version 2 file exits 2, naming the version.
- **BREAKING** `delegations.<intent>.guidance` becomes `delegate.review.plan`, `delegate.review.code` and `delegate.handoff.apply`, each holding `guidance`. Each guidance now sits at the path of the command that reads it (D9, D10).
- A file with no `delegate:` section, or with no `delegate.resolvers`, is valid. The chain is then the default, `subagent`, as with no file (D8). Unknown keys stay ignored, at the top level and under `delegate:`, so a later setting can sit beside `delegate:` (D11).
- **BREAKING** The T3 token moves to `lets/t3-token`, beside the config. The old token is not read; `t3` issues a fresh one (D2).
- The check that refuses a leftover `config.json` is removed (D5).
- `lets delegate --help`, the README, `docs/resolvers.md` and the three skills that name the guidance paths describe the new file only (D6, D13). `docs/upgrading.md` is unchanged (D6).
- Unchanged: the scratch folder `.workspace/lets-delegate/` and the T3 session label `lets-delegate` (D14).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `delegate-config`: the file's path, version and shape change. The chain moves to `delegate.resolvers`, and the leftover `config.json` requirement is removed.
- `delegate-default`: the default also answers when the config lists no chain, not only when there is no file.
- `delegate-instructions`: guidance is read from `delegate.<strategy>.<intent>.guidance`, and the malformed-guidance errors name those keys.
- `delegate-resolvers`: the T3 token's path moves to `lets/t3-token`.

## Impact

- Code: `lets/src/delegate/config.ts` (path, parser, guidance lookup), `lets/src/delegate/lookup.ts` (the chain), `lets/src/delegate/instructions.ts`, `lets/src/main.ts` (help text), and `lets/src/resolvers/t3/t3.ts` (`TOKEN_FILE`) (D12).
- Tests: every file under `tests/lets/delegate/`, and `tests/lets/resolvers/t3/` and `tests/lets/resolvers/cli/`, including their fixtures. They write the config text, the config path or the token path.
- Docs: `README.md` (*Set up delegation*) and `docs/resolvers.md` (the token path).
- Skills: `skills/lets-build`, `skills/lets-review-code` and `skills/lets-review-plan` (D13). This repository's own copies change at the next release.
- Users: the one user moves and reshapes their own file after the change (D6). No dependency changes.
