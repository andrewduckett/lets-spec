# delegate-resolvers Specification

## Purpose
Says what the `t3` and `cli` resolvers built into `lets` do when a `lets delegate` command asks them: when each declines, which models it lists, and how it runs, refuses, times out and cleans up a session.

## Requirements

### Requirement: One resolver runs every family CLI on PATH
`lets` SHALL have a resolver named `cli`. When the config lists it, it SHALL answer with `resolver` `cli` and its `options` wherever at least one of `codex`, `claude` or `agy` is on `PATH`. It SHALL NOT check which harness it runs in.

#### Scenario: One CLI on PATH
- **WHEN** the config's `resolvers` is `[cli]`, `claude` is on `PATH`, and neither `codex` nor `agy` is, and the user runs `lets delegate review instructions --for code`
- **THEN** it exits 0, and its JSON line has `"resolver":"cli"` and `"options":["claude"]`

#### Scenario: Inside T3 Code
- **WHEN** the config's `resolvers` is `[cli]`, the command runs inside T3 Code with `codex` on `PATH`, `codex debug models` lists `gpt-6-luna` with `visibility` `list`, and the user runs `lets delegate review instructions --for code`
- **THEN** it exits 0, and its JSON line has `"resolver":"cli"` and `"options":["gpt/gpt-6-luna"]`

### Requirement: The cli resolver declines when no family CLI is on PATH
When none of `codex`, `claude` or `agy` is on `PATH`, `cli` SHALL decline every review and its instructions, and SHALL start no process. The next resolver in the chain answers, or the command exits 2 when none is left.

#### Scenario: No family CLI
- **WHEN** the config's `resolvers` is `[cli]`, none of `codex`, `claude` or `agy` is on `PATH`, and the user runs `lets delegate review run --for code` with every required option
- **THEN** it exits 2, stdout is empty, stderr says every resolver declined, and no process is started

#### Scenario: No family CLI, and the default next
- **WHEN** the config's `resolvers` is `[cli, subagent]`, none of `codex`, `claude` or `agy` is on `PATH`, and the user runs `lets delegate review instructions --for code`
- **THEN** its JSON line has `"resolver":"subagent"`, and no process is started

### Requirement: The cli resolver runs a review headless
When `cli` answers `lets delegate review run`, it SHALL run the CLI of the `--model` family as a child process in its read-only mode. That is `codex exec` with the read-only sandbox for `gpt`, `claude -p` in plan mode for `claude`, or `agy -p` in plan mode for `gemini`. It SHALL pass the review's effort. It SHALL pass the model part of `--model` unchanged, and SHALL add the effort to a `gemini` model as `<model>-<effort>`. It SHALL pass no model when `--model` is a bare family. The command SHALL print the CLI's final message. Its JSON line on stderr SHALL have the `--model` family as `family`, and a handle of kind `process`.

#### Scenario: A review with codex
- **WHEN** the config's `resolvers` is `[cli]`, `codex` is on `PATH`, the user runs `lets delegate review run --for code --model gpt/gpt-6-luna`, and codex ends with a final message
- **THEN** codex runs with `-m gpt-6-luna`, the command exits 0 and prints codex's final message, and its JSON line on stderr has `"family":"gpt"`, `"model":"gpt-6-luna"` and a `handle` of kind `process`

#### Scenario: A bare family
- **WHEN** the config's `resolvers` is `[cli]`, `claude` is on `PATH`, and the user runs `lets delegate review run --for code --model claude`
- **THEN** claude runs with no `--model` argument, and the JSON line on stderr has `"family":"claude"`

#### Scenario: A gemini model at high effort
- **WHEN** the config's `resolvers` is `[cli]`, `agy` is on `PATH`, and the user runs `lets delegate review run --for code --effort high --model gemini/gemini-3.8-flash`
- **THEN** agy runs with `--model gemini-3.8-flash-high`

#### Scenario: A review leaves the tree unchanged
- **WHEN** a review that `cli` answers ends
- **THEN** no file outside `.workspace/` has changed

#### Scenario: The CLI fails
- **WHEN** `cli` answers a review, and the CLI prints on stdout and then exits non-zero, or exits 0 with an empty final message
- **THEN** `lets delegate review run` exits 5, and stderr says why

