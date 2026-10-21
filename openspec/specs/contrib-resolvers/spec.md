# contrib-resolvers Specification

## Purpose
Says which resolver programs this repository ships in `contrib/`, when each one answers a request or declines it, and how a user gets them from the release folder or the flake.

## Requirements

### Requirement: Each harness has its own resolver
The repository SHALL ship `lets-delegate-t3`, which answers only for T3 Code, and `lets-delegate-herdr`, which answers only for herdr. Inside its harness, each SHALL answer `probe` with its harness's name.

#### Scenario: probe inside T3 Code
- **WHEN** `lets-delegate-t3 probe` runs in a process whose ancestor is the running T3 server
- **THEN** it exits 0 and prints `{"resolver":"t3"}`

#### Scenario: probe inside herdr
- **WHEN** `lets-delegate-herdr probe` runs with `HERDR_ENV=1` and `herdr` on `PATH`
- **THEN** it exits 0 and prints `{"resolver":"herdr"}`

### Requirement: A resolver opens a session in its own harness
Inside its harness, a resolver SHALL answer `run` and `start` with a session in that harness: `lets-delegate-t3` with a T3 thread, and `lets-delegate-herdr` with a herdr tab.

#### Scenario: A review inside T3 Code
- **WHEN** `lets-delegate-t3 run` runs inside T3 Code, and the session ends with a final message
- **THEN** it exits 0, and the response's `handle.kind` is `thread`

#### Scenario: A review inside herdr
- **WHEN** `lets-delegate-herdr run` runs inside herdr, and the session ends with a final message
- **THEN** it exits 0, and the response's `handle.kind` is `tab`

### Requirement: A resolver declines outside its harness
When the process is not inside its harness, a resolver SHALL decline `probe`, `run` and `start`: exit 75, print nothing on stdout, and start no session. It SHALL NOT look for any other harness. Its stderr SHALL name the program and its harness.

#### Scenario: The T3 resolver inside herdr
- **WHEN** `lets-delegate-t3 run` runs inside herdr, and no T3 server is its ancestor
- **THEN** it exits 75, stdout is empty, no thread or tab is created, and stderr is `lets-delegate-t3: not inside T3 Code`

#### Scenario: The T3 resolver while T3 Code runs elsewhere
- **WHEN** the T3 server is running, and `lets-delegate-t3 probe` runs in a terminal that the server did not start
- **THEN** it exits 75, stdout is empty, and stderr is `lets-delegate-t3: not inside T3 Code`

#### Scenario: The herdr resolver inside T3 Code
- **WHEN** `lets-delegate-herdr run` runs inside T3 Code, and `HERDR_ENV` is unset
- **THEN** it exits 75, stdout is empty, no thread or tab is created, and stderr is `lets-delegate-herdr: not inside herdr`

#### Scenario: herdr is not on PATH
- **WHEN** `lets-delegate-herdr probe` runs with `HERDR_ENV=1`, and `herdr` is not on `PATH`
- **THEN** it exits 75, stdout is empty, and stderr is `lets-delegate-herdr: not inside herdr`

### Requirement: A resolver refuses to finish a handle it never makes
A resolver SHALL answer `finish` for a handle of a kind it does not make with exit 4 and nothing on stdout.

#### Scenario: The T3 resolver gets a tab
- **WHEN** `lets-delegate-t3 finish` gets a handle of kind `tab`
- **THEN** it exits 4 and stdout is empty

#### Scenario: The herdr resolver gets a thread
- **WHEN** `lets-delegate-herdr finish` gets a handle of kind `thread`
- **THEN** it exits 4 and stdout is empty

### Requirement: Each resolver passes the conformance check
`lets delegate conformance` SHALL pass for `lets-delegate-t3`, `lets-delegate-herdr` and `contrib/headless-resolver`, each checked on its own.

#### Scenario: Checking the T3 resolver outside T3 Code
- **WHEN** `lets delegate conformance` runs against `lets-delegate-t3` outside T3 Code
- **THEN** it exits 0

#### Scenario: Checking the herdr resolver outside herdr
- **WHEN** `lets delegate conformance` runs against `lets-delegate-herdr` outside herdr
- **THEN** it exits 0

### Requirement: The release folder ships each resolver
The release folder's `contrib/` SHALL hold exactly `headless-resolver`, `lets-delegate-herdr` and `lets-delegate-t3`, each executable. `lets-delegate-herdr` and `lets-delegate-t3` SHALL each run with Node and no `node_modules` beside them.

#### Scenario: Listing the release folder
- **WHEN** a user lists the release folder's `contrib/`
- **THEN** it holds `headless-resolver`, `lets-delegate-herdr` and `lets-delegate-t3`, and nothing else

#### Scenario: Running a release copy alone
- **WHEN** the release folder's `contrib/lets-delegate-t3` is copied into an empty directory and run as `probe` outside T3 Code
- **THEN** it exits 75, and its stderr is `lets-delegate-t3: not inside T3 Code`

### Requirement: The flake packages each resolver
The flake SHALL provide a package `lets-delegate-t3` and a package `lets-delegate-herdr`, each with a program of the same name. It SHALL NOT provide a package `lets-delegate-resolver`.

#### Scenario: Installing the T3 resolver with Nix
- **WHEN** a user runs `nix build .#lets-delegate-t3`
- **THEN** `result/bin/lets-delegate-t3` exists and is executable

#### Scenario: The old package name
- **WHEN** a user runs `nix build .#lets-delegate-resolver`
- **THEN** the build fails, because the flake has no such package
