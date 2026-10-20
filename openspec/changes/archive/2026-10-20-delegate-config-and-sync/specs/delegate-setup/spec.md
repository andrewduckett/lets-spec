## Purpose

Says what `lets delegate setup` finds out about the machine, the config it proposes from that, and how the user writes that config.

## ADDED Requirements

### Requirement: Setup detects the harness
`lets delegate setup` SHALL report the harness it runs in: `t3` when a running T3 server is one of its parent processes, `herdr` when `HERDR_ENV` is `1` and `herdr` is on `PATH`, and `none` otherwise. It SHALL also report whether `t3` and `herdr` are on `PATH`.

#### Scenario: Run from a T3 thread
- **WHEN** setup runs in a process whose parent chain includes the pid in T3's `server-runtime.json`
- **THEN** its output names the harness `t3`

#### Scenario: Run from a plain terminal
- **WHEN** setup runs with no T3 server among its parents and `HERDR_ENV` unset, and `t3` is on `PATH`
- **THEN** its output names the harness `none`, and says `t3` is on `PATH`

### Requirement: Setup detects the family CLIs
Setup SHALL report, for each family, whether its CLI is on `PATH`: `codex` for `gpt`, `claude` for `claude`, and `agy` for `gemini`.

#### Scenario: Two CLIs on PATH
- **WHEN** `codex` and `claude` are on `PATH` and `agy` is not
- **THEN** the output reports `gpt` and `claude` as available, and `gemini` as not available

### Requirement: Setup lists the models each account can run
For `gpt`, setup SHALL list the models that `codex debug models` reports as listed for the account. For `gemini`, it SHALL list the `gemini-` models that `agy models` reports. For `claude`, it SHALL report the CLI's default with no list. When a list command fails, setup SHALL report the family as available with only the CLI's default, and SHALL show why the list failed.

#### Scenario: Codex lists models for the account
- **WHEN** `codex debug models` reports `gpt-6-luna` and `gpt-5.6-terra` as listed, and `gpt-reserve` as hidden
- **THEN** setup lists `gpt-6-luna` and `gpt-5.6-terra` for `gpt`, in that order, and not `gpt-reserve`

#### Scenario: The list command fails
- **WHEN** `codex` is on `PATH`, `codex debug models` exits non-zero with `not logged in` on stderr, and setup runs with `--json`
- **THEN** `families.gpt` has `available` `true`, `models` `[]`, and an `error` that contains `not logged in`, and `proposed.reviewers` has a `gpt` entry with `model` `null`

### Requirement: Setup starts no session
Setup SHALL start no agent session, and SHALL run nothing but the model list commands and the lookups on `PATH`.

#### Scenario: All CLIs present
- **WHEN** setup runs with `codex`, `claude` and `agy` on `PATH`
- **THEN** it runs `codex debug models` and `agy models`, and no other command of those CLIs

### Requirement: Setup proposes a config
Setup SHALL propose a config with one reviewer for each available family, in the order `gpt`, `claude`, `gemini`, and no effort limits. Each reviewer's model SHALL be the first model the account lists for that family, or `null` when the family has no list. A `gemini` model SHALL be named without its effort suffix. The proposed resolver SHALL be the path of `lets-delegate-resolver` on `PATH` when `t3` or `herdr` is on `PATH` and that resolver is found, and `null` otherwise.

#### Scenario: Three families in T3
- **WHEN** setup runs with `t3` and `lets-delegate-resolver` on `PATH`, codex lists `gpt-6-luna` first, `claude` is on `PATH`, and agy lists `gemini-3.8-flash-high` first
- **THEN** the proposal names that resolver's path, and its reviewers are `gpt` with `gpt-6-luna`, `claude` with `null`, and `gemini` with `gemini-3.8-flash`, in that order

#### Scenario: No harness tool installed
- **WHEN** neither `t3` nor `herdr` is on `PATH`
- **THEN** the proposed resolver is `null`

### Requirement: Setup writes only with --write
Without `--write`, setup SHALL change no file. With `--write`, it SHALL write the proposed config to the config file, replacing any file that is there, and print the file's path.

#### Scenario: A plain run
- **WHEN** setup runs without `--write` and no config file exists
- **THEN** no config file exists afterwards, and the command exits 0

#### Scenario: Writing the config
- **WHEN** setup runs with `--write` and `XDG_CONFIG_HOME` unset
- **THEN** `~/.config/lets-delegate/config.json` holds the proposed config, and the output names that path

#### Scenario: XDG_CONFIG_HOME is set
- **WHEN** setup runs with `--write` and `XDG_CONFIG_HOME=/tmp/cfg`
- **THEN** the config is written to `/tmp/cfg/lets-delegate/config.json`

### Requirement: Flags change the proposal
Setup SHALL accept `--order <families>`, a comma-separated list that sets the reviewers' order and drops each family it leaves out, `--model <family>=<model>`, which sets one family's model, and `--resolver <path|none>`, which sets the resolver. It SHALL exit 2 when a flag names an unknown family, or a family that is not available.

#### Scenario: Reorder and pick a model
- **WHEN** setup runs with `--order gemini,gpt --model gpt=gpt-5.6-terra --write`, and all three families are available
- **THEN** the config's reviewers are `gemini`, then `gpt` with `gpt-5.6-terra`, and no `claude`

#### Scenario: An unknown family
- **WHEN** setup runs with `--model mistral=large`
- **THEN** it exits 2, names `mistral`, and writes no file

### Requirement: Setup shows the current config beside the proposal
When a config file exists, setup SHALL show it alongside the proposal. When the file cannot be read as a config, setup SHALL say so and still show the proposal.

#### Scenario: Running setup again
- **WHEN** a config file exists and setup runs with `--json` and without `--write`
- **THEN** `current` equals the file's config, `proposed` holds the proposal, and the file is unchanged

#### Scenario: Running setup again in plain text
- **WHEN** a config file names the resolver `/a/resolver`, setup would propose `/b/resolver`, and setup runs without `--json`
- **THEN** stdout contains `/a/resolver` under a heading `Current` and `/b/resolver` under a heading `Proposed`

### Requirement: Setup prints JSON on request
With `--json`, setup SHALL print one JSON object that holds `harness`, `families`, `current` and `proposed`, and nothing else on stdout.

#### Scenario: An agent reads the findings
- **WHEN** setup runs with `--json`
- **THEN** stdout parses as one JSON object with the keys `harness`, `families`, `current` and `proposed`