#### Scenario: The CLI cannot start
- **WHEN** `cli` answers a review, and the family's CLI is on `PATH` but cannot be started
- **THEN** `lets delegate review run` exits 3, as a refusal, and stderr names the CLI

#### Scenario: The review runs too long
- **WHEN** `cli` answers a review, and the CLI is still running after the review's timeout
- **THEN** `cli` stops the CLI's process, and `lets delegate review run` exits 6

### Requirement: The cli resolver declines every handoff
`cli` SHALL decline every handoff and the instructions for one, even when a family CLI is on `PATH`, and SHALL run no CLI and no listing command for it. The next resolver in the chain answers, or the command exits 2 when none is left.

#### Scenario: A handoff with CLIs on PATH
- **WHEN** the config's `resolvers` is `[cli]`, `codex`, `claude` and `agy` are on `PATH`, and the user runs `lets delegate handoff run --for apply` with every required option
- **THEN** it exits 2, stdout is empty, stderr says every resolver declined, and no process is started

#### Scenario: Handoff instructions with codex on PATH
- **WHEN** the config's `resolvers` is `[cli, subagent]`, `codex` is on `PATH`, and the user runs `lets delegate handoff instructions --for apply`
- **THEN** its JSON line has `"resolver":"subagent"`, and `codex` is not run

### Requirement: The cli resolver cleans up after a review
When a review that `cli` answered ends with a clean tree and a final message, `cli` SHALL remove the files it wrote for that session in `.workspace/lets-delegate/`. When the review ends otherwise, it SHALL leave them.

#### Scenario: Finishing a review with codex
- **WHEN** the config's `resolvers` is `[cli]`, and `lets delegate review run --for code --name cli-resolver --model gpt` ends with a clean tree and codex's final message
- **THEN** it exits 0, and `.workspace/lets-delegate/cli-resolver.last-message.md` no longer exists

#### Scenario: Finishing a review that changed the tree
- **WHEN** the same review ends having changed a file outside `.workspace/`
- **THEN** it exits 7, and `.workspace/lets-delegate/cli-resolver.last-message.md` still exists

### Requirement: T3 Code has its own resolver
`lets` SHALL have a resolver named `t3`, which answers only for T3 Code. Inside T3 Code, it SHALL answer with `resolver` `t3` and its `options`. It SHALL find the process's parents both on a system with `/proc`, such as Linux, and on one without, such as macOS. `lets` SHALL NOT have a resolver for herdr.

#### Scenario: Inside T3 Code
- **WHEN** the config's `resolvers` is `[t3]`, the command runs in a process whose ancestor is the running T3 server, T3 has no model manifest, and the user runs `lets delegate review instructions --for code`
- **THEN** it exits 0, and its JSON line has `"resolver":"t3"` and `"options":[]`

#### Scenario: Inside T3 Code on a system with no /proc
- **WHEN** the same command runs on a system with no `/proc`, where `ps -o ppid= -p <pid>` shows that the running T3 server is the process's ancestor
- **THEN** it exits 0, and its JSON line has `"resolver":"t3"` and `"options":[]`

### Requirement: The T3 resolver opens a session in a T3 thread
Inside T3 Code, when `t3` answers `lets delegate review run` or `lets delegate handoff run`, it SHALL open a session in a T3 thread that runs the `--model`. A bare family SHALL run that provider's default model. It SHALL add the effort to a `gemini` model in a review, as `<model>-<effort>`.

#### Scenario: A review inside T3 Code
- **WHEN** the config's `resolvers` is `[t3]`, the user runs `lets delegate review run --for code --model claude/claude-opus-5-5` inside T3 Code, and the session ends with a final message
- **THEN** the thread runs `claude-opus-5-5`, the command exits 0, and its JSON line on stderr has `"family":"claude"` and a `handle` of kind `thread`

#### Scenario: A handoff inside T3 Code
- **WHEN** the config's `resolvers` is `[t3]`, the user runs `lets delegate handoff run --for apply --model gpt/gpt-6-luna` inside T3 Code, and the project has a default model of `claude-opus-5-5`
- **THEN** the thread runs `gpt-6-luna`

