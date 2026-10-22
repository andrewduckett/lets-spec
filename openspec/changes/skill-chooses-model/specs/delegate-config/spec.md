## ADDED Requirements

### Requirement: The commands are grouped by strategy
`lets delegate` SHALL have two strategies, `review` and `handoff`, and each SHALL have the commands `instructions` and `run`. `lets delegate review run` SHALL run a prompt in a fresh, read-only session and wait for its final message. `lets delegate handoff run` SHALL start a fresh, interactive session and return at once. `lets delegate review` and `lets delegate handoff` SHALL run no session themselves: given the options of a `run`, they SHALL exit 2 and ask no resolver.

#### Scenario: The old review command
- **WHEN** the user runs `lets delegate review --name x --prompt-file p.md --source-family claude --effort high --model gpt`
- **THEN** it exits 2, and no resolver is run

#### Scenario: The old handoff command
- **WHEN** the user runs `lets delegate handoff --name build-x --prompt-file p.md --model claude`
- **THEN** it exits 2, and no resolver is run

#### Scenario: The help lists both commands
- **WHEN** the user runs `lets delegate review --help`
- **THEN** the output names `instructions` and `run`

### Requirement: Every delegation names its intent
`instructions` and `run` SHALL require `--for <intent>`. Under `review`, the intent SHALL be `plan` or `code`. Under `handoff`, it SHALL be `apply`. Without `--for`, or with any other value, they SHALL exit 2, name `--for` on stderr, and ask no resolver.

#### Scenario: No intent
- **WHEN** the user runs `lets delegate handoff run --name build-x --prompt-file p.md --model claude`
- **THEN** it exits 2, stderr names `--for`, and no resolver is run

#### Scenario: An intent from the other strategy
- **WHEN** the user runs `lets delegate review instructions --for apply`
- **THEN** it exits 2, stderr names `--for`, and no resolver is run

#### Scenario: The one handoff intent
- **WHEN** the user runs `lets delegate handoff run --for apply --name build-x --prompt-file p.md --model claude`
- **THEN** the resolver receives a `start` request

### Requirement: A refused model passes to the next
`run` SHALL take `--model` one or more times, as a ranked list. It SHALL send the first model to the resolver that answers. While that resolver exits 3, `run` SHALL send the next model to the same resolver, and SHALL stop at the first answer that is not exit 3. It SHALL NOT ask a later resolver in the chain after a refusal. When every model is refused, `run` SHALL exit 3, print nothing on stdout, and name each model with its refusal on stderr.

#### Scenario: The first model is refused
- **WHEN** the user runs `lets delegate review run --for code --model gpt/gpt-6-astra --model gemini` with the other required options, and the resolver exits 3 for `gpt/gpt-6-astra` and answers for `gemini`
- **THEN** the resolver receives two `run` requests, the second with `"model":"gemini"`, and the command exits 0 with the second answer

#### Scenario: Every model is refused
- **WHEN** the resolver exits 3 for both `--model gpt/gpt-6-astra` and `--model gemini`
- **THEN** `lets delegate review run` exits 3, stdout is empty, and stderr names `gpt/gpt-6-astra` and `gemini`

#### Scenario: A failure that is not a refusal
- **WHEN** the resolver exits 5 for the first of two models
- **THEN** `lets delegate review run` exits 5, and the second model is not sent

#### Scenario: A refusal never moves down the chain
- **WHEN** the config lists `/a` then `/b`, and `/a` refuses every model of a handoff
- **THEN** `lets delegate handoff run` exits 3, and `/b` is not run

#### Scenario: The review names the model that ran
- **WHEN** the resolver refuses `gpt/gpt-6-astra`, then answers for `gemini` with no `model` in its response
- **THEN** the JSON line on stderr has `"model":"gemini"`

## MODIFIED Requirements

### Requirement: The config file
The config SHALL be one YAML document in `$XDG_CONFIG_HOME/lets-delegate/config.yaml`, or in `~/.config/lets-delegate/config.yaml` when `XDG_CONFIG_HOME` is unset. It SHALL hold `version` `2` and `resolvers`, the chain: a list of the resolvers to ask, in order. Each entry SHALL be an absolute path, or the word `subagent`, which names the default that ships beside the running `lets`. The list MAY be empty. The config MAY hold `delegations`, which only `instructions` reads. Every `lets delegate review` and `lets delegate handoff` command SHALL ignore any other key. When `version` is not the number `2`, when `resolvers` is not such a list, or when the document is not YAML, they SHALL exit 2 with a message that names the file and the bad value.

#### Scenario: A valid config
- **WHEN** the file holds `version: 2` and `resolvers:` listing `/opt/r/lets-delegate-t3` and `subagent`, and `/opt/r/lets-delegate-t3` declines
- **THEN** `lets delegate review run --for code` reads it without error, and asks that path, then the default, in that order

#### Scenario: An invalid config
- **WHEN** the file's `resolvers` holds `bin/lets-delegate-t3`
- **THEN** `lets delegate review run --for code` exits 2, and stderr names the file and `bin/lets-delegate-t3`

#### Scenario: The old version
- **WHEN** the file holds `version: 1`
- **THEN** `lets delegate review run --for code` exits 2, and stderr names the file and says the version must be `2`

#### Scenario: A key from a later lets
- **WHEN** the file holds `version: 2`, a valid `resolvers`, and a key `telemetry` that this `lets` does not know
- **THEN** `lets delegate review run --for code` reads it without error and asks the listed resolvers

