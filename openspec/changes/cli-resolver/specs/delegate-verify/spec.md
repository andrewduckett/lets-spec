## Purpose
Says how `lets delegate verify` checks that a resolver keeps the protocol, for people who write a resolver and for users checking one they installed.

## ADDED Requirements

### Requirement: The check is lets delegate verify
`lets delegate verify <resolver>` SHALL check that the resolver keeps the protocol, and exit 0 when every check passes and 1 when one fails. `lets` SHALL NOT keep `lets delegate conformance` as another name for it.

#### Scenario: Checking a resolver
- **WHEN** a user runs `lets delegate verify contrib/headless-resolver`
- **THEN** it exits 0, and its last line is `The resolver keeps the contract.`

#### Scenario: The old command name
- **WHEN** a user runs `lets delegate conformance contrib/headless-resolver`
- **THEN** it exits 2, and stderr says the command is unknown

### Requirement: The live check accepts a declined handoff
With `--live`, when the resolver declines `start` with exit 75 and nothing on stdout, `lets delegate verify` SHALL count that check as passed, and SHALL say that the next resolver in the chain answers handoffs. A `start` that exits 75 and prints on stdout SHALL fail the check.

#### Scenario: A resolver that only runs headless
- **WHEN** `lets delegate verify --live` runs against a resolver whose `run` passes and whose `start` exits 75 with nothing on stdout
- **THEN** it exits 0, and its output says the resolver declined `start` and that the next resolver answers handoffs

#### Scenario: A declined handoff that prints
- **WHEN** `lets delegate verify --live` runs against a resolver whose `start` exits 75 and prints on stdout
- **THEN** the `start` check fails, and it exits 1
