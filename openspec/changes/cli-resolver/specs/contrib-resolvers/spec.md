## ADDED Requirements

### Requirement: One resolver runs every family CLI on PATH
The repository SHALL ship `lets-delegate-cli`. It SHALL answer `probe` with `{"resolver":"cli"}` in any terminal or harness where at least one of `codex`, `claude` or `agy` is on `PATH`. It SHALL NOT check which harness it runs in.

#### Scenario: probe with one CLI on PATH
- **WHEN** `lets-delegate-cli probe` runs with `claude` on `PATH`, and neither `codex` nor `agy` is
- **THEN** it exits 0 and prints `{"resolver":"cli"}`

#### Scenario: probe inside T3 Code
- **WHEN** `lets-delegate-cli probe` runs inside T3 Code, with `codex` on `PATH`
- **THEN** it exits 0 and prints `{"resolver":"cli"}`

### Requirement: The cli resolver declines when no family CLI is on PATH
When none of `codex`, `claude` or `agy` is on `PATH`, `lets-delegate-cli` SHALL decline `probe` and `run`: exit 75, print nothing on stdout, and start no process. Its stderr SHALL be `lets-delegate-cli: none of codex, claude or agy is on PATH`.

#### Scenario: No family CLI
- **WHEN** `lets-delegate-cli run` runs with none of `codex`, `claude` or `agy` on `PATH`
- **THEN** it exits 75, stdout is empty, and stderr is `lets-delegate-cli: none of codex, claude or agy is on PATH`

### Requirement: The cli resolver runs a review headless
`lets-delegate-cli` SHALL answer `run` by running the chosen family's CLI as a child process in its read-only mode: `codex exec` with the read-only sandbox, `claude -p` in plan mode, or `agy -p` in plan mode. It SHALL pass the review's effort, and the reviewer's model when there is one. It SHALL answer with the CLI's final message as `text` and a handle of kind `process`. Only families whose CLI is on `PATH` SHALL be available to it.

#### Scenario: A review with codex
- **WHEN** `lets-delegate-cli run` runs with `sourceFamily` `claude` and `codex` on `PATH`, and codex ends with a final message
- **THEN** it exits 0, the response's `family` is `gpt`, its `text` is codex's final message, and its `handle.kind` is `process`

#### Scenario: A review leaves the tree unchanged
- **WHEN** a `run` session by `lets-delegate-cli` ends
- **THEN** no file outside `.workspace/` has changed

#### Scenario: The CLI fails
- **WHEN** the family's CLI exits non-zero, or ends with an empty final message
- **THEN** `lets-delegate-cli run` exits 5, and stderr says why

#### Scenario: The CLI cannot start
- **WHEN** the family's CLI is on `PATH` but cannot be started
- **THEN** `lets-delegate-cli run` exits 4, and stderr names the CLI

#### Scenario: The review runs too long
- **WHEN** the CLI is still running after the request's `timeoutMinutes`
- **THEN** `lets-delegate-cli` stops the CLI's process and exits 6

### Requirement: The cli resolver declines every handoff
`lets-delegate-cli` SHALL decline every `start` request, even when a family CLI is on `PATH`: exit 75, print nothing on stdout, and start no process. Its stderr SHALL be `lets-delegate-cli: this resolver only runs headless`.

#### Scenario: A handoff with CLIs on PATH
- **WHEN** `lets-delegate-cli start` runs with `codex`, `claude` and `agy` on `PATH`
- **THEN** it exits 75, stdout is empty, and stderr is `lets-delegate-cli: this resolver only runs headless`

### Requirement: The cli resolver cleans up after a review
When `lets-delegate-cli finish` gets a `process` handle that it issued and `ok` is true, it SHALL remove the files it wrote for that session in `.workspace/lets-delegate/`, and exit 0 with nothing on stdout. When `ok` is false, it SHALL leave them.

#### Scenario: Finishing a review with codex
- **WHEN** `lets-delegate-cli finish` gets the handle from a `gpt` review named `cli-resolver`, with `ok` true
- **THEN** it exits 0, stdout is empty, and `.workspace/lets-delegate/cli-resolver.last-message.md` no longer exists

#### Scenario: Finishing a failed review
- **WHEN** `lets-delegate-cli finish` gets the same handle with `ok` false
- **THEN** it exits 0, and `.workspace/lets-delegate/cli-resolver.last-message.md` still exists

### Requirement: Each resolver passes the verify check
`lets delegate verify` SHALL pass for `lets-delegate-t3`, `lets-delegate-cli`, `lets-delegate-subagent` and `contrib/headless-resolver`, each checked on its own.

#### Scenario: Checking the T3 resolver outside T3 Code
- **WHEN** `lets delegate verify` runs against `lets-delegate-t3` outside T3 Code
- **THEN** it exits 0

#### Scenario: Checking the cli resolver with no family CLI
- **WHEN** `lets delegate verify` runs against `lets-delegate-cli` with none of `codex`, `claude` or `agy` on `PATH`
- **THEN** it exits 0

#### Scenario: Checking the subagent resolver
- **WHEN** `lets delegate verify` runs against `lets-delegate-subagent` outside any harness
- **THEN** it exits 0

