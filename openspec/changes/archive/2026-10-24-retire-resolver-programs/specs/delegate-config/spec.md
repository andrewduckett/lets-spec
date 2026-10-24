## MODIFIED Requirements

### Requirement: The config file
The config SHALL be one YAML document in `$XDG_CONFIG_HOME/lets-delegate/config.yaml`, or in `~/.config/lets-delegate/config.yaml` when `XDG_CONFIG_HOME` is unset. It SHALL hold `version` `2` and `resolvers`, the chain: a list of the resolvers to ask, in order. Each entry SHALL be the name of a resolver built into `lets`: `t3`, `cli` or `subagent`. The list MAY be empty. The config MAY hold `delegations`, which only `instructions` reads. Every `lets delegate review` and `lets delegate handoff` command SHALL ignore any other key. When `version` is not the number `2`, when `resolvers` is not a list, or when the document is not YAML, they SHALL exit 2 with a message that names the file and the bad value.

#### Scenario: A valid config
- **WHEN** the file holds `version: 2` and `resolvers:` listing `t3` and `subagent`, and `t3` declines
- **THEN** `lets delegate review run --for code` reads it without error, and asks `t3`, then the default, in that order

#### Scenario: An invalid config
- **WHEN** the file's `resolvers` holds `bin/old-resolver`
- **THEN** `lets delegate review run --for code` exits 2, and stderr names the file and `bin/old-resolver`

#### Scenario: The old version
- **WHEN** the file holds `version: 1`
- **THEN** `lets delegate review run --for code` exits 2, and stderr names the file and says the version must be `2`

#### Scenario: Resolvers that are not a list
- **WHEN** the file holds `version: 2` and `resolvers: t3`
- **THEN** `lets delegate review run --for code` exits 2, and stderr names the file and `resolvers`

#### Scenario: A key from a later lets
- **WHEN** the file holds `version: 2`, a valid `resolvers`, and a key `telemetry` that this `lets` does not know
- **THEN** `lets delegate review run --for code` reads it without error and asks the listed resolvers

#### Scenario: run ignores the guidance
- **WHEN** the file holds `delegations.code.guidance: 42`
- **THEN** `lets delegate review run --for code` reads it without error and asks the listed resolvers

### Requirement: An unknown resolver name stops the command
An entry of the config's `resolvers` that is not `t3`, `cli` or `subagent` SHALL stop every `lets delegate review` and `lets delegate handoff` command before it asks any resolver. The command SHALL exit 2 and print nothing on stdout. Stderr SHALL name the config file, the entry, and the three names. An absolute path is such an entry: `lets` SHALL NOT rewrite it to a name.

#### Scenario: A path from an older lets
- **WHEN** the config lists `/opt/r/old-resolver`
- **THEN** `lets delegate review run --for code` exits 2, and stderr contains the config file's path, `/opt/r/old-resolver`, `t3`, `cli` and `subagent`

#### Scenario: A name lets does not know
- **WHEN** the config lists `codex`
- **THEN** `lets delegate handoff run --for apply` exits 2, stdout is empty, and stderr contains `codex` and the config file's path

#### Scenario: A bad entry after one that would answer
- **WHEN** the config lists `subagent`, then `/opt/r/old-resolver`
- **THEN** `lets delegate handoff run --for apply` exits 2, and no prompt is saved under `.workspace/lets-delegate/`

## ADDED Requirements

### Requirement: The chain is the names the config lists
`lets delegate` SHALL ask the resolvers the config's `resolvers` names, in the order listed, and no others. A resolver declines when it cannot run here, and one that cannot start interactive sessions declines every handoff. The first that does not decline SHALL answer, and no later one is asked.

#### Scenario: The first declines
- **WHEN** the config lists `t3` then `cli`, and `t3` declines the review
- **THEN** `cli` is asked, and `lets delegate review run --for code` exits 0 with `cli`'s answer

#### Scenario: The first answers
- **WHEN** the config lists `t3` then `cli`, and `t3` answers the review
- **THEN** `lets delegate review run --for code` prints `t3`'s answer, and `cli` is not asked

#### Scenario: A headless resolver and a handoff
- **WHEN** the config lists `cli` then `subagent`, `cli` can run here, and the user runs `lets delegate handoff run --for apply`
- **THEN** `cli` starts nothing, and the JSON line has `"resolver":"subagent"`

## REMOVED Requirements

### Requirement: The chain is asked in order, by name
**Reason**: Replaced by *The chain is the names the config lists*, which keeps its rule and its first three scenarios. Its last two scenarios checked that `lets` ignores `LETS_SPEC_RESOLVER` and a resolver program on `PATH`. Both only guarded the move away from the programs, which are now gone, and neither leaves a concrete input a test can set.
**Migration**: None. No command changes.
