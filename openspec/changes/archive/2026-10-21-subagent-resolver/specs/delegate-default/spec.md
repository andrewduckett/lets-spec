## MODIFIED Requirements

### Requirement: The default answers last
`lets delegate` SHALL ask the default resolver, `lets-delegate-subagent`, only when no resolver named by `LETS_SPEC_RESOLVER`, no resolver named by the user's delegate config, and no `lets-delegate-resolver` on `PATH`, answers the request.

#### Scenario: An installed resolver answers a review
- **WHEN** `lets-delegate-resolver` is on `PATH` and answers a review with a final message
- **THEN** `lets delegate review` prints that message and exits 0, and the default is not asked

#### Scenario: A configured resolver answers a review
- **WHEN** the user's delegate config names a resolver, and that resolver answers a review with a final message
- **THEN** `lets delegate review` prints that message and exits 0, and the default is not asked

#### Scenario: Nothing is installed
- **WHEN** `LETS_SPEC_RESOLVER` is unset, no delegate config exists, no `lets-delegate-resolver` is on `PATH`, and the user runs `lets delegate handoff`
- **THEN** `lets delegate handoff` prints a JSON line with `"resolver":"subagent"`

### Requirement: The default's handoff hands the prompt back
When the default answers a handoff, `lets delegate handoff` SHALL exit 0 and print one JSON line with `resolver` `subagent`, `handle` `null`, and `instructions` that contain the prompt text and the path of the file the prompt is saved in.

#### Scenario: A handoff with no resolver installed
- **WHEN** the default answers `lets delegate handoff --name build-x --prompt-file p.md`, and `p.md` holds `Run lets-build on branch build-x`
- **THEN** the command exits 0, and its JSON line has `"resolver":"subagent"`, `"handle":null`, and `instructions` that contain `Run lets-build on branch build-x` and `.workspace/lets-delegate/build-x.prompt.md`

#### Scenario: The saved prompt
- **WHEN** the default answers a handoff named `build-x`
- **THEN** `.workspace/lets-delegate/build-x.prompt.md` in the repository holds the prompt

## ADDED Requirements

### Requirement: Every lets carries the default
The release tarball, the Nix `lets` package and the repository's source tree SHALL each carry `lets-delegate-subagent` beside `lets`. Each `lets` SHALL run its own copy as a separate process, with no other install.

#### Scenario: The release tarball
- **WHEN** a user unpacks the release tarball, and runs its `bin/lets delegate handoff` with nothing else installed or configured
- **THEN** the JSON line has `"resolver":"subagent"`

#### Scenario: The Nix package
- **WHEN** a user runs the Nix package's `lets delegate handoff` with nothing else installed or configured
- **THEN** the JSON line has `"resolver":"subagent"`

#### Scenario: The source tree
- **WHEN** a developer runs `lets/bin/lets delegate handoff` in this repository with nothing else installed or configured
- **THEN** the JSON line has `"resolver":"subagent"`

### Requirement: The default never declines
`lets-delegate-subagent` SHALL answer `probe`, `run` and `start` wherever it runs, and SHALL never exit 75. It SHALL answer `probe` with `{"resolver":"subagent"}`.

#### Scenario: probe in a plain terminal
- **WHEN** `lets-delegate-subagent probe` runs outside any harness
- **THEN** it exits 0 and prints `{"resolver":"subagent"}`

### Requirement: The default finishes nothing
`lets-delegate-subagent` SHALL answer `finish` with exit 0 and nothing on stdout, whatever the handle.

#### Scenario: A handle it never issued
- **WHEN** `lets-delegate-subagent finish` gets a handle of kind `thread`
- **THEN** it exits 0 and stdout is empty

### Requirement: A missing or broken default fails the request
When the lookup reaches the default, and its own `lets-delegate-subagent` is missing or fails with any exit other than 0 or 3, `lets delegate` SHALL exit 4 and print nothing on stdout. Stderr SHALL name the file `lets` tried to run and say that the `lets` install is incomplete.

#### Scenario: The file is gone
- **WHEN** the release folder's `contrib/lets-delegate-subagent` is deleted, nothing else is installed or configured, and the user runs `lets delegate review`
- **THEN** the command exits 4, stdout is empty, and stderr contains the path of `contrib/lets-delegate-subagent` and the word `incomplete`

#### Scenario: A handoff with the file gone
- **WHEN** the release folder's `contrib/lets-delegate-subagent` is deleted, nothing else is installed or configured, and the user runs `lets delegate handoff`
- **THEN** the command exits 4, stdout is empty, and no file is written under `.workspace/lets-delegate/`

#### Scenario: The file is broken
- **WHEN** the release folder's `contrib/lets-delegate-subagent` holds text that Node cannot run, nothing else is installed or configured, and the user runs `lets delegate review`
- **THEN** the command exits 4, stdout is empty, and stderr contains the path of `contrib/lets-delegate-subagent` and the word `incomplete`
