# resolvers Specification

## Purpose
Says which resolver programs this repository ships in `resolvers/`, when each one answers a request or declines it, and how a user gets them from the release folder or the flake.

## Requirements

### Requirement: The release folder ships each resolver
The release folder's `resolvers/` SHALL hold exactly `headless-resolver`, `lets-delegate-cli`, `lets-delegate-subagent` and `lets-delegate-t3`, each executable. `lets-delegate-cli`, `lets-delegate-subagent` and `lets-delegate-t3` SHALL each run with Node and no `node_modules` beside them.

#### Scenario: Listing the release folder
- **WHEN** a user lists the release folder's `resolvers/`
- **THEN** it holds `headless-resolver`, `lets-delegate-cli`, `lets-delegate-subagent` and `lets-delegate-t3`, and nothing else

#### Scenario: Running a release copy alone
- **WHEN** the release folder's `resolvers/lets-delegate-t3` is copied into an empty directory and run as `probe` outside T3 Code
- **THEN** it exits 75, and its stderr is `lets-delegate-t3: not inside T3 Code`

#### Scenario: Running the cli copy alone
- **WHEN** the release folder's `resolvers/lets-delegate-cli` is copied into an empty directory and run as `probe` with none of `codex`, `claude` or `agy` on `PATH`
- **THEN** it exits 75, and its stderr is `lets-delegate-cli: none of codex, claude or agy is on PATH`

#### Scenario: Running the subagent copy alone
- **WHEN** the release folder's `resolvers/lets-delegate-subagent` is copied into an empty directory and run as `probe`
- **THEN** it exits 0 and prints `{"resolver":"subagent","options":[]}`

### Requirement: The flake packages each resolver
The flake SHALL provide a package `lets-delegate-t3` and a package `lets-delegate-cli`, each with a program of the same name. It SHALL NOT provide a package `lets-delegate-resolver` or `lets-delegate-herdr`.

#### Scenario: Installing the T3 resolver with Nix
- **WHEN** a user runs `nix build .#lets-delegate-t3`
- **THEN** `result/bin/lets-delegate-t3` exists and is executable

#### Scenario: Installing the cli resolver with Nix
- **WHEN** a user runs `nix build .#lets-delegate-cli`
- **THEN** `result/bin/lets-delegate-cli` exists and is executable

#### Scenario: The old package name
- **WHEN** a user runs `nix build .#lets-delegate-resolver`
- **THEN** the build fails, because the flake has no such package

#### Scenario: The herdr package name
- **WHEN** a user runs `nix build .#lets-delegate-herdr`
- **THEN** the build fails, because the flake has no such package

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

### Requirement: The T3 and cli resolvers refuse to finish a handle they never make
`lets-delegate-t3` and `lets-delegate-cli` SHALL answer `finish` for a handle of a kind they do not make with exit 4 and nothing on stdout.

#### Scenario: The T3 resolver gets a process
- **WHEN** `lets-delegate-t3 finish` gets a handle of kind `process`
- **THEN** it exits 4 and stdout is empty

#### Scenario: The cli resolver gets a thread
- **WHEN** `lets-delegate-cli finish` gets a handle of kind `thread`
- **THEN** it exits 4 and stdout is empty

### Requirement: A run or start needs a model
`lets-delegate-t3`, `lets-delegate-cli` and `lets-delegate-subagent` SHALL exit 2 with nothing on stdout, and start nothing, when a `run` or `start` request has no `model`, or a `model` that is not `<family>` or `<family>/<model>` for a family of `gpt`, `claude` or `gemini`. Stderr SHALL name the field.

#### Scenario: No model
- **WHEN** `lets-delegate-cli run` gets a request with no `model`, with `claude` on `PATH`
- **THEN** it exits 2, stdout is empty, no process is started, and stderr names `model`

#### Scenario: An unknown family
- **WHEN** `lets-delegate-subagent start` gets `model` `llama/llama-4`
- **THEN** it exits 2, stdout is empty, and stderr names `model`

### Requirement: A probe's verb is run or start
`lets-delegate-t3`, `lets-delegate-cli` and `lets-delegate-subagent` SHALL accept a `probe` request with no `verb`, or with `verb` `run` or `start`. Any other `verb` SHALL exit 2 with nothing on stdout, and stderr SHALL name `verb`.

#### Scenario: An unknown verb
- **WHEN** `lets-delegate-subagent probe` gets `"verb":"finish"`
- **THEN** it exits 2, stdout is empty, and stderr names `verb`

#### Scenario: The default and a probe for start
- **WHEN** `lets-delegate-subagent probe` gets `"verb":"start"`
- **THEN** it exits 0 and prints `{"resolver":"subagent","options":[]}`

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
