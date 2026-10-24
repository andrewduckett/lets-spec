# delegate-default Specification

## Purpose
Says when `lets delegate` asks the built-in default, `subagent`: when there is no config, or where the config's chain lists `subagent`. The default starts no session and chooses no model family.

## Requirements

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

### Requirement: The default runs no review
When the default answers a review, `lets delegate review run` SHALL exit 3, print nothing on stdout, and start no process.

#### Scenario: A review with no resolver installed
- **WHEN** the default answers `lets delegate review run --for code --name x --prompt-file p.md --source-family claude --effort high --model gpt`
- **THEN** the command exits 3, stdout is empty, and no process is started

#### Scenario: A family CLI is on PATH
- **WHEN** the default answers a review, and `codex`, `claude` and `agy` are all on `PATH`
- **THEN** the command exits 3, and none of them is run

### Requirement: The default's review answer says what to do
When the default answers a review, `lets delegate review run` SHALL say on stderr that no resolver started a session and that the review runs in a subagent. It SHALL NOT say that no resolver is installed, because the default also answers when an installed resolver declines.

#### Scenario: Reading stderr after exit 3
- **WHEN** the default answers a review
- **THEN** stderr's text contains "no resolver" and "subagent", and does not contain "installed"

### Requirement: The default's handoff hands the prompt back
When the default answers a handoff, `lets delegate handoff run` SHALL exit 0 and print one JSON line with `resolver` `subagent`, `handle` `null`, and `instructions` that contain the prompt text and the path of the file the prompt is saved in.

#### Scenario: A handoff with no resolver installed
- **WHEN** the default answers `lets delegate handoff run --for apply --name build-x --prompt-file p.md --model claude`, and `p.md` holds `Run lets-build on branch build-x`
- **THEN** the command exits 0, and its JSON line has `"resolver":"subagent"`, `"handle":null`, and `instructions` that contain `Run lets-build on branch build-x` and `.workspace/lets-delegate/build-x.prompt.md`

#### Scenario: The saved prompt
- **WHEN** the default answers a handoff named `build-x`
- **THEN** `.workspace/lets-delegate/build-x.prompt.md` in the repository holds the prompt

### Requirement: The default's handoff names no CLI
The default's handoff instructions SHALL be the same whichever agent CLIs are on `PATH`, and SHALL name none of them.

#### Scenario: CLIs on PATH
- **WHEN** the default answers the same handoff once with `claude`, `codex` and `agy` on `PATH`, and once with none of them
- **THEN** both answers have the same `instructions`, and neither contains `claude`, `codex` or `agy` as a command to run

### Requirement: Every lets carries the default
The `lets` of the release tarball, of the Nix `lets` package and of the repository's source tree SHALL each answer as the default with nothing else installed or configured. The default SHALL be part of `lets` itself, and SHALL need no file beside it.

#### Scenario: The release tarball
- **WHEN** a user unpacks the release tarball, and runs its `bin/lets delegate handoff run --for apply` with nothing else installed or configured
- **THEN** the JSON line has `"resolver":"subagent"`

#### Scenario: The Nix package
- **WHEN** a user runs the Nix package's `lets delegate handoff run --for apply` with nothing else installed or configured
- **THEN** the JSON line has `"resolver":"subagent"`

#### Scenario: The source tree
- **WHEN** a developer runs `lets/bin/lets delegate handoff run --for apply` in this repository with nothing else installed or configured
- **THEN** the JSON line has `"resolver":"subagent"`

#### Scenario: The program beside lets is gone
- **WHEN** the release folder has no `resolvers/` folder, nothing else is configured, and the user runs `lets delegate handoff run --for apply`
- **THEN** the JSON line has `"resolver":"subagent"`

### Requirement: The default answers wherever lets runs
The default, `subagent`, SHALL answer wherever `lets` runs, inside a harness or not, and SHALL never decline. Asked which models it can run, it SHALL list none.

#### Scenario: Instructions in a plain terminal
- **WHEN** no config file exists, the command runs outside any harness, and the user runs `lets delegate review instructions --for code`
- **THEN** it exits 0 and prints one JSON line with `"resolver":"subagent"` and `"options":[]`
