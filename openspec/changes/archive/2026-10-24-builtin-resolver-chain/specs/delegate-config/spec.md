## MODIFIED Requirements

### Requirement: The config file
The config SHALL be one YAML document in `$XDG_CONFIG_HOME/lets-delegate/config.yaml`, or in `~/.config/lets-delegate/config.yaml` when `XDG_CONFIG_HOME` is unset. It SHALL hold `version` `2` and `resolvers`, the chain: a list of the resolvers to ask, in order. Each entry SHALL be the name of a resolver built into `lets`: `t3`, `cli` or `subagent`. The list MAY be empty. The config MAY hold `delegations`, which only `instructions` reads. Every `lets delegate review` and `lets delegate handoff` command SHALL ignore any other key. When `version` is not the number `2`, when `resolvers` is not a list, or when the document is not YAML, they SHALL exit 2 with a message that names the file and the bad value.

#### Scenario: A valid config
- **WHEN** the file holds `version: 2` and `resolvers:` listing `t3` and `subagent`, and `t3` declines
- **THEN** `lets delegate review run --for code` reads it without error, and asks `t3`, then the default, in that order

#### Scenario: An invalid config
- **WHEN** the file's `resolvers` holds `bin/lets-delegate-t3`
- **THEN** `lets delegate review run --for code` exits 2, and stderr names the file and `bin/lets-delegate-t3`

#### Scenario: The old version
- **WHEN** the file holds `version: 1`
- **THEN** `lets delegate review run --for code` exits 2, and stderr names the file and says the version must be `2`

#### Scenario: Resolvers that are not a list
- **WHEN** the file holds `version: 2` and `resolvers: t3`
- **THEN** `lets delegate review run --for code` exits 2, and stderr names the file and `resolvers`

#### Scenario: A key from a later lets
- **WHEN** the file holds `version: 2`, a valid `resolvers`, and a key `telemetry` that this `lets` does not know
- **THEN** `lets delegate review run --for code` reads it without error and asks the listed resolvers

#### Scenario: run ignores the guidance
- **WHEN** the file holds `delegations.code.guidance: 42`
- **THEN** `lets delegate review run --for code` reads it without error and asks the listed resolvers

### Requirement: A chain where every resolver declines fails the command
When every resolver the config lists declines, `lets delegate` SHALL exit 2, print nothing on stdout, and say on stderr that every resolver declined, naming the config file. The help text of `lets delegate review run` and `lets delegate handoff run` SHALL name this case under exit 2.

#### Scenario: Only a T3 resolver, run from a terminal
- **WHEN** the config lists only `t3`, and the command runs outside T3 Code
- **THEN** `lets delegate review run --for code` exits 2, stdout is empty, and stderr names the config file and says every resolver declined

#### Scenario: An empty list
- **WHEN** the config's `resolvers` is `[]`
- **THEN** `lets delegate handoff run --for apply` exits 2, stdout is empty, and stderr names the config file and says every resolver declined

#### Scenario: The help text
- **WHEN** the user runs `lets delegate review run --help`
- **THEN** the line for exit 2 says that every resolver in the config declined

### Requirement: A request from lets carries the model the user gave
`lets delegate review run` and `lets delegate handoff run` SHALL require at least one `--model <family[/model]>`. The family SHALL be `gpt`, `claude` or `gemini`. They SHALL ask the resolver for that family and that model. Without `--model`, or when any `--model` is not of that form, they SHALL exit 2 and ask no resolver.

#### Scenario: A review with a model
- **WHEN** the user runs `lets delegate review run --for code --model gpt/gpt-6-luna` with the other required options
- **THEN** the resolver is asked for the family `gpt` and the model `gpt-6-luna`

#### Scenario: A handoff with a bare family
- **WHEN** the user runs `lets delegate handoff run --for apply --name build-x --prompt-file p.md --model claude`
- **THEN** the resolver is asked for the family `claude` and no particular model

#### Scenario: No model
- **WHEN** the user runs `lets delegate review run --for code` without `--model`
- **THEN** it exits 2, stderr names `--model`, and no resolver is asked

