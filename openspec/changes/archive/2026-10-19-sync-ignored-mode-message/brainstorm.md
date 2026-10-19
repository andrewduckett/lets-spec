**Why:** In ignored mode, `lets sync` tells a new project to commit files that git ignores, and to run a `git rm` command that fails when nothing is tracked. This repository's own CI tripped on it, so a first run on any project goes wrong.

## Story

#31 sync-ignored-mode-message — lets sync in ignored mode says what it wrote and nothing about committing.
https://github.com/andrewduckett/lets-spec/issues/31

## Decisions

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | Where do the wrong messages come from? | "Commit them." comes from `syncSkills` in both modes; the `git rm` line comes from `main.ts` whenever it adds the `.gitignore` block. | Evidence: `lets/src/sync/skills.ts:99`, `lets/src/sync/main.ts:101` |
| D2 | When does ignored mode print the untrack instruction? | On every ignored-mode run while git tracks any managed path, not only the run that adds the block. A run with nothing tracked says nothing about it. | User |
| D3 | How does `lets sync` know whether a managed path is tracked? | It asks git with `git ls-files` for the three managed patterns. If that git call fails, it treats nothing as tracked. | User |
| D4 | What form does the untrack command take? | `git rm -r --cached --ignore-unmatch -- '.agents/skills/lets-*' '.agents/skills/openspec-*' 'openspec/schemas/lets-*'`: quoted so any shell passes the patterns to git, and with `--ignore-unmatch` so a pattern that matches nothing does not fail. | User |
| D5 | Where does the untrack instruction appear? | In the "problem(s) to fix" list on stderr. The exit code stays 0, and `--check` is unchanged. | User |
| D6 | What does ignored mode say after writing copies? | `lets-spec: wrote <n> files. Git ignores them.` Committed mode keeps `Commit them.` | User |
| D7 | What does ignored mode say when it adds the `.gitignore` block? | `lets-spec: added the lets-spec skills block to .gitignore. Commit it.`, the same as the stale-block line. | User |
| D8 | What does the problem line say? | `git still tracks lets-spec copies that .gitignore ignores. Run: <the D4 command>, then commit.` | User |
| D9 | Do the docs change? | Yes. The README's mode-switch table and the paragraph under it describe the new lines. | Evidence: `README.md` "Committed or ignored skills" |

## Changes from the story

- Added: the untrack instruction repeats on every run while copies are tracked (D2). The story printed it only when the block is added, so a skipped step stayed invisible.
- Added: the command uses quoted patterns and `--ignore-unmatch` (D4). The story kept the old command, which still fails when only some patterns match.
- Kept out: `lets sync --check` does not fail on tracked copies (D5). The story's scope is the messages.

Confirmed by user: yes
