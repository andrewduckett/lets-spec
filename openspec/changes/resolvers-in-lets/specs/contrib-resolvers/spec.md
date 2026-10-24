## MODIFIED Requirements

### Requirement: Each resolver passes the verify check
`lets delegate verify` SHALL pass for `lets-delegate-t3`, `lets-delegate-cli`, `lets-delegate-subagent` and `lets/resolvers/headless-resolver`, each checked on its own.

#### Scenario: Checking the T3 resolver outside T3 Code
- **WHEN** `lets delegate verify` runs against `lets-delegate-t3` outside T3 Code
- **THEN** it exits 0

#### Scenario: Checking the cli resolver with no family CLI
- **WHEN** `lets delegate verify` runs against `lets-delegate-cli` with none of `codex`, `claude` or `agy` on `PATH`
- **THEN** it exits 0

#### Scenario: Checking the subagent resolver
- **WHEN** `lets delegate verify` runs against `lets-delegate-subagent` outside any harness
- **THEN** it exits 0

### Requirement: The sh example declines a probe for start
`lets/resolvers/headless-resolver` SHALL decline a `probe` request whose `verb` is `start`: exit 75, print nothing on stdout, and print `headless-resolver: this resolver only runs headless` on stderr. A `probe` whose `verb` is `run`, or that has no `verb`, SHALL exit 0 and print `{"resolver":"headless-sh","options":["claude"]}`.

#### Scenario: A probe for a handoff
- **WHEN** `lets/resolvers/headless-resolver probe` gets `{"protocol":2,"cwd":"/repo","verb":"start"}`
- **THEN** it exits 75, stdout is empty, and stderr is `headless-resolver: this resolver only runs headless`

#### Scenario: A probe for a review
- **WHEN** `lets/resolvers/headless-resolver probe` gets `{"protocol":2,"cwd":"/repo","verb":"run"}`
- **THEN** it exits 0 and prints `{"resolver":"headless-sh","options":["claude"]}`

#### Scenario: A probe with no verb
- **WHEN** `lets/resolvers/headless-resolver probe` gets `{"protocol":2,"cwd":"/repo"}`
- **THEN** it exits 0 and prints `{"resolver":"headless-sh","options":["claude"]}`

#### Scenario: Handoff instructions with the example first
- **WHEN** the delegate config lists the absolute path of `lets/resolvers/headless-resolver`, then `subagent`, and the user runs `lets delegate handoff instructions --for apply`
- **THEN** the JSON line it prints has `"resolver":"subagent"`

