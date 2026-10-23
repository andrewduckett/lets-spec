# contrib-resolvers Specification

## Purpose
Says which resolver programs this repository ships in `contrib/`, when each one answers a request or declines it, and how a user gets them from the release folder or the flake.

## Requirements

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

### Requirement: One resolver runs every family CLI on PATH
The repository SHALL ship `lets-delegate-cli`. It SHALL answer `probe` with `resolver` `cli` and its `options` in any terminal or harness where at least one of `codex`, `claude` or `agy` is on `PATH`. It SHALL NOT check which harness it runs in.

#### Scenario: probe with one CLI on PATH
- **WHEN** `lets-delegate-cli probe` runs with `claude` on `PATH`, and neither `codex` nor `agy` is
- **THEN** it exits 0 and prints `{"resolver":"cli","options":["claude"]}`

#### Scenario: probe inside T3 Code
- **WHEN** `lets-delegate-cli probe` runs inside T3 Code, with `codex` on `PATH` and `codex debug models` listing `gpt-6-luna` with `visibility` `list`
- **THEN** it exits 0 and prints `{"resolver":"cli","options":["gpt/gpt-6-luna"]}`

### Requirement: The cli resolver declines when no family CLI is on PATH
When none of `codex`, `claude` or `agy` is on `PATH`, `lets-delegate-cli` SHALL decline `probe` and `run`: exit 75, print nothing on stdout, and start no process. Its stderr SHALL be `lets-delegate-cli: none of codex, claude or agy is on PATH`.

#### Scenario: No family CLI
- **WHEN** `lets-delegate-cli run` runs with none of `codex`, `claude` or `agy` on `PATH`
- **THEN** it exits 75, stdout is empty, and stderr is `lets-delegate-cli: none of codex, claude or agy is on PATH`

### Requirement: The cli resolver runs a review headless
`lets-delegate-cli` SHALL answer `run` by running the CLI of the request's `model` family as a child process in its read-only mode: `codex exec` with the read-only sandbox for `gpt`, `claude -p` in plan mode for `claude`, or `agy -p` in plan mode for `gemini`. It SHALL pass the review's effort. It SHALL pass the model part of `model` unchanged, adding the effort to a `gemini` model as `<model>-<effort>`, and SHALL pass no model when `model` is a bare family. It SHALL answer with the CLI's final message as `text`, the request's family as `family`, and a handle of kind `process`.

#### Scenario: A review with codex
- **WHEN** `lets-delegate-cli run` gets `model` `gpt/gpt-6-luna` with `codex` on `PATH`, and codex ends with a final message
- **THEN** codex runs with `-m gpt-6-luna`, `run` exits 0, the response's `family` is `gpt` and its `model` is `gpt-6-luna`, its `text` is codex's final message, and its `handle.kind` is `process`

#### Scenario: A bare family
- **WHEN** `lets-delegate-cli run` gets `model` `claude` with `claude` on `PATH`
- **THEN** claude runs with no `--model` argument, and the response's `family` is `claude`

#### Scenario: A gemini model at high effort
- **WHEN** `lets-delegate-cli run` gets `model` `gemini/gemini-3.8-flash` and `effort` `high`
- **THEN** agy runs with `--model gemini-3.8-flash-high`

#### Scenario: A review leaves the tree unchanged
- **WHEN** a `run` session by `lets-delegate-cli` ends
- **THEN** no file outside `.workspace/` has changed

#### Scenario: The CLI fails
- **WHEN** the CLI prints on stdout and then exits non-zero, or exits 0 with an empty final message
- **THEN** `lets-delegate-cli run` exits 5, and stderr says why

#### Scenario: The CLI cannot start
- **WHEN** the family's CLI is on `PATH` but cannot be started
- **THEN** `lets-delegate-cli run` exits 3, as a refusal, and stderr names the CLI

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
The repository SHALL ship `lets-delegate-t3`, which answers only for T3 Code. Inside T3 Code, it SHALL answer `probe` with `resolver` `t3` and its `options`. It SHALL find the process's parents both on a system with `/proc`, such as Linux, and on one without, such as macOS. The repository SHALL NOT ship a resolver for herdr.

#### Scenario: probe inside T3 Code
- **WHEN** `lets-delegate-t3 probe` runs in a process whose ancestor is the running T3 server, and T3 has no model manifest
- **THEN** it exits 0 and prints `{"resolver":"t3","options":[]}`

#### Scenario: probe inside T3 Code on a system with no /proc
- **WHEN** `lets-delegate-t3 probe` runs on a system with no `/proc`, where `ps -o ppid= -p <pid>` shows that the running T3 server is the process's ancestor, and T3 has no model manifest
- **THEN** it exits 0 and prints `{"resolver":"t3","options":[]}`