### Requirement: The T3 resolver declines outside T3 Code
When the process is not inside T3 Code, `t3` SHALL decline every review, handoff and their instructions, and SHALL start no session. It SHALL NOT look for any other harness. The next resolver in the chain answers, or the command exits 2 when none is left.

#### Scenario: Inside herdr
- **WHEN** the config's `resolvers` is `[t3]`, the user runs `lets delegate review run --for code` with every required option inside herdr, and no T3 server is its ancestor
- **THEN** it exits 2, stdout is empty, stderr says every resolver declined, and no thread is created

#### Scenario: While T3 Code runs elsewhere
- **WHEN** the config's `resolvers` is `[t3]`, the T3 server is running, and the user runs `lets delegate review instructions --for code` in a terminal that the server did not start
- **THEN** it exits 2, stdout is empty, and stderr says every resolver declined

### Requirement: The cli resolver lists the models each CLI reports
`cli` SHALL list its `options` family by family, in the order `gpt`, `claude`, `gemini`, for each family whose CLI is on `PATH`:
- `gpt`: `gpt/<slug>` for each model that `codex debug models` reports with `visibility` `list`, in the order codex reports them.
- `claude`: the bare family `claude`.
- `gemini`: `gemini/<model>` for each id that `agy models` reports starting with `gemini-`, with its `-low`, `-medium` or `-high` suffix removed, once per model, in the order agy first reports them.

#### Scenario: Every CLI on PATH
- **WHEN** the config's `resolvers` is `[cli]`, `codex debug models` reports `gpt-reserve` with `visibility` `hide` and `gpt-6-luna` with `visibility` `list`, `agy models` reports `gemini-3.8-flash-high`, `gemini-3.8-flash-low` and `claude-sonnet-4-6`, and the user runs `lets delegate review instructions --for code`
- **THEN** its JSON line has `"options":["gpt/gpt-6-luna","claude","gemini/gemini-3.8-flash"]`

### Requirement: The cli resolver lists the bare family when a listing fails
A family's model listing can fail: it exits non-zero, runs past its time limit, or prints what `cli` cannot read. Then `lets delegate review instructions` SHALL list the bare family in that family's place in `options`, and still exit 0. It SHALL name the CLI and the failure on stderr.

#### Scenario: codex is signed out
- **WHEN** the config's `resolvers` is `[cli]`, `codex` and `claude` are on `PATH`, `codex debug models` exits 1, and the user runs `lets delegate review instructions --for code`
- **THEN** it exits 0, its JSON line has `"options":["gpt","claude"]`, and stderr names `codex`

### Requirement: The T3 resolver lists the models in its manifest
Inside T3 Code, `t3` SHALL list its `options` from T3's model manifest. For each provider in the manifest's order, it lists `<family>/<model>` for each model T3 lists, with the provider's default chat model first. It SHALL list each `gemini` model once, with its effort suffix removed. When T3 has no model manifest, it SHALL list no `options`, and the command SHALL name the manifest path on stderr.

#### Scenario: Reading the manifest
- **WHEN** the config's `resolvers` is `[t3]`, the manifest lists `codex` with `gpt-6-luna`, then `claudeAgent` with `claude-opus-5-5` and `claude-fable-5-1` and a default of `claude-fable-5-1`, then `antigravity` with `gemini-3.8-flash-high` and `gemini-3.8-flash-low`, and the user runs `lets delegate review instructions --for code` inside T3 Code
- **THEN** its JSON line has `"options":["gpt/gpt-6-luna","claude/claude-fable-5-1","claude/claude-opus-5-5","gemini/gemini-3.8-flash"]`

#### Scenario: No manifest
- **WHEN** the config's `resolvers` is `[t3]`, T3's `model-manifest.json` does not exist, and the user runs `lets delegate review instructions --for code` inside T3 Code
- **THEN** it exits 0, its JSON line has `"options":[]`, and stderr contains the path of `model-manifest.json`

### Requirement: A resolver runs a model it never listed
`t3` and `cli` SHALL try a `--model` that is not in their `options`, and SHALL NOT refuse it for that reason alone.

