## Story

#89 lets-config-home — lets keeps its config in ~/.config/lets/, ready for settings beyond delegation
https://github.com/sidereal-io/lets-spec/issues/89

## Decisions

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | Where does the config live? | `$XDG_CONFIG_HOME/lets/config.yaml`, or `~/.config/lets/config.yaml` when `XDG_CONFIG_HOME` is unset or empty | User (story) |
| D2 | Where does the T3 token live? | `lets/t3-token` beside the config, under the same rule; the old `lets-delegate/t3-token` is not read | User (story) |
| D3 | Was the old path really unreleased? | No: v0.5.0 reads `~/.config/lets-delegate/config.yaml`, but the user is its only user | Evidence: `git show v0.5.0:lets/src/delegate/config.ts` |
| D4 | What happens to a config only at the old path? | Nothing: `lets` ignores it, with no check and no message | User |
| D5 | Does the `config.json` check stay? | No: it goes, with its spec requirement and tests | User (story) |
| D6 | Does `docs/upgrading.md` or any doc mention the move? | No: docs describe only the new file; the user migrates their own file by asking after the change | User |
| D7 | What shape does the file take? | `version: 3` at the top; the delegate settings move under a `delegate:` key | User |
| D8 | Is a file with no `delegate:` section valid? | Yes: it means no chain, so only `subagent` answers, as with no file | User |
| D9 | What replaces `delegations`? | `delegate.review.<plan\|code>` and `delegate.handoff.apply`, so each guidance sits at the path of the command that reads it | User |
| D10 | Does the `guidance:` level stay under each intent? | Yes, leaving room for another per-intent setting | User |
| D11 | Are unknown keys still ignored? | Yes, at the top level and under `delegate:`, so a later setting such as `sync:` can sit beside `delegate:` | Evidence: `lets/src/delegate/config.ts` |
| D12 | Which files does the story touch? | The packet's paths are stale since #114–116: `contrib/` is gone; the token is in `lets/src/resolvers/t3/t3.ts`, the resolver docs are `docs/resolvers.md`, the token rule is in the `delegate-resolvers` spec, and the help text is in `lets/src/main.ts` | Evidence: `git grep lets-delegate` |
| D13 | Do the skills change? | Yes: `lets-build`, `lets-review-code` and `lets-review-plan` in `skills/` name the new guidance paths | User |
| D14 | Do the scratch folder `.workspace/lets-delegate/` and the T3 session label `lets-delegate` change? | No: they belong to delegation, not to the config | Assumption |

## Changes from the story

- Added: the file's shape changes (D7–D10), which the story left to the brainstorm.
- Added: the three skills in `skills/` that name the guidance paths (D13).
- Changed: the story's file list is replaced by the current one (D12).
- Cut: nothing. No issue split out.

Confirmed by user: yes
