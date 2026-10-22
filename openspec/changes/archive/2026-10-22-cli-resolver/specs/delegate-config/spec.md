## MODIFIED Requirements

### Requirement: No usable reviewer exits 3
When a `run` request has `reviewers` and the harness can run none of them, the contrib resolver SHALL exit 3, start no session, and name on stderr each reviewer it skipped and why.

#### Scenario: The harness lacks the family
- **WHEN** `lets-delegate-cli run` runs with `claude` on `PATH`, `reviewers` holds only `gpt`/`gpt-6-luna`, and `codex` is not on `PATH`
- **THEN** it exits 3, and stderr names `gpt` and says `codex` is not on `PATH`

#### Scenario: An empty list
- **WHEN** a `run` request reaches the resolver with `reviewers` `[]`
- **THEN** it exits 3, starts no session, and stderr says the request has no reviewers

### Requirement: No list keeps the resolver's own choice
When a `run` request has no `reviewers` field, the contrib resolver SHALL choose the family and model as it did before this field existed.

#### Scenario: An older lets
- **WHEN** a `run` request without `reviewers` reaches `lets-delegate-cli`, with `codex` on `PATH` and `sourceFamily` `claude`
- **THEN** the session runs on `gpt` with codex's default model
