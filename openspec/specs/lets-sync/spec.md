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

### Requirement: A release that ships a path lets sync does not own changes nothing
When the release ships a skill or schema folder whose project path `lets sync` does not own, `lets sync` SHALL exit 1 before it writes any file, and SHALL print `error: <release> ships <path>, which lets sync does not own.` on stderr. It owns only `.agents/skills/lets-*`, `.agents/skills/openspec-*` and `openspec/schemas/lets-*`.

#### Scenario: The release ships a skill with a name lets sync does not own
- **WHEN** `lets sync` runs in a git project that has never synced, with a release that ships the skill folder `.agents/skills/other`
- **THEN** it exits 1
- **AND** stderr holds `ships .agents/skills/other, which lets sync does not own.`
- **AND** the project's files are the same as before the run, including `AGENTS.md`

#### Scenario: Check refuses the same release
- **WHEN** `lets sync --check` runs with a release that ships the skill folder `.agents/skills/other`
- **THEN** it exits 1, and stderr holds `ships .agents/skills/other, which lets sync does not own.`

### Requirement: lets --version prints the release version on every install
`lets --version` SHALL print the version recorded in the repository's one version source, `lets/package.json`, both when `lets` comes from the Nix flake and when it comes from the release tarball. When `lets` runs from the source tree, which has no `release.json`, it SHALL print `0.0.0-dev`.

#### Scenario: Nix install
- **WHEN** `lets --version` runs from the flake's `lets` package, built from a commit whose `lets/package.json` holds version `0.5.0`
- **THEN** stdout is `0.5.0`

#### Scenario: Tarball install
- **WHEN** `node bin/lets --version` runs from the release folder built from the same commit
- **THEN** stdout is `0.5.0`

#### Scenario: Source tree
- **WHEN** `lets --version` runs from the source tree's `lets/bin/lets`
- **THEN** stdout is `0.0.0-dev`

### Requirement: The OpenSpec CLI version warning works on every install
`lets sync` SHALL compare the OpenSpec CLI on PATH with the version recorded in the `release.json` of the `lets` package that runs, whether that package comes from the Nix flake or the release tarball. When the two differ, it SHALL warn: `the OpenSpec CLI on PATH is <found>, but this release's openspec-* skills were generated from <pinned>. Pin the CLI to <pinned>.` When they match, or when either version is unknown, it SHALL NOT warn.

#### Scenario: Nix install with a different CLI on PATH
- **WHEN** `lets sync` runs from the flake's `lets` package, whose `release.json` records OpenSpec `1.2.3`, and `openspec --version` on PATH prints `1.4.0`
- **THEN** stderr holds `the OpenSpec CLI on PATH is 1.4.0, but this release's openspec-* skills were generated from 1.2.3. Pin the CLI to 1.2.3.`

#### Scenario: The same CLI
- **WHEN** `lets sync` runs and `openspec --version` prints the version the package's `release.json` records
- **THEN** the output holds no OpenSpec CLI version warning

#### Scenario: No release.json
- **WHEN** `lets sync` runs from the source tree, which has no `release.json`
- **THEN** the output holds no OpenSpec CLI version warning

### Requirement: A release tag must match the version source
The release workflow SHALL publish a tarball for the tag `v<version>` only when `<version>` equals the version in `lets/package.json` at the tagged commit. Otherwise it SHALL fail before it publishes, with a message that names both versions.

#### Scenario: Matching tag
- **WHEN** the tag `v0.6.0` is pushed on a commit whose `lets/package.json` holds `0.6.0`
- **THEN** the workflow publishes `lets-spec-0.6.0.tar.gz`, whose `release.json` holds version `0.6.0`

#### Scenario: Tag without a version bump
- **WHEN** the tag `v0.6.0` is pushed on a commit whose `lets/package.json` holds `0.5.0`
- **THEN** the workflow fails without publishing, and its log names `v0.6.0` and `0.5.0`
