## MODIFIED Requirements

### Requirement: The default answers when nothing else does
When no config file exists, `lets delegate` SHALL ask the default, `subagent`, which is built into `lets`. When a config file exists, `lets delegate` SHALL ask the default only where the chain holds the entry `subagent`, in that position, and only when every resolver before it declines.

#### Scenario: No config
- **WHEN** no config file exists, and the user runs `lets delegate handoff run --for apply`
- **THEN** `lets delegate handoff run` prints a JSON line with `"resolver":"subagent"`

#### Scenario: A listed resolver answers before the default
- **WHEN** the config lists a resolver that answers a review with a final message, then `subagent`
- **THEN** `lets delegate review run --for code` prints that message and exits 0, and the default is not asked

#### Scenario: A listed resolver declines and the default is next
- **WHEN** the config lists a resolver that declines, then `subagent`
- **THEN** `lets delegate handoff run --for apply` prints a JSON line with `"resolver":"subagent"`

#### Scenario: The chain leaves the default out
- **WHEN** the config lists one resolver that declines, and no `subagent` entry
- **THEN** `lets delegate handoff run --for apply` exits 2, and the default is not asked

#### Scenario: The default runs with lets's own Node
- **WHEN** the config lists `subagent`, and no `node` is on `PATH`
- **THEN** `lets delegate handoff run --for apply` prints a JSON line with `"resolver":"subagent"`

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
- **WHEN** the release folder's `resolvers/lets-delegate-subagent` is deleted, nothing else is configured, and the user runs `lets delegate handoff run --for apply`
- **THEN** the JSON line has `"resolver":"subagent"`

## REMOVED Requirements

### Requirement: A missing or broken default fails the request
**Reason**: The default is part of `lets`, so it cannot be missing or broken on its own, and `lets` no longer runs a program for it.
**Migration**: None. A `lets` that runs at all answers as the default. A path the config lists is now an unknown name, as `delegate-config` says.