### Requirement: T3 Code has its own resolver
The repository SHALL ship `lets-delegate-t3`, which answers only for T3 Code. Inside T3 Code, it SHALL answer `probe` with `{"resolver":"t3"}`. The repository SHALL NOT ship a resolver for herdr.

#### Scenario: probe inside T3 Code
- **WHEN** `lets-delegate-t3 probe` runs in a process whose ancestor is the running T3 server
- **THEN** it exits 0 and prints `{"resolver":"t3"}`

### Requirement: The T3 resolver opens a session in a T3 thread
Inside T3 Code, `lets-delegate-t3` SHALL answer `run` and `start` with a session in a T3 thread.

#### Scenario: A review inside T3 Code
- **WHEN** `lets-delegate-t3 run` runs inside T3 Code, and the session ends with a final message
- **THEN** it exits 0, and the response's `handle.kind` is `thread`

### Requirement: The T3 resolver declines outside T3 Code
When the process is not inside T3 Code, `lets-delegate-t3` SHALL decline `probe`, `run` and `start`: exit 75, print nothing on stdout, and start no session. It SHALL NOT look for any other harness. Its stderr SHALL be `lets-delegate-t3: not inside T3 Code`.

#### Scenario: The T3 resolver inside herdr
- **WHEN** `lets-delegate-t3 run` runs inside herdr, and no T3 server is its ancestor
- **THEN** it exits 75, stdout is empty, no thread is created, and stderr is `lets-delegate-t3: not inside T3 Code`

#### Scenario: The T3 resolver while T3 Code runs elsewhere
- **WHEN** the T3 server is running, and `lets-delegate-t3 probe` runs in a terminal that the server did not start
- **THEN** it exits 75, stdout is empty, and stderr is `lets-delegate-t3: not inside T3 Code`

### Requirement: The T3 and cli resolvers refuse to finish a handle they never make
`lets-delegate-t3` and `lets-delegate-cli` SHALL answer `finish` for a handle of a kind they do not make with exit 4 and nothing on stdout.

#### Scenario: The T3 resolver gets a process
- **WHEN** `lets-delegate-t3 finish` gets a handle of kind `process`
- **THEN** it exits 4 and stdout is empty

#### Scenario: The cli resolver gets a thread
- **WHEN** `lets-delegate-cli finish` gets a handle of kind `thread`
- **THEN** it exits 4 and stdout is empty

## MODIFIED Requirements

### Requirement: The release folder ships each resolver
The release folder's `contrib/` SHALL hold exactly `headless-resolver`, `lets-delegate-cli`, `lets-delegate-subagent` and `lets-delegate-t3`, each executable. `lets-delegate-cli`, `lets-delegate-subagent` and `lets-delegate-t3` SHALL each run with Node and no `node_modules` beside them.

#### Scenario: Listing the release folder
- **WHEN** a user lists the release folder's `contrib/`
- **THEN** it holds `headless-resolver`, `lets-delegate-cli`, `lets-delegate-subagent` and `lets-delegate-t3`, and nothing else

#### Scenario: Running a release copy alone
- **WHEN** the release folder's `contrib/lets-delegate-t3` is copied into an empty directory and run as `probe` outside T3 Code
- **THEN** it exits 75, and its stderr is `lets-delegate-t3: not inside T3 Code`

#### Scenario: Running the cli copy alone
- **WHEN** the release folder's `contrib/lets-delegate-cli` is copied into an empty directory and run as `probe` with none of `codex`, `claude` or `agy` on `PATH`
- **THEN** it exits 75, and its stderr is `lets-delegate-cli: none of codex, claude or agy is on PATH`

#### Scenario: Running the subagent copy alone
- **WHEN** the release folder's `contrib/lets-delegate-subagent` is copied into an empty directory and run as `probe`
- **THEN** it exits 0 and prints `{"resolver":"subagent"}`

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

## REMOVED Requirements

### Requirement: Each harness has its own resolver
**Reason**: herdr no longer has its own resolver; `lets-delegate-cli` answers in any terminal.
**Migration**: See the requirements "T3 Code has its own resolver" and "One resolver runs every family CLI on PATH".

### Requirement: A resolver opens a session in its own harness
**Reason**: Only `lets-delegate-t3` opens a session in a harness now. `lets-delegate-cli` runs reviews headless.
**Migration**: See the requirements "The T3 resolver opens a session in a T3 thread" and "The cli resolver runs a review headless".

### Requirement: A resolver declines outside its harness
**Reason**: Only `lets-delegate-t3` checks its harness now. `lets-delegate-cli` declines when no family CLI is on `PATH`.
**Migration**: See the requirements "The T3 resolver declines outside T3 Code" and "The cli resolver declines when no family CLI is on PATH".

### Requirement: A resolver refuses to finish a handle it never makes
**Reason**: herdr's `tab` handle is gone, and `lets-delegate-cli` issues `process` handles.
**Migration**: See the requirement "The T3 and cli resolvers refuse to finish a handle they never make".

### Requirement: Each resolver passes the conformance check
**Reason**: `lets delegate conformance` is renamed `lets delegate verify`, and `lets-delegate-herdr` becomes `lets-delegate-cli`.
**Migration**: See the requirement "Each resolver passes the verify check".
