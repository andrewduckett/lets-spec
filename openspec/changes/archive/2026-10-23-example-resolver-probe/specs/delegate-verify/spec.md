## ADDED Requirements

### Requirement: The check probes for start
`lets delegate verify` SHALL send a second `probe` request, whose `verb` is `start`, and report it on its own line. The check SHALL pass when the resolver exits 75 with nothing on stdout, or exits 0 with an answer that meets the rules of the `probe` check: a `resolver`, and `options` as a list of `<family>` or `<family>/<model>` strings. It SHALL fail otherwise. The `probe` whose `verb` is `run` SHALL stay as it is.

#### Scenario: The sh example declines the probe for start
- **WHEN** `lets delegate verify` runs against `contrib/headless-resolver`
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

### Requirement: The live check fails a resolver that answers the probe for a start it declines
With `--live`, `lets delegate verify` SHALL report on its own line, `a resolver that declines start also declines its probe`, whether the resolver's probe for `start` matches its `start`. The line SHALL fail when `start` exits 75 and the probe for `start` exited 0, and SHALL pass otherwise. Without `--live`, `lets delegate verify` SHALL NOT print the line.

#### Scenario: A resolver that answers the probe and declines start
- **WHEN** `lets delegate verify --live` runs against a resolver whose probe for `start` exits 0 with a valid answer, and whose `start` exits 75 with nothing on stdout
- **THEN** the line `a resolver that declines start also declines its probe` starts with `FAIL`, and it exits 1

#### Scenario: A resolver that declines both
- **WHEN** `lets delegate verify --live` runs against a resolver whose probe for `start` and whose `start` each exit 75 with nothing on stdout, and whose `run` passes
- **THEN** the line `a resolver that declines start also declines its probe` starts with `ok`, and it exits 0

#### Scenario: A resolver that answers both
- **WHEN** `lets delegate verify --live` runs against a resolver whose probe for `start` and whose `start` each answer
- **THEN** the line `a resolver that declines start also declines its probe` starts with `ok`

#### Scenario: Without --live
- **WHEN** `lets delegate verify` runs without `--live`
- **THEN** its output has no line `a resolver that declines start also declines its probe`

### Requirement: The live start names a model from the probe for start
With `--live`, the `start` request that `lets delegate verify` sends SHALL name, as its `model`, the first option in the answer to the probe for `start`. When that probe was declined, failed its check, or listed no options, the `model` SHALL be `claude`.

#### Scenario: Different options for run and start
- **WHEN** `lets delegate verify --live` runs against a resolver whose probe for `run` lists `gpt/gpt-6-luna` and whose probe for `start` lists `gemini/gemini-3.8-flash`
- **THEN** the live `start` request has `"model":"gemini/gemini-3.8-flash"`

#### Scenario: The probe for start is declined
- **WHEN** `lets delegate verify --live` runs against a resolver whose probe for `start` exits 75, and whose probe for `run` lists `gpt/gpt-6-luna`
- **THEN** the live `start` request has `"model":"claude"`

## MODIFIED Requirements

### Requirement: The live check accepts a declined handoff
With `--live`, when the resolver declines `start` with exit 75 and nothing on stdout, `lets delegate verify` SHALL count that check as passed, and SHALL say that the next resolver in the chain answers handoffs. A `start` that exits 75 and prints on stdout SHALL fail the check.

#### Scenario: A resolver that only runs headless
- **WHEN** `lets delegate verify --live` runs against a resolver whose `run` passes, and whose probe for `start` and whose `start` each exit 75 with nothing on stdout
- **THEN** it exits 0, and its output says the resolver declined `start` and that the next resolver answers handoffs

#### Scenario: A declined handoff that prints
- **WHEN** `lets delegate verify --live` runs against a resolver whose `start` exits 75 and prints on stdout
- **THEN** the `start` check fails, and it exits 1
