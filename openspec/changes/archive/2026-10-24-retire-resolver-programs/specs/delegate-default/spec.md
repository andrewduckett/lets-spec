## MODIFIED Requirements

### Requirement: Every lets carries the default
The `lets` of the release tarball, of the Nix `lets` package and of the repository's source tree SHALL each answer as the default with nothing else installed or configured. The default SHALL be part of `lets` itself, and SHALL need no file beside it.

#### Scenario: The release tarball
- **WHEN** a user unpacks the release tarball, and runs its `bin/lets delegate handoff run --for apply` with nothing else installed or configured
- **THEN** the JSON line has `"resolver":"subagent"`

#### Scenario: The Nix package
- **WHEN** a user runs the Nix package's `lets delegate handoff run --for apply` with nothing else installed or configured
- **THEN** the JSON line has `"resolver":"subagent"`

#### Scenario: The source tree
- **WHEN** a developer runs `lets/bin/lets delegate handoff run --for apply` in this repository with nothing else installed or configured
- **THEN** the JSON line has `"resolver":"subagent"`

#### Scenario: The program beside lets is gone
- **WHEN** the release folder has no `resolvers/` folder, nothing else is configured, and the user runs `lets delegate handoff run --for apply`
- **THEN** the JSON line has `"resolver":"subagent"`

## ADDED Requirements

### Requirement: The default answers wherever lets runs
The default, `subagent`, SHALL answer wherever `lets` runs, inside a harness or not, and SHALL never decline. Asked which models it can run, it SHALL list none.

#### Scenario: Instructions in a plain terminal
- **WHEN** no config file exists, the command runs outside any harness, and the user runs `lets delegate review instructions --for code`
- **THEN** it exits 0 and prints one JSON line with `"resolver":"subagent"` and `"options":[]`

## REMOVED Requirements

### Requirement: The default never declines
**Reason**: It described the program `lets-delegate-subagent` answering the `probe` verb. The program and the protocol are gone. *The default answers wherever lets runs* states the same rule through `lets delegate`.
**Migration**: None. No command changes.

### Requirement: The default finishes nothing
**Reason**: It described the program `lets-delegate-subagent` answering the `finish` verb. The program and the protocol are gone, and `subagent` makes no handle, so nothing reaches its `finish`.
**Migration**: None. No command changes.
