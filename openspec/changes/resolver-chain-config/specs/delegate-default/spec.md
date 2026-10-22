## MODIFIED Requirements

### Requirement: The default answers last
When no config file exists, `lets delegate` SHALL ask the default resolver, `lets-delegate-subagent`, from the release it runs from, after the resolver `LETS_SPEC_RESOLVER` names, if any. When a config file exists, `lets delegate` SHALL ask the default only where the config lists it, and only when every resolver before it declines.

#### Scenario: Nothing is installed
- **WHEN** `LETS_SPEC_RESOLVER` is unset, no config file exists, and the user runs `lets delegate handoff`
- **THEN** `lets delegate handoff` prints a JSON line with `"resolver":"subagent"`

#### Scenario: An installed resolver answers a review
- **WHEN** the config lists a resolver that answers a review with a final message, then the default
- **THEN** `lets delegate review` prints that message and exits 0, and the default is not asked

#### Scenario: A configured resolver answers a review
- **WHEN** the config lists a resolver that declines, then the default's path
- **THEN** `lets delegate handoff` prints a JSON line with `"resolver":"subagent"`

#### Scenario: The config leaves the default out
- **WHEN** the config lists one resolver that declines, and not the default
- **THEN** `lets delegate handoff` exits 2, and the default is not asked
