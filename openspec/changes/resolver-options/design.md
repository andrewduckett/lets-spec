## Context

- **One contract, two copies.** `lets/src/delegate/protocol.ts` and `errors.ts` define the contract. The kit keeps copies in `contrib/resolver-kit/src/`, and `tests/resolver-kit/copies.test.ts` fails when the copies differ. Every contract change lands in both, in the same commit.
- **Two layers in the kit.** `verbs.ts` turns one verb into stdout and an exit code. `resolver.ts` (`adapterAnswer`) maps verbs to an `Adapter`. Today the adapter reports `availableFamilies` and `whyNot`, and `resolver.ts` chooses with `pickFamily` or `pickReviewer` from `families.ts`. The subagent resolver answers through `verbs.ts` alone, with no adapter.
- **What each error means today.** `NoFamilyError` is exit 3, and `SpawnError` is exit 4. Most of the T3 adapter's setup failures throw `SpawnError`: T3 not running, no project, a token rejected twice, a refused WebSocket. So does the cli adapter when a CLI cannot start.
- **The handoff hides exit codes.** `lets delegate handoff` turns every non-zero answer into exit 4 (`handoff.ts`). `lets delegate review` passes the resolver's code through `exitFor`.
- **The verify check's time limit.** Each of its shape checks, `probe` included, has a 60-second limit (`SHAPE_TIMEOUT_MS` in `verify.ts`). The cli resolver's `probe` now runs `codex debug models` and `agy models`, and `agy` fetches its list over the network.
- **What the harnesses list.** The T3 manifest (`userdata/model-manifest.json`) keys models by provider instance: `codex`, `claudeAgent` and `antigravity`. Its `providers.<instance>.defaults.chat` holds each default, which may be null. T3 and agy list Gemini once per effort.

## Goals / Non-Goals

**Goals:**

- One place parses and checks a `family[/model]` string, and every resolver and `lets` use it.
- An adapter reports options and runs what it is given. It never chooses.
- One error class means "refused", exit 3, and the kit cleans up a refused session for every adapter.

**Non-Goals:**

- Anything that chooses or orders models in `lets` or the skills. That is #59.
- Checking a model against `options` before running it (D8).
- Caching the model lists between calls.

## Test Seams

- **Primary test seam:** the kit's `handle(verb, input, adapter)` for each resolver on `fakeIo`, as `tests/cli-resolver/resolver.test.ts` and `tests/t3-resolver/resolver.test.ts` already do. A test gives JSON in, and checks stdout, stderr, the exit code, and the commands the fake ran. This covers `probe` options, `run` and `start` with a model, a missing model, and refusals.
- **Existing seams reused:**
  - The `lets` command functions on `commandDeps` (`tests/lets/delegate/fixtures/command-deps.ts`), for `--model` on `review` and `handoff`, and handoff's exit 3.
  - `verify.test.ts`, for the `options` check and the live run's model.
  - `subagent.test.ts`.
  - `copies.test.ts`, which keeps the protocol copies the same.
  - The bats release tests, for the release copy's `probe` output.

## Scrutiny Tier & Blast Radius

- **Tier:** high. The resolver contract changes shape in a breaking way, across `lets`, the kit and three resolvers.
- **Blast radius:** `lets delegate review`, `handoff` and `verify`, and every resolver in `contrib/`. The protocol is also what third-party resolvers implement. There is no stored data.

## Decisions

### D-1: One model string type and parser in the protocol

`protocol.ts` gains `parseModel(text) → { family, model: string | null }`, plus a checker, `check.model`, used by `parseRequest` for `run` and `start` and by `parseResponse` for each entry of `probe`'s `options`. A model string is `<family>` or `<family>/<id>`, where the family is one of `FAMILIES` and the id is non-empty with no whitespace. The id is everything after the first `/`. `buildRequest` takes `model` for `run` and `start`, and `reviewers` goes from the types, the builder and the checker. `PROTOCOL` stays `1` (D3).

- *Instead:* split the string into `family` and `model` fields in the request. *Why not:* #59 hands the user's string through `--model` unchanged, and one string is what `probe` lists. One parser at the edge is enough.

### D-2: The adapter lists options and runs what it is given

`Adapter` drops `availableFamilies` and `whyNot`, and gains `options(warn): Promise<string[]>`. `probe` answers `{ resolver, options: await adapter.options(warn) }`. `run` and `start` parse `request.model`, and pass its family and id to `spawn`. A bare family passes `model: null`, which the adapter reads as "this harness's default", as it does today. `pickFamily`, `pickReviewer`, `familiesFromExecutors` and the `Available` type go from `families.ts`. `HEADLESS_EXECUTOR`, `withEffort` and `withoutEffort` stay. The subagent's `probe` answers `options: []`.

### D-3: `Refused` replaces `NoFamilyError` as exit 3

In `errors.ts`, and its copy, `NoFamilyError` becomes `Refused`, still exit 3. Each adapter throws `Refused` for any no before output (D9). `SpawnError`, exit 4, is kept for an unknown outcome or a broken contract. In T3:

| Failure | Error |
|---|---|
| T3 not running, no project, token rejected twice, ticket request failed, WebSocket refused, request rejected (`Defect`) | `Refused` |
| `git` fails in the repository | `Refused` |
| No reply to `launchThread` in time | `SpawnError` |
| `finish` with a handle of another kind | `SpawnError` |