### Requirement: The T3 resolver opens a session in a T3 thread
Inside T3 Code, `lets-delegate-t3` SHALL answer `run` and `start` with a session in a T3 thread that runs the request's `model`. A bare family SHALL run that provider's default model. It SHALL add the effort to a `gemini` model in `run`, as `<model>-<effort>`.

#### Scenario: A review inside T3 Code
- **WHEN** `lets-delegate-t3 run` runs inside T3 Code with `model` `claude/claude-opus-5-5`, and the session ends with a final message
- **THEN** the thread runs `claude-opus-5-5`, `run` exits 0, the response's `family` is `claude`, and its `handle.kind` is `thread`

#### Scenario: A handoff inside T3 Code
- **WHEN** `lets-delegate-t3 start` runs inside T3 Code with `model` `gpt/gpt-6-luna`, and the project has a default model of `claude-opus-5-5`
- **THEN** the thread runs `gpt-6-luna`

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

### Requirement: The cli resolver lists the models each CLI reports
`lets-delegate-cli` SHALL list its `options` family by family, in the order `gpt`, `claude`, `gemini`, for each family whose CLI is on `PATH`:
- `gpt`: `gpt/<slug>` for each model that `codex debug models` reports with `visibility` `list`, in the order codex reports them.
- `claude`: the bare family `claude`.
- `gemini`: `gemini/<model>` for each id that `agy models` reports starting with `gemini-`, with its `-low`, `-medium` or `-high` suffix removed, once per model, in the order agy first reports them.

#### Scenario: Every CLI on PATH
- **WHEN** `codex debug models` reports `gpt-reserve` with `visibility` `hide` and `gpt-6-luna` with `visibility` `list`, and `agy models` reports `gemini-3.8-flash-high`, `gemini-3.8-flash-low` and `claude-sonnet-4-6`
- **THEN** `lets-delegate-cli probe` prints `{"resolver":"cli","options":["gpt/gpt-6-luna","claude","gemini/gemini-3.8-flash"]}`

### Requirement: The cli resolver lists the bare family when a listing fails
When a family's CLI is on `PATH` but its model listing exits non-zero, runs past its time limit, or prints what the resolver cannot read, `lets-delegate-cli probe` SHALL list the bare family in that family's place in `options`, still exit 0, and name the CLI and the failure on stderr.

#### Scenario: codex is signed out
- **WHEN** `codex` and `claude` are on `PATH`, and `codex debug models` exits 1
- **THEN** `lets-delegate-cli probe` exits 0, prints `{"resolver":"cli","options":["gpt","claude"]}`, and stderr names `codex`

### Requirement: The T3 resolver lists the models in its manifest
Inside T3 Code, `lets-delegate-t3` SHALL list its `options` from T3's model manifest: for each provider in the manifest's order, `<family>/<model>` for each model T3 lists, with the provider's default chat model first. It SHALL list each `gemini` model once, with its effort suffix removed.

#### Scenario: Reading the manifest
- **WHEN** the manifest lists `codex` with `gpt-6-luna`, then `claudeAgent` with `claude-opus-5-5` and `claude-fable-5-1` and a default of `claude-fable-5-1`, then `antigravity` with `gemini-3.8-flash-high` and `gemini-3.8-flash-low`
- **THEN** `lets-delegate-t3 probe` prints `{"resolver":"t3","options":["gpt/gpt-6-luna","claude/claude-fable-5-1","claude/claude-opus-5-5","gemini/gemini-3.8-flash"]}`

### Requirement: A run or start needs a model
`lets-delegate-t3`, `lets-delegate-cli` and `lets-delegate-subagent` SHALL exit 2 with nothing on stdout, and start nothing, when a `run` or `start` request has no `model`, or a `model` that is not `<family>` or `<family>/<model>` for a family of `gpt`, `claude` or `gemini`. Stderr SHALL name the field.

#### Scenario: No model
- **WHEN** `lets-delegate-cli run` gets a request with no `model`, with `claude` on `PATH`
- **THEN** it exits 2, stdout is empty, no process is started, and stderr names `model`

#### Scenario: An unknown family
- **WHEN** `lets-delegate-subagent start` gets `model` `llama/llama-4`
- **THEN** it exits 2, stdout is empty, and stderr names `model`

### Requirement: A resolver runs a model it never listed
`lets-delegate-t3` and `lets-delegate-cli` SHALL try a `model` that is not in their `options`, and SHALL NOT refuse it for that reason alone.

#### Scenario: A model the manifest lacks
- **WHEN** `lets-delegate-cli run` gets `model` `gpt/gpt-6-astra`, and `codex debug models` does not list it
- **THEN** codex runs with `-m gpt-6-astra`

