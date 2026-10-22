## ADDED Requirements

### Requirement: The check requires options in the probe answer
`lets delegate verify` SHALL fail its `probe` check when the resolver answers `probe` with exit 0 and the answer has no `options`, or `options` is not a list of `<family>` or `<family>/<model>` strings for a family of `gpt`, `claude` or `gemini`. An empty list SHALL pass.

#### Scenario: A probe answer without options
- **WHEN** `lets delegate verify` runs against a resolver whose `probe` prints `{"resolver":"x"}`
- **THEN** the `probe` check fails, its line names `options`, and it exits 1

#### Scenario: An empty list
- **WHEN** `lets delegate verify` runs against `lets-delegate-subagent`
- **THEN** the `probe` check passes

### Requirement: The live run uses the resolver's first option
With `--live`, `lets delegate verify` SHALL send the first entry of the resolver's `probe` options as the `model` of its live `run`. When `options` is empty, it SHALL skip the live `run`, count the check as passed, and say that the resolver lists no model to run.

#### Scenario: A resolver with options
- **WHEN** `lets delegate verify --live` runs against a resolver whose `probe` lists `gpt/gpt-6-luna` first
- **THEN** the live `run` request has `"model":"gpt/gpt-6-luna"`

#### Scenario: A resolver with no options
- **WHEN** `lets delegate verify --live` runs against a resolver whose `probe` answers `"options":[]`
- **THEN** it sends no `run` request, and its output says the resolver lists no model to run
