## MODIFIED Requirements

### Requirement: The check is lets delegate verify
`lets delegate verify <resolver>` SHALL check that the resolver keeps the protocol, and exit 0 when every check passes and 1 when one fails. `lets` SHALL NOT keep `lets delegate conformance` as another name for it.

#### Scenario: Checking a resolver
- **WHEN** a user runs `lets delegate verify lets/resolvers/headless-resolver`
- **THEN** it exits 0, and its last line is `The resolver keeps the contract.`

#### Scenario: The old command name
- **WHEN** a user runs `lets delegate conformance lets/resolvers/headless-resolver`
- **THEN** it exits 2, and stderr says the command is unknown

### Requirement: The check probes for start
`lets delegate verify` SHALL send a second `probe` request, whose `verb` is `start`, and report it on its own line. The check SHALL pass when the resolver exits 75 with nothing on stdout, or exits 0 with an answer that meets the rules of the `probe` check: a `resolver`, and `options` as a list of `<family>` or `<family>/<model>` strings. It SHALL fail otherwise. The `probe` whose `verb` is `run` SHALL stay as it is.

#### Scenario: The sh example declines the probe for start
- **WHEN** `lets delegate verify` runs against `lets/resolvers/headless-resolver`
- **THEN** the line for the probe for `start` starts with `ok`, and it exits 0

#### Scenario: A resolver that answers the probe for start
- **WHEN** `lets delegate verify` runs against `lets-delegate-subagent`
- **THEN** the line for the probe for `start` starts with `ok`, and it exits 0

#### Scenario: An answer without options
- **WHEN** `lets delegate verify` runs against a resolver whose probe for `start` prints `{"resolver":"x"}` and exits 0
- **THEN** the line for the probe for `start` starts with `FAIL` and names `options`, and it exits 1

#### Scenario: A decline that prints
- **WHEN** `lets delegate verify` runs against a resolver whose probe for `start` exits 75 and prints on stdout
- **THEN** the line for the probe for `start` starts with `FAIL`, and it exits 1