#### Scenario: An unknown family
- **WHEN** the user runs `lets delegate review run --for code --model gpt --model llama/llama-4` with the other required options
- **THEN** it exits 2, stderr names `llama/llama-4`, and no resolver is asked

### Requirement: Every delegation names its intent
`instructions` and `run` SHALL require `--for <intent>`. Under `review`, the intent SHALL be `plan` or `code`. Under `handoff`, it SHALL be `apply`. Without `--for`, or with any other value, they SHALL exit 2, name `--for` on stderr, and ask no resolver.

#### Scenario: No intent
- **WHEN** the user runs `lets delegate handoff run --name build-x --prompt-file p.md --model claude`
- **THEN** it exits 2, stderr names `--for`, and no resolver is asked

#### Scenario: An intent from the other strategy
- **WHEN** the user runs `lets delegate review instructions --for apply`
- **THEN** it exits 2, stderr names `--for`, and no resolver is asked

#### Scenario: The one handoff intent
- **WHEN** the user runs `lets delegate handoff run --for apply --name build-x --prompt-file p.md --model claude`
- **THEN** the resolver is asked to start an interactive session

### Requirement: A refused model passes to the next
`run` SHALL take `--model` one or more times, as a ranked list. It SHALL ask the resolver that answers for the first model. While that resolver refuses, `run` SHALL ask the same resolver for the next model, and SHALL stop at the first answer that is not a refusal. It SHALL NOT ask a later resolver in the chain after a refusal. When every model is refused, `run` SHALL exit 3, print nothing on stdout, and print on stderr one line per model, `<model>: <reason>`. The review's JSON line on stderr SHALL name, as `model`, the model the resolver ran, or the `--model` value `lets` asked for when that value names only a family.

#### Scenario: The first model is refused
- **WHEN** the user runs `lets delegate review run --for code --model gpt/gpt-6-astra --model gemini` with the other required options, and the resolver refuses `gpt/gpt-6-astra` and answers for `gemini`
- **THEN** the resolver is asked twice, the second time for the family `gemini`, and the command exits 0 with the second answer

#### Scenario: Every model is refused
- **WHEN** the resolver refuses both `--model gpt/gpt-6-astra` and `--model gemini`
- **THEN** `lets delegate review run` exits 3, stdout is empty, and stderr has a line starting `gpt/gpt-6-astra: ` and a line starting `gemini: `

#### Scenario: A failure that is not a refusal
- **WHEN** the session fails for the first of two models
- **THEN** `lets delegate review run` exits 5, and the resolver is not asked for the second model

#### Scenario: A refusal never moves down the chain
- **WHEN** the config lists `t3` then `cli`, and `t3` refuses every model of a review
- **THEN** `lets delegate review run` exits 3, and `cli` is not asked

#### Scenario: The review names the model that ran
- **WHEN** the resolver refuses `gpt/gpt-6-astra`, then answers for `gemini/gemini-3-pro`
- **THEN** the JSON line on stderr has `"model":"gemini-3-pro"`

#### Scenario: The resolver reports a null model
- **WHEN** the resolver answers for `--model claude`, and reports no model of its own
- **THEN** the JSON line on stderr has `"model":"claude"`

## ADDED Requirements

### Requirement: The chain is asked in order, by name
`lets delegate` SHALL ask the resolvers the config's `resolvers` names, in the order listed. A resolver declines when it cannot run here, and one that cannot start interactive sessions declines every handoff. The first that does not decline SHALL answer, and no later one is asked. `lets` SHALL NOT read `LETS_SPEC_RESOLVER`, and SHALL NOT run any program to answer a review or a handoff.

#### Scenario: The first declines
- **WHEN** the config lists `t3` then `cli`, and `t3` declines the review
- **THEN** `cli` is asked, and `lets delegate review run --for code` exits 0 with `cli`'s answer

#### Scenario: The first answers
- **WHEN** the config lists `t3` then `cli`, and `t3` answers the review
- **THEN** `lets delegate review run --for code` prints `t3`'s answer, and `cli` is not asked

#### Scenario: A headless resolver and a handoff
- **WHEN** the config lists `cli` then `subagent`, `cli` can run here, and the user runs `lets delegate handoff run --for apply`
- **THEN** `cli` starts nothing, and the JSON line has `"resolver":"subagent"`

