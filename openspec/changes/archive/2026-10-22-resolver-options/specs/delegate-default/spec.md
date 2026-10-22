## MODIFIED Requirements

### Requirement: The default runs no review
When the default answers a review, `lets delegate review` SHALL exit 3, print nothing on stdout, and start no process.

#### Scenario: A review with no resolver installed
- **WHEN** the default answers `lets delegate review --name x --prompt-file p.md --source-family claude --effort high --model gpt`
- **THEN** the command exits 3, stdout is empty, and no process is started

#### Scenario: A family CLI is on PATH
- **WHEN** the default answers a review, and `codex`, `claude` and `agy` are all on `PATH`
- **THEN** the command exits 3, and none of them is run

### Requirement: The default's handoff hands the prompt back
When the default answers a handoff, `lets delegate handoff` SHALL exit 0 and print one JSON line with `resolver` `subagent`, `handle` `null`, and `instructions` that contain the prompt text and the path of the file the prompt is saved in.

#### Scenario: A handoff with no resolver installed
- **WHEN** the default answers `lets delegate handoff --name build-x --prompt-file p.md --model claude`, and `p.md` holds `Run lets-build on branch build-x`
- **THEN** the command exits 0, and its JSON line has `"resolver":"subagent"`, `"handle":null`, and `instructions` that contain `Run lets-build on branch build-x` and `.workspace/lets-delegate/build-x.prompt.md`

#### Scenario: The saved prompt
- **WHEN** the default answers a handoff named `build-x`
- **THEN** `.workspace/lets-delegate/build-x.prompt.md` in the repository holds the prompt

### Requirement: The default never declines
`lets-delegate-subagent` SHALL answer `probe`, `run` and `start` wherever it runs, and SHALL never exit 75. It SHALL answer `probe` with `{"resolver":"subagent","options":[]}`, because it can run no model.

#### Scenario: probe in a plain terminal
- **WHEN** `lets-delegate-subagent probe` runs outside any harness
- **THEN** it exits 0 and prints `{"resolver":"subagent","options":[]}`
