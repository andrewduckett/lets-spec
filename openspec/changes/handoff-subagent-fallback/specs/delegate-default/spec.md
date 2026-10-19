## Purpose

Says what `lets delegate` does when no resolver is installed or configured and the built-in default answers. The default starts no session and chooses no model family.

## ADDED Requirements

### Requirement: The default answers last
`lets delegate` SHALL ask the built-in default only when no resolver named by `LETS_SPEC_RESOLVER`, and no `lets-delegate-resolver` on `PATH`, answers the request.

#### Scenario: An installed resolver answers a review
- **WHEN** `lets-delegate-resolver` is on `PATH` and answers a review with a final message
- **THEN** `lets delegate review` prints that message and exits 0, and the default is not asked

#### Scenario: Nothing is installed
- **WHEN** `LETS_SPEC_RESOLVER` is unset and no `lets-delegate-resolver` is on `PATH`
- **THEN** the default answers the request

### Requirement: The default runs no review
When the default answers a review, `lets delegate review` SHALL exit 3, print nothing on stdout, and start no process.

#### Scenario: A review with no resolver installed
- **WHEN** the default answers `lets delegate review --name x --prompt-file p.md --source-family claude --effort high`
- **THEN** the command exits 3, stdout is empty, and no process is started

#### Scenario: A family CLI is on PATH
- **WHEN** the default answers a review, and `codex`, `claude` and `agy` are all on `PATH`
- **THEN** the command exits 3, and none of them is run

### Requirement: The default's review answer says what to do
When the default answers a review, `lets delegate review` SHALL say on stderr that no resolver is installed and that the review runs in a subagent.

#### Scenario: Reading stderr after exit 3
- **WHEN** the default answers a review
- **THEN** stderr's text contains "no resolver" and "subagent"

### Requirement: The default's handoff hands the prompt back
When the default answers a handoff, `lets delegate handoff` SHALL exit 0 and print one JSON line with `resolver` `default`, `handle` `null`, and `instructions` that contain the prompt text and the path of the file the prompt is saved in.

#### Scenario: A handoff with no resolver installed
- **WHEN** the default answers `lets delegate handoff --name build-x --prompt-file p.md`, and `p.md` holds `Run lets-build on branch build-x`
- **THEN** the command exits 0, and its JSON line has `"resolver":"default"`, `"handle":null`, and `instructions` that contain `Run lets-build on branch build-x` and `.workspace/lets-delegate/build-x.prompt.md`

#### Scenario: The saved prompt
- **WHEN** the default answers a handoff named `build-x`
- **THEN** `.workspace/lets-delegate/build-x.prompt.md` in the repository holds the prompt

### Requirement: The default's handoff names no CLI
The default's handoff instructions SHALL be the same whichever agent CLIs are on `PATH`, and SHALL name none of them.

#### Scenario: CLIs on PATH
- **WHEN** the default answers the same handoff once with `claude`, `codex` and `agy` on `PATH`, and once with none of them
- **THEN** both answers have the same `instructions`, and neither contains `claude`, `codex` or `agy` as a command to run