In the cli adapter, a CLI that cannot start is `Refused`. So is a CLI that exits non-zero having printed nothing. For codex, nothing printed means stdout is empty and its last-message file is missing or empty.

- *Instead:* keep `SpawnError` for setup problems, as exit 4. *Why not:* the user chose one signal, exit 3, for "try the next option" (D9).

### D-4: The kit cleans up a refused session

In `resolver.ts`, when `waitForResult` throws `Refused`, the kit calls `adapter.finish(handle, true)`, then throws the refusal again. A failure in `finish` goes to stderr as a warning, and the exit stays 3. The T3 adapter's `finish(ok: true)` archives the thread (D10). The cli adapter's `finish(ok: true)` removes its last-message file. Neither adapter needs code of its own for this.

The T3 adapter's `waitForResult` throws `Refused` when a run is `failed` and the run has no assistant message. A run that failed after a message stays `SessionFailed`, exit 5.

### D-5: How each resolver builds its options

- **T3** (`familiesFromT3Manifest` becomes `optionsFromT3Manifest`). It walks `currentModels` in key order and keeps only the three known instances. For each instance, it puts `defaults.chat` first when the manifest lists it. It strips any effort suffix, drops duplicates, and keeps the first place each model appears. With no manifest, the list is empty.
- **cli.** It runs the listings for the CLIs on `PATH` at the same time, each with a 20-second limit, through `io.execFile`:
  - `codex debug models`: parse JSON, keep `visibility === 'list'`, and take `slug` in the order given.
  - `agy models`: take the first tab-separated field of each line that starts with `gemini-`. This skips the `Fetching…` banner. Then strip the effort and drop duplicates (D4, D6).
  - `claude` is `claude` (D13).
  - A listing that fails, times out, or cannot be parsed leaves its family out, with one warning line on stderr (D12). The order is `gpt`, `claude`, `gemini`.
- **subagent.** It answers `[]`.

Each listing gets 20 seconds, so `probe` fits inside verify's 60 seconds even when it waits for both.

### D-6: Gemini effort, and the start model in T3

`run` adds the request's effort to a `gemini` id with `withEffort`, as today. `start` has no effort, so T3's `start` with a `gemini` id adds `-medium`. With a bare family, T3's `start` uses the provider's default chat model, which already carries an effort for `gemini`. When the provider has no default, it sends a null model and lets T3 pick. `start` no longer reads the project's default model (D14), so `startSelection` and `START_MODEL` go.

### D-7: `lets` takes `--model` and passes it through

`review` and `handoff` in `lets/src/cli.ts` get `.requiredOption('--model <family[/model]>')`. The action checks the value with `parseModel`, and a bad value is a `UsageError`, exit 2, before any resolver runs. `review.ts` and `handoff.ts` put the string into the request unchanged (D15). `handoff.ts` passes the resolver's code through `exitFor`, as `review.ts` does, so a refusal is exit 3 there too. The review's stderr JSON line keeps its `model` field. The help text for `REVIEW_HELP` and `HANDOFF_HELP` names `--model` and the new meaning of exits 3 and 4.

### D-8: verify checks options and runs the first

`parseResponse('probe')` requires `options`, through D-1's checker. So the shape check fails when `options` is missing or holds a bad entry. The live part takes `options[0]` from the `probe` it already sent. When `options` is empty, the live `run` is skipped, counts as passed, and prints one line saying the resolver lists no model to run. `LIVE_REVIEWERS` goes.

### D-9: The sh example speaks the new contract

`contrib/headless-resolver` answers `probe` with `{"resolver":"headless-sh","options":["claude"]}`. In `run`, it exits 3 when the family is not `claude`, and passes `--model <id>` when there is one. It exits 2 when `model` is missing.

### D-10: Docs and records

`docs/resolver-contract.md` documents:

- `options` in the verb table and the response table;
- `model` in the request table;
- the new meanings of exit 3 and exit 4;
- that `reviewers` and the "walk reviewers" paragraph are gone.

The ADR step records the move from "the resolver chooses from a list" to "the caller chooses, and the resolver reports and runs". That record supersedes ADR-002's second decision. The `delegate-config` main spec's Purpose still mentions `reviewers`, so a task edits it directly, because a delta cannot change a Purpose.

## Risks / Trade-offs

- [`agy models` is slow or offline, and `probe` waits] → Each listing has a 20-second limit, the listings run in parallel, and a failed listing only drops its family.
- [The format of `codex debug models` is a debug command's and may change] → The parser keeps to `slug` and `visibility`. A parse failure drops the family with a warning instead of failing `probe`. A fixture test pins today's shape.
- [Exit 3 now covers setup problems such as "no T3 project", so the skill in #59 tries every option before it gives up] → stderr keeps the precise reason, and the skill falls back to a subagent in the end. That is the cost of one signal (D9).
- [A refused T3 thread can't be told apart from a slow start] → Only a run T3 marks `failed` with no assistant message counts as a refusal. A run that is still pending waits until the timeout, exit 6.
- [Reviews run by the skills on `main` fail until #59] → Accepted (D2). No release is cut until #59 merges.
- [The `options` order across T3 providers follows the manifest's key order, which T3 does not promise] → Accepted (D11). #59's skill picks with the user's guidance, not by position.

## Migration & Rollback

There is no stored data. The user's delegate config does not change. Installed resolvers from v0.4.0 speak a different contract, but no release ships this change before #59, and setup reinstalls the resolvers from the same release as `lets`. Rollback is a revert of this branch's merge.