#### Scenario: The environment is ignored
- **WHEN** `LETS_SPEC_RESOLVER` names an executable `/x`, and the config lists `t3`, which answers
- **THEN** `t3` answers, and `/x` is not run

#### Scenario: A resolver on PATH is not run
- **WHEN** an executable named `lets-delegate-t3` is on `PATH`, and the config lists `t3`
- **THEN** `lets delegate review run --for code` does not run it

### Requirement: An unknown resolver name stops the command
An entry of the config's `resolvers` that is not `t3`, `cli` or `subagent` SHALL stop every `lets delegate review` and `lets delegate handoff` command before it asks any resolver. The command SHALL exit 2 and print nothing on stdout. Stderr SHALL name the config file, the entry, and the three names. An absolute path is such an entry: `lets` SHALL NOT rewrite it to a name.

#### Scenario: A path from an older lets
- **WHEN** the config lists `/opt/r/lets-delegate-t3`
- **THEN** `lets delegate review run --for code` exits 2, and stderr contains the config file's path, `/opt/r/lets-delegate-t3`, `t3`, `cli` and `subagent`

#### Scenario: A name lets does not know
- **WHEN** the config lists `codex`
- **THEN** `lets delegate handoff run --for apply` exits 2, stdout is empty, and stderr contains `codex` and the config file's path

#### Scenario: A bad entry after one that would answer
- **WHEN** the config lists `subagent`, then `/opt/r/lets-delegate-t3`
- **THEN** `lets delegate handoff run --for apply` exits 2, and no prompt is saved under `.workspace/lets-delegate/`

### Requirement: An unexpected failure inside a resolver exits 4
When a resolver fails in a way it does not report as a decline, a refusal, a failed session or a timeout, `lets delegate review run` and `lets delegate handoff run` SHALL exit 4, print nothing on stdout, and print the failure's message on stderr. Exit 4 means the outcome is unknown.

#### Scenario: A review that breaks
- **WHEN** the resolver that answers a review fails with the message `boom`
- **THEN** `lets delegate review run --for code` exits 4, stdout is empty, and stderr contains `boom`

#### Scenario: A handoff that breaks
- **WHEN** the resolver that answers a handoff fails with the message `boom`
- **THEN** `lets delegate handoff run --for apply` exits 4, stdout is empty, and stderr contains `boom`

### Requirement: A review hands its session back to the resolver that made it
After a review's session gives its final message, `lets delegate review run` SHALL ask the resolver that made the session to finish it: with ok when the tree is clean and the message is not empty, and without ok otherwise, so the session is kept for a person to read. When finishing fails, the review's outcome SHALL stand, and stderr SHALL say the session could not be finished, naming its handle.

#### Scenario: A clean review
- **WHEN** `t3` answers a review with handle `thread t-1` and a final message, and the tree is clean
- **THEN** `t3` is asked to finish `thread t-1` with ok, and no other resolver is asked

#### Scenario: An empty final message
- **WHEN** the resolver's session ends with an empty final message
- **THEN** `lets delegate review run` exits 5, stdout is empty, and the resolver is asked to finish the session without ok

#### Scenario: Finishing fails
- **WHEN** the review succeeds, and finishing `thread t-1` fails
- **THEN** `lets delegate review run` exits 0, prints the final message, and stderr says it could not finish `thread t-1`

## REMOVED Requirements

### Requirement: The chain is asked in order
**Reason**: It put the resolver `LETS_SPEC_RESOLVER` names before the chain, and spoke of paths. *The chain is asked in order, by name* replaces it.
**Migration**: List the resolver's name in the config's `resolvers`. Tests pass fake resolvers to `lets` instead of setting `LETS_SPEC_RESOLVER`.

### Requirement: A missing configured resolver stops the command
**Reason**: The config lists names, not paths, so there is no file to be missing. A path entry is now an unknown name.
**Migration**: Replace each path in `resolvers` with `t3`, `cli` or `subagent`. *An unknown resolver name stops the command* says what a leftover path does.
