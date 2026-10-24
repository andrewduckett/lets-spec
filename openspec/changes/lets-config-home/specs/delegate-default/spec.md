## MODIFIED Requirements

### Requirement: The default answers when nothing else does
When no config file exists, or the config holds no `delegate.resolvers`, `lets delegate` SHALL ask the default, `subagent`, which is built into `lets`. When the config holds `delegate.resolvers`, `lets delegate` SHALL ask the default only where the chain holds the entry `subagent`, in that position, and only when every resolver before it declines.

#### Scenario: No config
- **WHEN** no config file exists, and the user runs `lets delegate handoff run --for apply`
- **THEN** `lets delegate handoff run` prints a JSON line with `"resolver":"subagent"`

#### Scenario: A config with no delegate section
- **WHEN** the config holds only `version: 3`, and the user runs `lets delegate handoff run --for apply`
- **THEN** `lets delegate handoff run` prints a JSON line with `"resolver":"subagent"`

#### Scenario: A delegate section with no chain
- **WHEN** the config holds `version: 3` and `delegate.review.code.guidance`, but no `delegate.resolvers`, and the user runs `lets delegate handoff run --for apply`
- **THEN** `lets delegate handoff run` prints a JSON line with `"resolver":"subagent"`

#### Scenario: A listed resolver answers before the default
- **WHEN** the config lists a resolver that answers a review with a final message, then `subagent`
- **THEN** `lets delegate review run --for code` prints that message and exits 0, and the default is not asked

#### Scenario: A listed resolver declines and the default is next
- **WHEN** the config lists a resolver that declines, then `subagent`
- **THEN** `lets delegate handoff run --for apply` prints a JSON line with `"resolver":"subagent"`

#### Scenario: The chain leaves the default out
- **WHEN** the config lists one resolver that declines, and no `subagent` entry
- **THEN** `lets delegate handoff run --for apply` exits 2, and the default is not asked

#### Scenario: The default runs with lets's own Node
- **WHEN** the config lists `subagent`, and no `node` is on `PATH`
- **THEN** `lets delegate handoff run --for apply` prints a JSON line with `"resolver":"subagent"`