### Requirement: A refusal exits 3
`lets-delegate-t3` and `lets-delegate-cli` SHALL exit 3 when the harness or the account says no before the model gives any output, and SHALL say why on stderr. That covers a harness that cannot start the session, a missing harness setup such as a T3 project, an account with no access or no tokens left, and a model the harness cannot run. They SHALL exit 4 only for a request they cannot read, a broken contract, or an outcome they cannot know, such as no reply from T3.

#### Scenario: The CLI refuses the model
- **WHEN** `lets-delegate-cli run` gets `model` `gpt/gpt-6-astra`, and codex exits 1 with nothing on stdout
- **THEN** it exits 3, and stderr holds the end of codex's stderr

#### Scenario: A refusal after an earlier run with the same name
- **WHEN** an earlier `gpt` run named `x` left `.workspace/lets-delegate/x.last-message.md`, and a new `lets-delegate-cli run` named `x` gets a codex that exits 1 without writing that file
- **THEN** it exits 3, not 5

#### Scenario: T3 has no project for the repository
- **WHEN** `lets-delegate-t3 run` runs inside T3 Code in a repository that T3 has no project for
- **THEN** it exits 3, creates no thread, and stderr names the repository

#### Scenario: T3 fails the run before any message
- **WHEN** `lets-delegate-t3 run` starts a thread, and T3 marks its run failed with no assistant message
- **THEN** it exits 3, and stderr holds T3's failure message

#### Scenario: T3 does not reply
- **WHEN** T3 does not answer the request to start a thread in time
- **THEN** `lets-delegate-t3 run` exits 4

### Requirement: The T3 resolver archives a refused thread
When `lets-delegate-t3` exits 3 for a thread it started, it SHALL archive that thread first. When it cannot, it SHALL still exit 3 and name the thread on stderr.

#### Scenario: A refused model
- **WHEN** T3 fails the run of a thread that `lets-delegate-t3 run` started, before any assistant message
- **THEN** the thread is archived, and the resolver exits 3

### Requirement: The cli resolver declines a probe for start
`lets-delegate-cli` SHALL decline a `probe` request whose `verb` is `start`: exit 75, print nothing on stdout, and run no listing command. A `probe` whose `verb` is `run`, or that has no `verb`, SHALL be answered as before.

#### Scenario: A probe for a handoff
- **WHEN** `lets-delegate-cli probe` gets `{"protocol":2,"cwd":"/repo","verb":"start"}`, with `codex` on `PATH`
- **THEN** it exits 75, stdout is empty, and `codex` is not run

#### Scenario: A probe for a review
- **WHEN** `lets-delegate-cli probe` gets `"verb":"run"`, with `claude` on `PATH`
- **THEN** it exits 0, and its `options` hold `claude`

### Requirement: A probe's verb is run or start
`lets-delegate-t3`, `lets-delegate-cli` and `lets-delegate-subagent` SHALL accept a `probe` request with no `verb`, or with `verb` `run` or `start`. Any other `verb` SHALL exit 2 with nothing on stdout, and stderr SHALL name `verb`.

#### Scenario: An unknown verb
- **WHEN** `lets-delegate-subagent probe` gets `"verb":"finish"`
- **THEN** it exits 2, stdout is empty, and stderr names `verb`

#### Scenario: The default and a probe for start
- **WHEN** `lets-delegate-subagent probe` gets `"verb":"start"`
- **THEN** it exits 0 and prints `{"resolver":"subagent","options":[]}`

### Requirement: The sh example declines a probe for start
`contrib/headless-resolver` SHALL decline a `probe` request whose `verb` is `start`: exit 75, print nothing on stdout, and print `headless-resolver: this resolver only runs headless` on stderr. A `probe` whose `verb` is `run`, or that has no `verb`, SHALL exit 0 and print `{"resolver":"headless-sh","options":["claude"]}`.

#### Scenario: A probe for a handoff
- **WHEN** `contrib/headless-resolver probe` gets `{"protocol":2,"cwd":"/repo","verb":"start"}`
- **THEN** it exits 75, stdout is empty, and stderr is `headless-resolver: this resolver only runs headless`

#### Scenario: A probe for a review
- **WHEN** `contrib/headless-resolver probe` gets `{"protocol":2,"cwd":"/repo","verb":"run"}`
- **THEN** it exits 0 and prints `{"resolver":"headless-sh","options":["claude"]}`

#### Scenario: A probe with no verb
- **WHEN** `contrib/headless-resolver probe` gets `{"protocol":2,"cwd":"/repo"}`
- **THEN** it exits 0 and prints `{"resolver":"headless-sh","options":["claude"]}`

#### Scenario: Handoff instructions with the example first
- **WHEN** the delegate config lists the absolute path of `contrib/headless-resolver`, then `subagent`, and the user runs `lets delegate handoff instructions --for apply`
- **THEN** the JSON line it prints has `"resolver":"subagent"`
