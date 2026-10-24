## MODIFIED Requirements

### Requirement: The guidance comes from the config
`guidance` SHALL be the string at `delegate.<strategy>.<intent>.guidance` in the config, for the strategy of the command and the intent `--for` gives, unchanged: `delegate.review.plan.guidance`, `delegate.review.code.guidance` or `delegate.handoff.apply.guidance`. It SHALL be `null` when there is no config, no `delegate` key, no entry for the strategy, no entry for the intent, or no `guidance` in that entry.

#### Scenario: Guidance for the intent
- **WHEN** the config holds `delegate.review.code.guidance` `Use the strongest gpt model.`, and the user runs `lets delegate review instructions --for code`
- **THEN** its JSON line has `"guidance":"Use the strongest gpt model."`

#### Scenario: Guidance for another intent only
- **WHEN** the config holds `delegate.review.code.guidance` and nothing for `plan`, and the user runs `lets delegate review instructions --for plan`
- **THEN** its JSON line has `"guidance":null`

#### Scenario: Guidance for the other strategy only
- **WHEN** the config holds `delegate.handoff.apply.guidance` and no `delegate.review`, and the user runs `lets delegate review instructions --for code`
- **THEN** its JSON line has `"guidance":null`

#### Scenario: A multi-line block
- **WHEN** `delegate.handoff.apply.guidance` is a YAML `|` block of two lines
- **THEN** `lets delegate handoff instructions --for apply` prints both lines in `guidance`, joined by a newline

### Requirement: Malformed guidance stops the command
When the entry for the command's strategy under `delegate`, or its entry for the intent `--for` gives, is present and is not a mapping, or that entry's `guidance` is present and is not a string, `instructions` SHALL exit 2, print nothing on stdout, and name the config file and the bad key on stderr. It SHALL NOT check the entries for other strategies or other intents.

#### Scenario: A number for guidance
- **WHEN** the config holds `delegate.review.code.guidance: 42`, and the user runs `lets delegate review instructions --for code`
- **THEN** it exits 2, stdout is empty, and stderr names the config file and `delegate.review.code.guidance`

#### Scenario: A strategy entry that is not a mapping
- **WHEN** the config holds `delegate.handoff: apply`, and the user runs `lets delegate handoff instructions --for apply`
- **THEN** it exits 2, stdout is empty, and stderr names the config file and `delegate.handoff`

#### Scenario: A bad entry for another intent
- **WHEN** the config holds `delegate.review.plan.guidance: [a, b]`, and the user runs `lets delegate review instructions --for code`
- **THEN** it exits 0

#### Scenario: A bad entry for the other strategy
- **WHEN** the config holds `delegate.handoff: 42`, and the user runs `lets delegate review instructions --for code`
- **THEN** it exits 0