#### Scenario: A model the listing lacks
- **WHEN** the config's `resolvers` is `[cli]`, `codex debug models` does not list `gpt-6-astra`, and the user runs `lets delegate review run --for code --model gpt/gpt-6-astra`
- **THEN** codex runs with `-m gpt-6-astra`

### Requirement: A refusal exits 3
When `t3` or `cli` answers, the harness or the account can say no before the model gives any output. `lets delegate review run` and `lets delegate handoff run` SHALL treat that as a refusal, and SHALL say why on stderr. A refusal covers a harness that cannot start the session, and a missing harness setup, such as a T3 project. It also covers an account with no access or no tokens left, and a model the harness cannot run. When every `--model` is refused, the command exits 3. The command SHALL exit 4 for `t3` or `cli` only for an outcome it cannot know, such as no reply from T3.

#### Scenario: The CLI refuses the model
- **WHEN** the config's `resolvers` is `[cli]`, the user runs `lets delegate review run --for code --model gpt/gpt-6-astra`, and codex exits 1 with nothing on stdout
- **THEN** it exits 3, and stderr holds the end of codex's stderr

#### Scenario: A refusal after an earlier run with the same name
- **WHEN** an earlier `gpt` review named `x` left `.workspace/lets-delegate/x.last-message.md`, and a new `lets delegate review run --for code --name x --model gpt/gpt-6-astra` that `cli` answers gets a codex that exits 1 without writing that file
- **THEN** it exits 3, not 5

#### Scenario: T3 has no project for the repository
- **WHEN** the config's `resolvers` is `[t3]`, and the user runs `lets delegate review run --for code` with every required option inside T3 Code in a repository that T3 has no project for
- **THEN** it exits 3, no thread is created, and stderr names the repository

#### Scenario: T3 fails the run before any message
- **WHEN** `t3` answers a review and starts a thread, and T3 marks its run failed with no assistant message
- **THEN** `lets delegate review run` exits 3, and stderr holds T3's failure message

#### Scenario: T3 does not reply
- **WHEN** `t3` answers a review, and T3 does not answer the request to start a thread in time
- **THEN** `lets delegate review run` exits 4

### Requirement: The T3 resolver archives a refused thread
When `t3` refuses a model for a thread it started, it SHALL archive that thread first. When it cannot, it SHALL still refuse, and stderr SHALL name the thread.

#### Scenario: A refused model
- **WHEN** the config's `resolvers` is `[t3]`, and T3 fails the run of the thread that `lets delegate review run --for code`, with every required option, started, before any assistant message
- **THEN** the thread is archived, and the command exits 3

### Requirement: The T3 resolver keeps its token beside the lets config
`t3` SHALL read and write its T3 token at `$XDG_CONFIG_HOME/lets-delegate/t3-token` when `XDG_CONFIG_HOME` is set and not empty, and at `~/.config/lets-delegate/t3-token` otherwise. This is the folder that holds `lets`'s own `config.yaml`. It SHALL NOT read a token from the other path.

#### Scenario: XDG_CONFIG_HOME is set
- **WHEN** `t3` needs a token for a `lets delegate` command, `XDG_CONFIG_HOME` is `/cfg`, and `/cfg/lets-delegate/t3-token` holds `tok`
- **THEN** it uses `tok`, and issues no new token

#### Scenario: XDG_CONFIG_HOME is unset
- **WHEN** `t3` needs a token for a `lets delegate` command, `XDG_CONFIG_HOME` is unset, and no token is stored
- **THEN** it issues a token and writes it to `~/.config/lets-delegate/t3-token`

#### Scenario: XDG_CONFIG_HOME is empty
- **WHEN** `t3` needs a token for a `lets delegate` command, `XDG_CONFIG_HOME` is the empty string, and `~/.config/lets-delegate/t3-token` holds `tok`
- **THEN** it uses `tok`, and issues no new token

#### Scenario: A token is stored only at the old path
- **WHEN** `t3` needs a token for a `lets delegate` command, `XDG_CONFIG_HOME` is `/cfg`, `/cfg/lets-delegate/t3-token` does not exist, and `~/.config/lets-delegate/t3-token` holds `old`
- **THEN** it issues a new token and writes it to `/cfg/lets-delegate/t3-token`, and does not use `old`
