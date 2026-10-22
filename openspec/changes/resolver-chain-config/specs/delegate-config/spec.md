## MODIFIED Requirements

### Requirement: The config file
The config SHALL be one YAML document in `$XDG_CONFIG_HOME/lets-delegate/config.yaml`, or in `~/.config/lets-delegate/config.yaml` when `XDG_CONFIG_HOME` is unset. It SHALL hold `version` `2` and `resolvers`, the chain: a list of the resolvers to ask, in order. Each entry SHALL be an absolute path, or the word `subagent`, which names the default that ships beside the running `lets`. The list MAY be empty. `lets delegate` SHALL ignore any other key. When `version` is not `2`, when `resolvers` is not such a list, or when the document is not YAML, `lets delegate` SHALL exit 2 with a message that names the file and the bad value.

#### Scenario: A valid config
- **WHEN** the file holds `version: 2` and `resolvers:` listing `/opt/r/lets-delegate-t3` and `subagent`
- **THEN** `lets delegate review` reads it without error, and asks that path, then the default, in that order

#### Scenario: An invalid config
- **WHEN** the file's `resolvers` holds `bin/lets-delegate-t3`
- **THEN** `lets delegate review` exits 2, and stderr names the file and `bin/lets-delegate-t3`

#### Scenario: The old version
- **WHEN** the file holds `version: 1`
- **THEN** `lets delegate review` exits 2, and stderr names the file and says the version must be `2`

#### Scenario: A key from a later lets
- **WHEN** the file holds `version: 2`, a valid `resolvers`, and a key `delegations` that this `lets` does not know
- **THEN** `lets delegate review` reads it without error and asks the listed resolvers

### Requirement: A missing configured resolver stops the command
When the lookup reaches an absolute path the config lists, and that path does not exist or cannot be run, `lets delegate` SHALL exit 2 and name the path and the config file. It SHALL ask no later resolver. A resolver earlier in the order that answers is not affected.

#### Scenario: The resolver was removed
- **WHEN** `LETS_SPEC_RESOLVER` is unset, and the config lists `/nix/store/gone/bin/lets-delegate-t3`, which does not exist
- **THEN** `lets delegate review` exits 2, and stderr contains that path and the config file's path

#### Scenario: The environment's resolver answers first
- **WHEN** `LETS_SPEC_RESOLVER` names a resolver that answers the review, and the config lists a path that does not exist
- **THEN** `lets delegate review` exits 0 with that resolver's answer, and stderr does not name the missing path

#### Scenario: An earlier listed resolver answers first
- **WHEN** the config lists a resolver that answers the review, then a path that does not exist
- **THEN** `lets delegate review` exits 0 with the first resolver's answer, and stderr does not name the missing path

### Requirement: No usable reviewer exits 3
When a `run` request has `reviewers` and the harness can run none of them, the contrib resolver SHALL exit 3, start no session, and name on stderr each reviewer it skipped and why.

#### Scenario: The harness lacks the family
- **WHEN** the resolver runs in herdr, `reviewers` holds only `gpt`/`gpt-6-luna`, and `codex` is not on `PATH`
- **THEN** it exits 3, and stderr names `gpt` and says `codex` is not on `PATH`

#### Scenario: An empty list
- **WHEN** a `run` request reaches the resolver with `reviewers` `[]`
- **THEN** it exits 3, starts no session, and stderr says the request has no reviewers

## ADDED Requirements

### Requirement: The chain is asked in order
`lets delegate` SHALL ask resolvers in this order: the one `LETS_SPEC_RESOLVER` names when it is set, then each entry of the config's `resolvers`, in the order listed. The first that does not decline SHALL answer, and no later one is asked. Nothing found on `PATH` SHALL be asked unless the config lists it by path.

#### Scenario: The first declines
- **WHEN** the config lists `/a` then `/b`, and `/a` declines the review
- **THEN** `/b` is asked, and `lets delegate review` exits 0 with `/b`'s answer

#### Scenario: The first answers
- **WHEN** the config lists `/a` then `/b`, and `/a` answers the review
- **THEN** `lets delegate review` prints `/a`'s answer, and `/b` is not run

#### Scenario: The environment wins
- **WHEN** `LETS_SPEC_RESOLVER` names `/x`, which answers, and the config lists `/a`
- **THEN** `/x` answers, and `/a` is not run

#### Scenario: A resolver on PATH is not asked
- **WHEN** an executable named `lets-delegate-resolver` is on `PATH`, and the config does not list its path
- **THEN** it is not run

### Requirement: A chain where every resolver declines fails the command
When `LETS_SPEC_RESOLVER` is unset or declines, and every resolver the config lists declines, `lets delegate` SHALL exit 2, print nothing on stdout, and say on stderr that every resolver declined, naming the config file. The help text of `lets delegate review` and `lets delegate handoff` SHALL name this case under exit 2.

#### Scenario: Only a T3 resolver, run from a terminal
- **WHEN** the config lists only `/opt/r/lets-delegate-t3`, and the command runs where that resolver declines
- **THEN** `lets delegate review` exits 2, stdout is empty, and stderr names the config file and says every resolver declined

#### Scenario: An empty list
- **WHEN** the config's `resolvers` is `[]`
- **THEN** `lets delegate handoff` exits 2, stdout is empty, and stderr names the config file and says every resolver declined

#### Scenario: The help text
- **WHEN** the user runs `lets delegate review --help`
- **THEN** the line for exit 2 says that every resolver in the config declined

### Requirement: A leftover JSON config is refused
When `config.yaml` does not exist and `config.json` exists in the same folder, `lets delegate` SHALL exit 2 and say on stderr that the config is now `config.yaml`, naming both files.

#### Scenario: Yesterday's file
- **WHEN** `~/.config/lets-delegate/config.json` exists, `config.yaml` does not, and the user runs `lets delegate review`
- **THEN** the command exits 2, and stderr names `config.json` and `config.yaml`

#### Scenario: Both files
- **WHEN** both `config.json` and `config.yaml` exist
- **THEN** `lets delegate review` reads `config.yaml` and ignores `config.json`

### Requirement: A request from lets carries no reviewers
A `run` request that `lets delegate review` sends SHALL have no `reviewers` field, whatever the config holds, so the resolver chooses as "No list keeps the resolver's own choice" says.

#### Scenario: A review with a config
- **WHEN** a config file exists and the user runs `lets delegate review`
- **THEN** the `run` request the resolver receives has no `reviewers` field

## REMOVED Requirements

### Requirement: The config's resolver comes before PATH
**Reason**: The config lists resolvers in order, and nothing on `PATH` is asked. The order is "The chain is asked in order".
**Migration**: List each resolver's absolute path under `resolvers` in `config.yaml`, in the order to ask them, and `subagent` for the default.

### Requirement: A review sends the reviewers for its effort
**Reason**: The config stores nothing about models. A `run` request from `lets` carries no `reviewers`, so a resolver chooses as "No list keeps the resolver's own choice" says, until #58 makes it report what it can run and #59 lets the skill choose.
**Migration**: Remove `reviewers` from the config. A resolver that honours `reviewers` keeps working for callers that send it, such as the conformance check.

### Requirement: A handoff ignores the reviewers
**Reason**: There are no reviewers in the config to ignore.
**Migration**: None.