#### Scenario: run ignores the guidance
- **WHEN** the file holds `delegations.code.guidance: 42`
- **THEN** `lets delegate review run --for code` reads it without error and asks the listed resolvers

### Requirement: The chain is asked in order
`lets delegate` SHALL ask resolvers in this order: the one `LETS_SPEC_RESOLVER` names when it is set, then each entry of the config's `resolvers`, in the order listed. The first that does not decline SHALL answer, and no later one is asked. Nothing found on `PATH` SHALL be asked unless the config lists it by path.

#### Scenario: The first declines
- **WHEN** the config lists `/a` then `/b`, and `/a` declines the review
- **THEN** `/b` is asked, and `lets delegate review run --for code` exits 0 with `/b`'s answer

#### Scenario: The first answers
- **WHEN** the config lists `/a` then `/b`, and `/a` answers the review
- **THEN** `lets delegate review run --for code` prints `/a`'s answer, and `/b` is not run

#### Scenario: The environment wins
- **WHEN** `LETS_SPEC_RESOLVER` names `/x`, which answers, and the config lists `/a`
- **THEN** `/x` answers, and `/a` is not run

#### Scenario: A resolver on PATH is not asked
- **WHEN** an executable named `lets-delegate-resolver` is on `PATH`, and the config does not list its path
- **THEN** it is not run

### Requirement: A chain where every resolver declines fails the command
When `LETS_SPEC_RESOLVER` is unset or declines, and every resolver the config lists declines, `lets delegate` SHALL exit 2, print nothing on stdout, and say on stderr that every resolver declined, naming the config file. The help text of `lets delegate review run` and `lets delegate handoff run` SHALL name this case under exit 2.

#### Scenario: Only a T3 resolver, run from a terminal
- **WHEN** the config lists only `/opt/r/lets-delegate-t3`, and the command runs where that resolver declines
- **THEN** `lets delegate review run --for code` exits 2, stdout is empty, and stderr names the config file and says every resolver declined

#### Scenario: An empty list
- **WHEN** the config's `resolvers` is `[]`
- **THEN** `lets delegate handoff run --for apply` exits 2, stdout is empty, and stderr names the config file and says every resolver declined

#### Scenario: The help text
- **WHEN** the user runs `lets delegate review run --help`
- **THEN** the line for exit 2 says that every resolver in the config declined

### Requirement: A leftover JSON config is refused
When `config.yaml` does not exist and `config.json` exists in the same folder, every `lets delegate review` and `lets delegate handoff` command SHALL exit 2 and say on stderr that the config is now `config.yaml`, naming both files.

#### Scenario: Yesterday's file
- **WHEN** `~/.config/lets-delegate/config.json` exists, `config.yaml` does not, and the user runs `lets delegate review run --for code`
- **THEN** the command exits 2, and stderr names `config.json` and `config.yaml`

#### Scenario: Both files
- **WHEN** both `config.json` and `config.yaml` exist
- **THEN** `lets delegate review run --for code` reads `config.yaml` and ignores `config.json`

### Requirement: A missing configured resolver stops the command
When the lookup reaches an absolute path the config lists, and that path does not exist or is not an executable file, `lets delegate` SHALL exit 2 and name the path and the config file. It SHALL ask no later resolver. A resolver earlier in the order that answers is not affected.

#### Scenario: The resolver was removed
- **WHEN** `LETS_SPEC_RESOLVER` is unset, and the config lists `/nix/store/gone/bin/lets-delegate-t3`, which does not exist
- **THEN** `lets delegate review run --for code` exits 2, and stderr contains that path and the config file's path

#### Scenario: The environment's resolver answers first
- **WHEN** `LETS_SPEC_RESOLVER` names a resolver that answers the review, and the config lists a path that does not exist
- **THEN** `lets delegate review run --for code` exits 0 with that resolver's answer, and stderr does not name the missing path

#### Scenario: An earlier listed resolver answers first
- **WHEN** the config lists a resolver that answers the review, then a path that does not exist
- **THEN** `lets delegate review run --for code` exits 0 with the first resolver's answer, and stderr does not name the missing path

### Requirement: A request from lets carries the model the user gave
`lets delegate review run` and `lets delegate handoff run` SHALL require at least one `--model <family[/model]>`, and SHALL send each value unchanged as the `model` of a `run` or `start` request. Without `--model`, they SHALL exit 2 and ask no resolver. The `run` request SHALL have no `reviewers` field, whatever the config holds.

#### Scenario: A review with a model
- **WHEN** the user runs `lets delegate review run --for code --model gpt/gpt-6-luna` with the other required options
- **THEN** the `run` request the resolver receives has `"model":"gpt/gpt-6-luna"` and no `reviewers` field

#### Scenario: A handoff with a bare family
- **WHEN** the user runs `lets delegate handoff run --for apply --name build-x --prompt-file p.md --model claude`
- **THEN** the `start` request the resolver receives has `"model":"claude"`

#### Scenario: No model
- **WHEN** the user runs `lets delegate review run --for code` without `--model`
- **THEN** it exits 2, stderr names `--model`, and no resolver is run

## REMOVED Requirements

### Requirement: A refusal stops the review with exit 3
**Reason**: `run` now takes a ranked list of models and tries the next one on a refusal, so exit 3 means every model was refused.
**Migration**: Pass every model you would retry as another `--model`, in order. "A refused model passes to the next" says how `run` tries them, and that a refusal still never moves to a later resolver.
