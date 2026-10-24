## MODIFIED Requirements

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
- **THEN** it exits 2, the example is not run, and stderr names that path and the config file
