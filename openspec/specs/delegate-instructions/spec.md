# delegate-instructions Specification

## Purpose
Says how a skill asks `lets delegate` what can run for a delegation before it runs one: the strategy, the resolver that will answer, the models that resolver can run now, and the user's guidance for that intent.

## Requirements

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

### Requirement: The guidance comes from the config
`guidance` SHALL be the string at `delegations.<intent>.guidance` in the delegate config, for the intent `--for` gives, unchanged. It SHALL be `null` when there is no config, no `delegations` key, no entry for the intent, or no `guidance` in that entry.

#### Scenario: Guidance for the intent
- **WHEN** the config holds `delegations.code.guidance` `Use the strongest gpt model.`, and the user runs `lets delegate review instructions --for code`
- **THEN** its JSON line has `"guidance":"Use the strongest gpt model."`

#### Scenario: Guidance for another intent only
- **WHEN** the config holds `delegations.code.guidance` and nothing for `plan`, and the user runs `lets delegate review instructions --for plan`
- **THEN** its JSON line has `"guidance":null`

#### Scenario: A multi-line block
- **WHEN** `delegations.apply.guidance` is a YAML `|` block of two lines
- **THEN** `lets delegate handoff instructions --for apply` prints both lines in `guidance`, joined by a newline

### Requirement: Malformed guidance stops the command
When `delegations`, or its entry for the intent `--for` gives, is present and is not a mapping, or that entry's `guidance` is present and is not a string, `instructions` SHALL exit 2, print nothing on stdout, and name the config file and the bad key on stderr. It SHALL NOT check the entries for other intents.

#### Scenario: A number for guidance
- **WHEN** the config holds `delegations.code.guidance: 42`, and the user runs `lets delegate review instructions --for code`
- **THEN** it exits 2, stdout is empty, and stderr names the config file and `delegations.code.guidance`

#### Scenario: A bad entry for another intent
- **WHEN** the config holds `delegations.plan.guidance: [a, b]`, and the user runs `lets delegate review instructions --for code`
- **THEN** it exits 0

### Requirement: The instructions command fails as run does
`instructions` SHALL look up resolvers as `run` does, and SHALL fail the same way: exit 2 when the config lists a name that is not `t3`, `cli` or `subagent`, and exit 2 when every resolver declines, naming the config file.

#### Scenario: Every resolver declines
- **WHEN** the config lists only `t3`, the command runs outside T3 Code, and the user runs `lets delegate review instructions --for code`
- **THEN** it exits 2, stdout is empty, and stderr names the config file and says every resolver declined

#### Scenario: A listed resolver is missing
- **WHEN** the config lists `/gone/lets-delegate-t3`
- **THEN** `lets delegate review instructions --for code` exits 2, and stderr names that entry and the config file
