## Purpose

Says what `lets delegate review run` records about a finished review, so a skill can report who reviewed the work and what the review was for.

## ADDED Requirements

### Requirement: The review record says what the review was for
When `lets delegate review run` exits 0, the JSON line it prints on stderr SHALL hold `for`, the intent that `--for` gives, as its first field. The line SHALL still hold `resolver`, `family`, `model`, `independent`, `handle`, `gitClean` and `durationSeconds`.

#### Scenario: A code review
- **WHEN** a resolver answers a run, and the user runs `lets delegate review run --for code`
- **THEN** the command exits 0, and its stderr ends with one JSON line that starts `{"for":"code",` and holds `resolver`, `family`, `model`, `independent`, `handle`, `gitClean` and `durationSeconds`

#### Scenario: A plan review
- **WHEN** a resolver answers a run, and the user runs `lets delegate review run --for plan`
- **THEN** the command exits 0, and its stderr ends with one JSON line that starts `{"for":"plan",` and holds `resolver`, `family`, `model`, `independent`, `handle`, `gitClean` and `durationSeconds`
