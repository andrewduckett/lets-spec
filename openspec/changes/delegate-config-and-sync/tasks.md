## 1. Shared contracts

- [x] 1.1 [easy] A `run` request carries an optional `reviewers` list: `buildRequest` adds it only when given, `parseRequest` accepts entries with a known `family` and a string or `null` `model`, and rejects any other entry with a message that names the field; the contrib copy of `protocol.ts` is updated to match (verify: `node --test tests/lets/delegate/protocol.test.ts tests/lets-delegate-resolver/copies.test.ts`) (✓ `node --test tests/lets/delegate/protocol.test.ts tests/lets-delegate-resolver/copies.test.ts` passed)
- [x] 1.2 [medium] `readConfig(deps)` in `lets/src/delegate/config.ts` returns `null` when `$XDG_CONFIG_HOME/lets-delegate/config.json` (or `~/.config/...` when unset) is absent, the parsed config when it is valid, and throws a `UsageError` that names the file and the bad value for a wrong `version`, an unknown family, or a bad `model` or `efforts`; `Io` gains `homedir()` (verify: `node --test tests/lets/delegate/config.test.ts`) (✓ `node --test tests/lets/delegate/config.test.ts` passed)

## 2. lets uses the config [depends-on: 1]

- [x] 2.1 [medium] The lookup asks the config's resolver after `LETS_SPEC_RESOLVER` and before `PATH`, checks that its path is executable only when it reaches it, exits 2 with the path and `lets delegate setup` when it is not, and asks a path that is also the one on `PATH` once (verify: `node --test tests/lets/delegate/lookup.test.ts`) (✓ `node --test tests/lets/delegate/lookup.test.ts` passed)
- [x] 2.2 [medium] `lets delegate review` sends the reviewers whose `efforts` are absent or include the effort, as `family` and `model` only; when the config has reviewers but none serves the effort, stderr names the file and the effort; with no config the request has no `reviewers`; `lets delegate handoff` never sends one (verify: `node --test tests/lets/delegate/review.test.ts tests/lets/delegate/handoff.test.ts`) (✓ `node --test tests/lets/delegate/review.test.ts tests/lets/delegate/handoff.test.ts` passed)

## 3. The contrib resolver walks the list [depends-on: 1]

- [x] 3.1 [medium] `pickReviewer` in `families.ts` returns the first reviewer whose family is not the source and that the adapter's `Available` can run, else the first it can run, else throws `NoFamilyError` with one line per skipped reviewer and why; `resolver.ts` uses it when the request has `reviewers`, and `pickFamily` otherwise (verify: `node --test tests/lets-delegate-resolver/resolver.test.ts`) (✓ `node --test tests/lets-delegate-resolver/resolver.test.ts` passed)
- [x] 3.2 [parallel] [medium] The T3 adapter spawns a `null` model as the manifest's `providers.<instance>.defaults.chat` when there is one and as `null` otherwise, and spawns a `gemini` model with `-<effort>` added unless it already ends in one (verify: `node --test tests/lets-delegate-resolver/t3.test.ts`) (✓ `node --test tests/lets-delegate-resolver/t3.test.ts` passed)
- [x] 3.3 [parallel] [easy] The herdr adapter passes no `--model` for a `null` model, and `--model <model>-<effort>` for a `gemini` model without an effort suffix (verify: `node --test tests/lets-delegate-resolver/herdr.test.ts`) (✓ `node --test tests/lets-delegate-resolver/herdr.test.ts` passed)

## 4. lets delegate setup [depends-on: 1]

- [x] 4.1 [medium] `detect(deps)` in `lets/src/delegate/setup.ts` reports the harness as `t3` when the pid in T3's `server-runtime.json` is alive and an ancestor, `herdr` when `HERDR_ENV` is `1` and `herdr` is on `PATH`, else `none`, plus whether `t3`, `herdr`, `codex`, `claude` and `agy` are on `PATH`; `Io` gains `pid`, `parentPid(pid)` (from `/proc/<pid>/status` where it exists, else `ps -o ppid= -p <pid>`) and `processAlive(pid)` (verify: `node --test tests/lets/delegate/setup.test.ts`) (✓ `node --test tests/lets/delegate/setup.test.ts` passed)
- [x] 4.2 [medium] `detect` lists `gpt` models as the `slug` of each `codex debug models` entry with `visibility` `list`, and `gemini` models from `agy models` lines that start with `gemini-`, with the effort suffix removed and duplicates dropped; a list command that fails or does not parse leaves the family available with `models` `[]` and an `error` that holds its stderr (verify: `node --test tests/lets/delegate/setup.test.ts`) (✓ `node --test tests/lets/delegate/setup.test.ts` passed)
- [x] 4.3 [medium] `propose(findings, flags)` returns a config with one reviewer per available family in the order `gpt`, `claude`, `gemini`, each with the first listed model or `null`, and the resolver as the `lets-delegate-resolver` on `PATH` when `t3` or `herdr` is on `PATH`, else `null`; `--order`, `--model` and `--resolver` change it, and an unknown or unavailable family throws a `UsageError` that names it (verify: `node --test tests/lets/delegate/setup.test.ts`) (✓ `node --test tests/lets/delegate/setup.test.ts` passed)
- [x] 4.4 [medium] `lets delegate setup` prints the findings, the current config and the proposal as text under `Current` and `Proposed` headings, or as one JSON object with `harness`, `families`, `current` and `proposed` under `--json`; it writes the file only with `--write` and then prints its path; a bad flag exits 2 (verify: `node --test tests/lets/delegate/cli.test.ts tests/lets/delegate/setup.test.ts`) (✓ `node --test tests/lets/delegate/cli.test.ts tests/lets/delegate/setup.test.ts` passed)

## 5. Integration [depends-on: 2, 3, 4]

- [ ] 5.1 [easy] The conformance check sends `reviewers` in its `run` request and accepts a resolver that ignores it; the README's *Delegate* section and `DELEGATE_HELP` say to run `lets delegate setup`, and the contrib README's *How lets finds a resolver* and *The request* document the config's place in the order and the `reviewers` field (verify: `pnpm test`)

## Deviations Ledger

<!-- Dated notes on small departures from the plan, written during apply. Stop and ask the user about a large one. -->

- 2026-10-20, task 3.1: `pickReviewer` also takes a `whyNot(family)` function, and `Adapter` gains an optional `whyNot`. `Available` alone cannot say why a family is missing, and the spec needs herdr to say `codex is not on PATH`. Adapters without it say `<harness> cannot run <family>`.
