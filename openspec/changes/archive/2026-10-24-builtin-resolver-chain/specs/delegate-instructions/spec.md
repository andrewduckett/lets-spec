## MODIFIED Requirements

### Requirement: The instructions command
`lets delegate review instructions --for <plan|code>` and `lets delegate handoff instructions --for apply` SHALL ask the resolvers which models they can run now, and print one JSON line on stdout, then exit 0. The line SHALL hold `strategy` (`review` or `handoff`), `for` (the intent given), `resolver` and `options` from the resolver that answered, and `guidance`. They SHALL start no session.

#### Scenario: A resolver with models
- **WHEN** the config lists `t3`, which can run `gpt/gpt-6-luna` and `claude`, and the user runs `lets delegate review instructions --for code`
- **THEN** it exits 0, and stdout is one JSON line with `"strategy":"review"`, `"for":"code"`, `"resolver":"t3"` and `"options":["gpt/gpt-6-luna","claude"]`

#### Scenario: No config
- **WHEN** no config file exists, and the user runs `lets delegate handoff instructions --for apply`
- **THEN** it exits 0, and its JSON line has `"strategy":"handoff"`, `"for":"apply"`, `"resolver":"subagent"` and `"options":[]`

#### Scenario: Nothing is started
- **WHEN** the user runs `lets delegate review instructions --for plan`
- **THEN** no resolver is asked to run, start or finish a session

### Requirement: The probe names the verb it is for
`instructions` SHALL ask each resolver about the kind of session its strategy starts: a read-only session for `review instructions`, and an interactive one for `handoff instructions`. The resolver that answers SHALL be the first, in lookup order, that does not decline that kind of session.

#### Scenario: A review asks for run
- **WHEN** the config lists `cli`, a family CLI is on `PATH`, and the user runs `lets delegate review instructions --for code`
- **THEN** its JSON line has `"resolver":"cli"`

#### Scenario: A resolver that only runs headless
- **WHEN** the config lists `cli`, a family CLI is on `PATH`, then `subagent`, and the user runs `lets delegate handoff instructions --for apply`
- **THEN** its JSON line has `"resolver":"subagent"` and `"options":[]`

### Requirement: The instructions command fails as run does
`instructions` SHALL look up resolvers as `run` does, and SHALL fail the same way: exit 2 when the config lists a name that is not `t3`, `cli` or `subagent`, and exit 2 when every resolver declines, naming the config file.

#### Scenario: Every resolver declines
- **WHEN** the config lists only `t3`, the command runs outside T3 Code, and the user runs `lets delegate review instructions --for code`
- **THEN** it exits 2, stdout is empty, and stderr names the config file and says every resolver declined

#### Scenario: A listed resolver is missing
- **WHEN** the config lists `/gone/lets-delegate-t3`
- **THEN** `lets delegate review instructions --for code` exits 2, and stderr names that entry and the config file
