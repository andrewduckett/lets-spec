## ADDED Requirements

### Requirement: The cli resolver declines a probe for start
`lets-delegate-cli` SHALL decline a `probe` request whose `verb` is `start`: exit 75, print nothing on stdout, and run no listing command. A `probe` whose `verb` is `run`, or that has no `verb`, SHALL be answered as before.

#### Scenario: A probe for a handoff
- **WHEN** `lets-delegate-cli probe` gets `{"protocol":2,"cwd":"/repo","verb":"start"}`, with `codex` on `PATH`
- **THEN** it exits 75, stdout is empty, and `codex` is not run

#### Scenario: A probe for a review
- **WHEN** `lets-delegate-cli probe` gets `"verb":"run"`, with `claude` on `PATH`
- **THEN** it exits 0, and its `options` hold `claude`

### Requirement: A probe's verb is run or start
`lets-delegate-t3`, `lets-delegate-cli` and `lets-delegate-subagent` SHALL accept a `probe` request with no `verb`, or with `verb` `run` or `start`. Any other `verb` SHALL exit 2 with nothing on stdout, and stderr SHALL name `verb`.

#### Scenario: An unknown verb
- **WHEN** `lets-delegate-subagent probe` gets `"verb":"finish"`
- **THEN** it exits 2, stdout is empty, and stderr names `verb`

#### Scenario: The default and a probe for start
- **WHEN** `lets-delegate-subagent probe` gets `"verb":"start"`
- **THEN** it exits 0 and prints `{"resolver":"subagent","options":[]}`
