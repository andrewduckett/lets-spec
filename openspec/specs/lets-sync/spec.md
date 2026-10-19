# lets-sync Specification

## Purpose
`lets sync` copies Let's Spec's skills and schemas into a project, and tells the user what it changed and what they must do next, in the committed or the ignored skills mode.

## Requirements

### Requirement: Ignored mode reports written copies without asking to commit them
In the ignored skills mode, when `lets sync` writes any copied file, it SHALL print `lets-spec: wrote <n> files. Git ignores them.` on stdout, where `<n>` is the number of files written, and SHALL NOT print `Commit them.`. In the committed mode it SHALL keep printing `lets-spec: wrote <n> files. Commit them.`.

#### Scenario: First ignored-mode sync in a fresh project
- **WHEN** `LETS_SPEC_SKILLS=ignored lets sync` runs in a git project that has never synced
- **THEN** stdout holds `lets-spec: wrote <n> files. Git ignores them.`, with `<n>` the number of files the release ships
- **AND** the output does not hold `Commit them.`

#### Scenario: Committed-mode sync is unchanged
- **WHEN** `lets sync` runs in the committed mode in a git project that has never synced
- **THEN** stdout holds `lets-spec: wrote <n> files. Commit them.`

### Requirement: Adding the ignored-mode block asks to commit only .gitignore
In the ignored skills mode, when `lets sync` adds its skills block to `.gitignore`, it SHALL print `lets-spec: added the lets-spec skills block to .gitignore. Commit it.` on stdout. That line SHALL NOT hold a `git rm` command.

#### Scenario: Block added in a project that never tracked the copies
- **WHEN** `LETS_SPEC_SKILLS=ignored lets sync` runs in a git project whose `.gitignore` has no lets-spec skills block, and git tracks no managed path
- **THEN** stdout holds `lets-spec: added the lets-spec skills block to .gitignore. Commit it.`
- **AND** the output does not hold `git rm`

### Requirement: Ignored mode reports tracked copies as a problem to fix
In the ignored skills mode, on every run, while git tracks any path under `.agents/skills/lets-*`, `.agents/skills/openspec-*` or `openspec/schemas/lets-*`, `lets sync` SHALL list this problem on stderr, under its `lets-spec: <n> problem(s) to fix:` heading:

`git still tracks lets-spec copies that .gitignore ignores. Run: git rm -r --cached --ignore-unmatch -- '.agents/skills/lets-*' '.agents/skills/openspec-*' 'openspec/schemas/lets-*', then commit.`

It SHALL still exit 0. When git tracks none of those paths, it SHALL NOT list this problem. `lets sync --check` SHALL NOT change because of this requirement.

#### Scenario: Switching a committed project to ignored mode
- **WHEN** a project has committed its copies in the committed mode, and `LETS_SPEC_SKILLS=ignored lets sync` runs
- **THEN** stderr lists the tracked-copies problem with the command above
- **AND** the exit status is 0

#### Scenario: The problem repeats until the copies are untracked
- **WHEN** a project still tracks its copies after one ignored-mode sync, and `LETS_SPEC_SKILLS=ignored lets sync` runs again
- **THEN** stderr lists the tracked-copies problem again

#### Scenario: Nothing is tracked
- **WHEN** `LETS_SPEC_SKILLS=ignored lets sync` runs in a project where git tracks no managed path
- **THEN** the output holds no tracked-copies problem and no `git rm`

#### Scenario: Check is unchanged while copies are tracked
- **WHEN** a project's `.gitignore` holds the current skills block, git still tracks its copies, and `LETS_SPEC_SKILLS=ignored lets sync --check` runs
- **THEN** the exit status is 0

### Requirement: The untrack command works when a pattern matches nothing
The `git rm` command in the tracked-copies problem SHALL untrack every tracked managed path and exit 0, even when one of its patterns matches no tracked path, when pasted into bash or zsh.

#### Scenario: Only some patterns match
- **WHEN** git tracks `.agents/skills/lets-*` copies but no `.agents/skills/openspec-*` path, and the user runs the command from the tracked-copies problem
- **THEN** the command exits 0
- **AND** git tracks no path under `.agents/skills/lets-*`, `.agents/skills/openspec-*` or `openspec/schemas/lets-*`
- **AND** the copies are still on disk
