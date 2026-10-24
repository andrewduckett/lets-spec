## MODIFIED Requirements

### Requirement: The config file
The config SHALL be one YAML document at `$XDG_CONFIG_HOME/lets/config.yaml` when `XDG_CONFIG_HOME` is set and not empty, and at `~/.config/lets/config.yaml` otherwise. It SHALL be a mapping that holds `version` `3`. It MAY hold `delegate`, a mapping of the settings for `lets delegate`. `delegate` MAY hold `resolvers`, the chain: a list of the resolvers to ask, in order. Each entry SHALL be the name of a resolver built into `lets`: `t3`, `cli` or `subagent`. The list MAY be empty. `delegate` MAY hold `review` and `handoff`, which only `instructions` reads. A `delegate` or `delegate.resolvers` that is null SHALL count as absent. Every `lets delegate review` and `lets delegate handoff` command SHALL ignore any other key, at the top level or under `delegate`. They SHALL exit 2 with a message that names the file and the bad value in each of these cases:

- the document is not YAML, or is not a mapping
- `version` is not the number `3`
- `delegate` is present and is not a mapping
- `delegate.resolvers` is present and is not a list

#### Scenario: A valid config
- **WHEN** the file holds `version: 3` and `delegate.resolvers` listing `t3` and `subagent`, and `t3` declines
- **THEN** `lets delegate review run --for code` reads it without error, and asks `t3`, then the default, in that order

#### Scenario: The file under XDG_CONFIG_HOME
- **WHEN** `XDG_CONFIG_HOME` is `/cfg`, and `/cfg/lets/config.yaml` holds `version: 3` and `delegate.resolvers: [cli]`
- **THEN** `lets delegate review run --for code` asks `cli`

#### Scenario: The file under the home folder
- **WHEN** `XDG_CONFIG_HOME` is the empty string, and `~/.config/lets/config.yaml` holds `version: 3` and `delegate.resolvers: [cli]`
- **THEN** `lets delegate review run --for code` asks `cli`

#### Scenario: An invalid config
- **WHEN** the file's `delegate.resolvers` holds `bin/old-resolver`
- **THEN** `lets delegate review run --for code` exits 2, and stderr names the file and `bin/old-resolver`

#### Scenario: The old version
- **WHEN** the file holds `version: 2`
- **THEN** `lets delegate review run --for code` exits 2, and stderr names the file and says the version must be `3`

#### Scenario: A delegate key that is not a mapping
- **WHEN** the file holds `version: 3` and `delegate: [t3]`
- **THEN** `lets delegate review run --for code` exits 2, and stderr names the file and `delegate`

#### Scenario: An empty delegate key
- **WHEN** the file holds `version: 3` and a line `delegate:` with nothing under it
- **THEN** `lets delegate handoff run --for apply` reads it without error, and the JSON line has `"resolver":"subagent"`

#### Scenario: Resolvers that are not a list
- **WHEN** the file holds `version: 3` and `delegate.resolvers: t3`
- **THEN** `lets delegate review run --for code` exits 2, and stderr names the file and `delegate.resolvers`

#### Scenario: A key from a later lets
- **WHEN** the file holds `version: 3`, a valid `delegate.resolvers`, a top-level key `sync`, and a key `telemetry` under `delegate`, which this `lets` does not know
- **THEN** `lets delegate review run --for code` reads it without error and asks the listed resolvers

#### Scenario: run ignores the guidance
- **WHEN** the file holds `delegate.review.code.guidance: 42`
- **THEN** `lets delegate review run --for code` reads it without error and asks the listed resolvers

### Requirement: A chain where every resolver declines fails the command
When every resolver the config lists declines, `lets delegate` SHALL exit 2, print nothing on stdout, and say on stderr that every resolver declined, naming the config file. The help text of `lets delegate review run` and `lets delegate handoff run` SHALL name this case under exit 2.

#### Scenario: Only a T3 resolver, run from a terminal
- **WHEN** the config lists only `t3`, and the command runs outside T3 Code
- **THEN** `lets delegate review run --for code` exits 2, stdout is empty, and stderr names the config file and says every resolver declined

#### Scenario: An empty list
- **WHEN** the config's `delegate.resolvers` is `[]`
- **THEN** `lets delegate handoff run --for apply` exits 2, stdout is empty, and stderr names the config file and says every resolver declined

#### Scenario: The help text
- **WHEN** the user runs `lets delegate review run --help`
- **THEN** the line for exit 2 says that every resolver in the config declined

### Requirement: An unknown resolver name stops the command
An entry of the config's `delegate.resolvers` that is not `t3`, `cli` or `subagent` SHALL stop every `lets delegate review` and `lets delegate handoff` command before it asks any resolver. The command SHALL exit 2 and print nothing on stdout. Stderr SHALL name the config file, the entry, and the three names. An absolute path is such an entry: `lets` SHALL NOT rewrite it to a name.

#### Scenario: A path from an older lets
- **WHEN** the config lists `/opt/r/old-resolver`
- **THEN** `lets delegate review run --for code` exits 2, and stderr contains the config file's path, `/opt/r/old-resolver`, `t3`, `cli` and `subagent`

#### Scenario: A name lets does not know
- **WHEN** the config lists `codex`
- **THEN** `lets delegate handoff run --for apply` exits 2, stdout is empty, and stderr contains `codex` and the config file's path

#### Scenario: A bad entry after one that would answer
- **WHEN** the config lists `subagent`, then `/opt/r/old-resolver`
- **THEN** `lets delegate handoff run --for apply` exits 2, and no prompt is saved under `.workspace/lets-delegate/`

### Requirement: The chain is the names the config lists
`lets delegate` SHALL ask the resolvers the config's `delegate.resolvers` names, in the order listed, and no others. A resolver declines when it cannot run here, and one that cannot start interactive sessions declines every handoff. The first that does not decline SHALL answer, and no later one is asked.

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

### Requirement: A leftover JSON config is refused
**Reason**: The config moved to `~/.config/lets/`, and its one user moves their file by hand. `lets` no longer looks in the `lets-delegate` folder at all, so it has no `config.json` to find.
**Migration**: None. Write `~/.config/lets/config.yaml`, and delete the `lets-delegate` folder.
