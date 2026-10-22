## ADDED Requirements

### Requirement: The check requires options in the probe answer
`lets delegate verify` SHALL fail its `probe` check when the resolver answers `probe` with exit 0 and the answer has no `options`, or `options` is not a list of `<family>` or `<family>/<model>` strings for a family of `gpt`, `claude` or `gemini`. An empty list SHALL pass.

#### Scenario: A probe answer without options
- **WHEN** `lets delegate verify` runs against a resolver whose `probe` prints `{"resolver":"x"}`
- **THEN** the `probe` check fails, its line names `options`, and it exits 1

#### Scenario: An empty list
- **WHEN** `lets delegate verify` runs against `lets-delegate-subagent`
- **THEN** the `probe` check passes

### Requirement: The live run tries the resolver's options in order
With `--live`, `lets delegate verify` SHALL send the resolver's `probe` options, in order, as the `model` of its live `run`, and SHALL stop at the first `run` that does not exit 3. When every option exits 3, the check SHALL fail and name each option with its refusal. When `options` is empty, it SHALL skip the live `run`, count the check as passed, and say that the resolver lists no model to run.

#### Scenario: A resolver with options
- **WHEN** `lets delegate verify --live` runs against a resolver whose `probe` lists `gpt/gpt-6-luna` first, and that run answers
- **THEN** the only live `run` request has `"model":"gpt/gpt-6-luna"`

#### Scenario: The first option is refused
- **WHEN** the resolver's `probe` lists `gpt/gpt-6-astra` then `claude`, and the `gpt/gpt-6-astra` run exits 3
- **THEN** a second live `run` request has `"model":"claude"`, and the check passes when that run answers

#### Scenario: Every option is refused
- **WHEN** every live `run` exits 3
- **THEN** the check fails, its output names each option, and it exits 1

#### Scenario: A resolver with no options
- **WHEN** `lets delegate verify --live` runs against a resolver whose `probe` answers `"options":[]`
- **THEN** it sends no `run` request, and its output says the resolver lists no model to run
