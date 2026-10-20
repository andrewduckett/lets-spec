## MODIFIED Requirements

### Requirement: The default answers last
`lets delegate` SHALL ask the built-in default only when no resolver named by `LETS_SPEC_RESOLVER`, no resolver named by the user's delegate config, and no `lets-delegate-resolver` on `PATH`, answers the request.

#### Scenario: An installed resolver answers a review
- **WHEN** `lets-delegate-resolver` is on `PATH` and answers a review with a final message
- **THEN** `lets delegate review` prints that message and exits 0, and the default is not asked

#### Scenario: A configured resolver answers a review
- **WHEN** the user's delegate config names a resolver, and that resolver answers a review with a final message
- **THEN** `lets delegate review` prints that message and exits 0, and the default is not asked

#### Scenario: Nothing is installed
- **WHEN** `LETS_SPEC_RESOLVER` is unset, no delegate config exists, no `lets-delegate-resolver` is on `PATH`, and the user runs `lets delegate handoff`
- **THEN** `lets delegate handoff` prints a JSON line with `"resolver":"default"`
