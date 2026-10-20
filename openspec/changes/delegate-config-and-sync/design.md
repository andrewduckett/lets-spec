## Context

- `lets` (in `lets/src/`) and the contrib resolver (in `contrib/lets-delegate-resolver/src/`) are two bundles that install separately. The resolver keeps exact copies of `protocol.ts` and `errors.ts`, and `tests/lets-delegate-resolver/copies.test.ts` fails when a copy drifts.
- `lets` reaches the outside world only through `Io` in `lets/src/io.ts`, which tests replace with a fake. `Io` has no home directory, no pid and no parent-pid lookup today. The resolver's own `Io` has all three, for its T3 detection.
- `parseRequest` checks the fields it knows and ignores the rest. A resolver built before this change accepts a `run` request that has `reviewers`.
- The choice of reviewer happens in `pickFamily` (`contrib/.../families.ts`), using the `Available` lists each adapter builds: from T3's `model-manifest.json`, or from the executors on `PATH` in herdr.
- T3's manifest has a `defaults.chat` model for `claudeAgent` and `antigravity`, and none for `codex`.

## Goals / Non-Goals

**Goals:**
- One place reads the config: `lets`. The resolver learns the reviewers only from the request.
- The change to protocol 1 is purely additive, so the contrib resolver and third-party resolvers from before this change keep working.
- Every new path can be tested with fakes: no test runs `codex`, `agy`, `t3` or `herdr`.

**Non-Goals:**
- Installing the resolver, or checking whether it is stale (#44, #33).
- Probing a model by running it. Setup trusts the account's own list.
- Editing effort limits with flags. A user who wants them edits the file. Setup proposes none.

## Test Seams

- **Primary test seam:** the command modules' `run(options, deps)` with a fake `Deps`, as in `tests/lets/delegate/review.test.ts` and `lookup.test.ts`. A new `setup.test.ts` uses the same seam, with fake `execFile` answers for `codex debug models` and `agy models`.
- **Existing seams reused:** `tests/lets-delegate-resolver/resolver.test.ts` for choosing from the reviewer list through `handle(verb, input, adapters)` with fake adapters. `t3.test.ts` and `herdr.test.ts` cover how each adapter turns a reviewer into a model selection or into argv. `copies.test.ts` keeps `protocol.ts` in step. `cli.test.ts` covers the new command's flags and exit 2.

## Scrutiny Tier & Blast Radius

- **Tier:** high. The change adds a field to the resolver contract, a user-level file that a later story extends, and touches both bundles.
- **Blast radius:** `lets delegate review` and `handoff`, which now read the config, and the resolver lookup. The contrib resolver's choice of family and model in T3 and herdr. A new file under the user's config directory. No project files change.

## Decisions

1. **Setup is a pure function over findings.** `lets/src/delegate/setup.ts` gathers findings (harness, CLIs, model lists) through `Io`, then a pure `propose(findings, flags)` builds the config. Printing and `--write` sit on top. This puts the rules of the spec in one function a test can drive without fakes. Rejected: building the proposal while detecting, which ties every rule to a fake process.
2. **`lets` detects the harness itself.** `Io` gains `homedir()`, `pid`, `parentPid(pid)` and `processAlive(pid)`, and setup ports the resolver's T3 check: the runtime file's pid is alive and is an ancestor. It does not call the resolver's `probe`. Setup must work before any resolver is installed, which is the main case for #44. The cost is a few lines that mirror `t3.ts`. They are not a copy under `copies.test.ts`, because the two bundles' `Io` types differ.
3. **Model lists come from each CLI's own list command.** For `gpt`, take the `slug` of each entry in `codex debug models` whose `visibility` is `list`, in the order given. For `gemini`, take the first column of each `agy models` line that starts with `gemini-`, then remove a trailing `-low`, `-medium` or `-high` and drop duplicates. Each list command gets 30 seconds. Rejected: reading T3's manifest, which caused #34. Rejected: probing with a prompt, which spends tokens.
4. **The config resolver is recorded as found on `PATH`, not resolved.** Setup writes the path from `PATH` as it is, such as `~/.nix-profile/bin/lets-delegate-resolver`, not its Nix store target. A profile update then moves the resolver without another setup run.
5. **The config has a `version`.** `lets` reads `version` `1` and exits 2 on any other value. A later story that extends the file (#33, model choice) can bump it. The reader lives in `lets/src/delegate/config.ts`, and both `lookup.ts` and `review.ts` use it. It returns `null` when the file is absent, and throws a `UsageError` that names the file when the file is invalid.
6. **The lookup takes the config's resolver as a second `external` candidate.** `candidates()` gains a `config` argument. An entry from the config that is not executable throws the same `UsageError` as `LETS_SPEC_RESOLVER`, with a message that says to run `lets delegate setup`. When the config's resolver is the same path as the one on `PATH`, it is asked once.
7. **`reviewers` is filtered in `lets` and walked in the resolver.** `buildRequest('run', …)` takes an optional `reviewers` list and adds it to the request only when it is given. `review.ts` filters it by effort and keeps `family` and `model`, without `efforts`. `parseRequest` checks the field when it is present: an array of objects with a known `family` and a string or `null` `model`.
8. **The resolver chooses with `pickReviewer`.** It sits beside `pickFamily` in `families.ts`. It takes `sourceFamily`, the reviewers and the adapter's `Available`, and returns the reviewer, or throws `NoFamilyError` with one line per skipped reviewer. A reviewer is runnable when `Available[family]` is not empty; its model need not appear in that list, because the account's list is the authority. `resolver.ts` calls `pickReviewer` when the request has `reviewers`, and `pickFamily` otherwise.
9. **`null` and gemini's effort are each adapter's job.** In T3, a `null` model becomes the manifest's `providers.<instance>.defaults.chat` when there is one. When there is none, the adapter sends `null` and T3 uses its own default. In herdr, `null` passes no `--model`, as it does today. For `gemini`, the adapter adds `-<effort>` to a model name, unless the name already ends in an effort suffix.

## Risks / Trade-offs

- [Risk] `codex debug models` and `agy models` are debugging commands, and their output can change. → Setup parses them defensively. A parse failure counts as a failed list: the family keeps its CLI default, and the output says why.
- [Risk] T3 may reject a `run` with a `null` codex model. → Setup proposes a named codex model whenever the account lists one, so this happens only when the list failed. The T3 smoke test in the resolver README covers it, and the case falls to #34.
- [Risk] A reviewer's model runs under the CLI but not under T3's provider of the same family. → The resolver reports the session's error, as today (exit 5), and leaves the thread for a person to read. Setup's output says the lists come from the CLIs.
- [Trade-off] The config holds absolute paths and model ids, so it goes stale when either moves. → A missing resolver fails loudly (exit 2), and running setup again rewrites the whole file.

## Migration & Rollback

No config file means the behaviour of today. No migration is needed. To roll back, delete `~/.config/lets-delegate/config.json`. A resolver from before this change ignores `reviewers`, and `lets` from before this change never sends it.
