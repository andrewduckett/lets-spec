## MODIFIED Requirements

### Requirement: The instructions command fails as run does
`instructions` SHALL look up resolvers as `run` does, and SHALL fail the same way: exit 2 when the config lists a name that is not `t3`, `cli` or `subagent`, and exit 2 when every resolver declines, naming the config file.

#### Scenario: Every resolver declines
- **WHEN** the config lists only `t3`, the command runs outside T3 Code, and the user runs `lets delegate review instructions --for code`
- **THEN** it exits 2, stdout is empty, and stderr names the config file and says every resolver declined

#### Scenario: A listed resolver is missing
- **WHEN** the config lists `/gone/old-resolver`
- **THEN** `lets delegate review instructions --for code` exits 2, and stderr names that entry and the config file
