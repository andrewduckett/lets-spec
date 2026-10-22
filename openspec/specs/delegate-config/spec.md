# delegate-config Specification

## Purpose
Says how `lets delegate` reads the user's delegate config, which decides which resolver answers: the chain of resolvers to ask, in order. It also says how a contrib resolver treats the `reviewers` a request may carry.

## Requirements

### Requirement: The config file
The config SHALL be one JSON object in `$XDG_CONFIG_HOME/lets-delegate/config.json`, or in `~/.config/lets-delegate/config.json` when `XDG_CONFIG_HOME` is unset. It SHALL hold `version` `1`, `resolver`, an absolute path or `null`, and `reviewers`, an ordered list. Each reviewer SHALL have a `family` (`gpt`, `claude` or `gemini`), a `model`, either a string or `null` for the tool's default, and optional `efforts`, a list of `low`, `medium` and `high`.

#### Scenario: A valid config
- **WHEN** the file holds `{"version":1,"resolver":null,"reviewers":[{"family":"gpt","model":"gpt-6-luna","efforts":["high"]}]}`
- **THEN** `lets delegate review` reads it without error

#### Scenario: An invalid config
- **WHEN** the file holds a reviewer with `"family":"mistral"`
- **THEN** `lets delegate review` exits 2, and stderr names the file and `mistral`

### Requirement: The config's resolver comes before PATH
`lets delegate` SHALL ask resolvers in this order: the one `LETS_SPEC_RESOLVER` names, then the one the config names, then `lets-delegate-resolver` on `PATH`, then the built-in default. A config with no file, or with `resolver` `null`, SHALL add nothing to the order.

#### Scenario: The config names a resolver
- **WHEN** `LETS_SPEC_RESOLVER` is unset, the config names `/opt/r/resolver`, and another `lets-delegate-resolver` is on `PATH`
- **THEN** `/opt/r/resolver` is asked first

#### Scenario: The environment wins
- **WHEN** `LETS_SPEC_RESOLVER` names `/a` and the config names `/b`
- **THEN** `/a` is asked first

### Requirement: A missing configured resolver stops the command
When the lookup reaches the resolver the config names, and that resolver does not exist or cannot be run, `lets delegate` SHALL exit 2, name the path, and say to run `lets delegate setup` again. It SHALL ask no later resolver. A resolver earlier in the order that answers is not affected.

#### Scenario: The resolver was removed
- **WHEN** `LETS_SPEC_RESOLVER` is unset, and the config names `/nix/store/gone/bin/lets-delegate-resolver`, which does not exist
- **THEN** `lets delegate review` exits 2, and stderr contains that path and `lets delegate setup`

#### Scenario: The environment's resolver answers first
- **WHEN** `LETS_SPEC_RESOLVER` names a resolver that answers the review, and the config names a path that does not exist
- **THEN** `lets delegate review` exits 0 with that resolver's answer, and stderr does not name the config's path

### Requirement: A review sends the reviewers for its effort
`lets delegate review` SHALL add a `reviewers` field to the `run` request. It SHALL hold, in config order, each reviewer that has no `efforts` or whose `efforts` include the review's effort, as `family` and `model`. When the config has reviewers but none serves the effort, `lets delegate review` SHALL say so on stderr, naming the config file and the effort. When there is no config file, the request SHALL have no `reviewers` field.

#### Scenario: Effort filters the list
- **WHEN** the config's reviewers are `gpt`/`gpt-6-luna` for `high`, then `gpt`/`gpt-5.6-luna`, and the review's effort is `low`
- **THEN** the request's `reviewers` is `[{"family":"gpt","model":"gpt-5.6-luna"}]`

#### Scenario: No config
- **WHEN** no config file exists
- **THEN** the `run` request has no `reviewers` field

### Requirement: The resolver takes the first reviewer from another family
When a `run` request has `reviewers`, the contrib resolver SHALL use the first reviewer whose family is not `sourceFamily` and that its harness can run. When there is none, it SHALL use the first reviewer it can run. It SHALL answer with that reviewer's family and model.

#### Scenario: The author's family is first
- **WHEN** `sourceFamily` is `claude`, `reviewers` is `claude`/`null` then `gpt`/`gpt-6-luna`, and the harness can run both
- **THEN** the session runs `gpt-6-luna`, and the response has `"family":"gpt"`

#### Scenario: Only the author's family
- **WHEN** `sourceFamily` is `claude` and `reviewers` holds only `claude`/`null`
- **THEN** the session runs on `claude`, and `lets delegate review` reports `"independent":false`

### Requirement: The resolver runs the reviewer's model
The contrib resolver SHALL start the session with the reviewer's model, or with the harness's default for the family when the model is `null`. For `gemini`, it SHALL add the review's effort to the model, as `<model>-<effort>`.

#### Scenario: A gemini reviewer at high effort
- **WHEN** the chosen reviewer is `gemini`/`gemini-3.8-flash` and the effort is `high`
- **THEN** the session runs `gemini-3.8-flash-high`

### Requirement: No usable reviewer exits 3
When a `run` request has `reviewers` and the harness can run none of them, the contrib resolver SHALL exit 3, start no session, and name on stderr each reviewer it skipped and why.

#### Scenario: The harness lacks the family
- **WHEN** the resolver runs in herdr, `reviewers` holds only `gpt`/`gpt-6-luna`, and `codex` is not on `PATH`
- **THEN** it exits 3, and stderr names `gpt` and says `codex` is not on `PATH`

#### Scenario: An empty list
- **WHEN** the config's reviewers all have `efforts` `["high"]`, and the review's effort is `low`
- **THEN** the request's `reviewers` is `[]`, the resolver exits 3, and `lets delegate review` exits 3 with stderr that names the config file and says no reviewer serves effort `low`

### Requirement: No list keeps the resolver's own choice
When a `run` request has no `reviewers` field, the contrib resolver SHALL choose the family and model as it did before this field existed.

#### Scenario: An older lets
- **WHEN** a `run` request without `reviewers` reaches the resolver in herdr, with `codex` on `PATH` and `sourceFamily` `claude`
- **THEN** the session runs on `gpt` with codex's default model

### Requirement: A handoff ignores the reviewers
`lets delegate handoff` SHALL send no `reviewers` field, whatever the config holds.

#### Scenario: A config with reviewers
- **WHEN** the config holds reviewers and the user runs `lets delegate handoff`
- **THEN** the `start` request has no `reviewers` field
