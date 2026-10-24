## Context

`lets delegate` finds a resolver in `lets/src/delegate/lookup.ts`. It builds a list of candidates (the `LETS_SPEC_RESOLVER` program, then the config's paths, with `subagent` standing for `resolvers/lets-delegate-subagent` run with `lets`'s own Node), runs each as a child process with a JSON request on stdin, and maps the program's exit code and stdout back to an `Outcome`. The commands (`review.ts`, `handoff.ts`, `instructions.ts`) build protocol requests with `buildRequest` and read `Outcome`s.

The adapters already exist in the same package. `lets/src/resolvers/kit/adapter.ts` defines `Adapter` (`detect`, `options`, `run`, `start?`, `finish`). `t3.ts` and `cli.ts` each export `createAdapter(io)`, which builds closures and does no I/O until a method is called. `kit/resolver.ts` (`adapterAnswer`) turns protocol verbs into adapter calls inside each program. `subagent.ts` has no adapter, only `createAnswer`, on the verb layer.

Two `Io` types exist: `lets/src/io.ts` for the commands and `lets/src/resolvers/kit/io.ts` for the adapters. The adapters keep theirs.

The programs, their bundles and `lets delegate verify` stay in this change and must keep working (D10). `verify.ts` has its own process plumbing and does not use the lookup.

## Goals / Non-Goals

**Goals:**

- The chain calls adapters directly, with the rules in D6, and nothing else changes for the skills.
- The commands stop building and parsing protocol messages. They pass the adapters' own input types.
- Tests reach every chain rule through the commands, with fake adapters in `Deps`.

**Non-Goals:**

- Shrinking the kit or deleting `protocol.ts`, `verbs.ts`, `resolver.ts` or `main.ts`. The programs still use them; the deletion story removes them.
- Changing `t3.ts` or `cli.ts` beyond what the wider `start` return type allows. Neither needs an edit.
- Better decline messages. "Every resolver declined" stays as it is.

## Test Seams

- **Primary test seam:** the command functions `review.run`, `handoff.run` and `instructions.run`, called with `Deps` from `tests/lets/delegate/fixtures/command-deps.ts`. The fixture gains fake adapters by name: each says whether it detects, what it lists, and what `run`, `start` and `finish` do (answer, throw `Refused`, throw another known error, throw a plain `Error`), and records each call with its input. Every scenario in the delta specs that needs a resolver to behave a certain way is tested here.
- **Existing seams reused:** `tests/lets/delegate/config.test.ts` for `parseConfig`; `tests/lets/delegate/cli.test.ts` for what needs the real program: help texts, the no-config `subagent` answer, and an unknown name exiting 2. Its tests that drove `fixtures/fake-resolver` through `LETS_SPEC_RESOLVER` move to the primary seam. `tests/lets/resolvers/subagent/subagent.test.ts` gains tests for `createAdapter`. The flake checks that run `handoff run` with no config stay as they are and must still pass. `verify.test.ts` keeps the fake program.

## Scrutiny Tier & Blast Radius

- **Tier:** high. It removes the process boundary between `lets` and its resolvers, changes the meaning of a config entry for every user, and moves error handling that was enforced by a separate process into `lets`.
- **Blast radius:** the `lets` package's `delegate/` folder, `io.ts` and `main.ts`; `resolvers/kit/adapter.ts` and `resolvers/subagent/`; the delegate tests; the user's delegate config; the README, `docs/resolvers/`, `docs/upgrading.md`, four decision records and one skill line.

## Decisions

### 1. `Deps.resolvers` holds the three adapters by name

`Deps` gains `resolvers: Record<ResolverName, Adapter>`, where `ResolverName` is `'t3' | 'cli' | 'subagent'`, from a `RESOLVER_NAMES` list in `config.ts`. `realDeps()` builds all three with one kit `realIo()`. `createAdapter` does no I/O, so building them for `lets sync` costs nothing. `Deps.nodePath` goes.

Alternatives: a lookup function `adapterFor(name)` (one more indirection, same effect); building only the listed adapters (needs the config before `Deps` exist). A plain record is the smallest thing tests can replace. This is the seam #110 names; there is no registry.

### 2. The config checks names when it is read

`parseConfig` accepts an entry only when it is in `RESOLVER_NAMES`. Otherwise it throws a `UsageError`: `<file>: resolvers[<i>] must be t3, cli or subagent, got "<entry>".` A path is not special-cased. `Config.resolvers` becomes `ResolverName[]`. `SUBAGENT_ENTRY` goes; the default chain is `['subagent']`.

### 3. The chain is three small functions over exceptions, not `Outcome`s

`lookup.ts` keeps its role and loses the process call. It has:

- `chain(deps)`: the adapters the config names, in order, or `[subagent]` with no config.
- `pick(kind, deps)`: the first adapter that does not decline `kind`, `'run'` or `'start'`. An adapter declines when `detect()` is false, or when `kind` is `'start'` and it has no `start`. When all decline, a `UsageError` names the config file, as today.
- `withModels(adapter, models, call)`: calls `call(model)` for each model in turn while it throws `Refused`, collecting `<model>: <reason>` lines. When every model is refused it throws one `Refused` whose message is those lines.

Every adapter call goes through one wrapper, `inAdapter(fn)`, which rethrows any error that `exitCodeOf` does not know as a `SpawnError` with the same message. So a known error keeps its exit code, an unknown one exits 4 (D6), and `guarded` prints both as it does now. An error thrown by `lets`'s own code, outside the wrapper, still propagates.

Alternatives: keep `Outcome` and `{ code, response, stderr }` (it exists only to carry a child process's result); catch every error in the commands (would hide `lets`'s own bugs). Exceptions are what the adapters and `guarded` already speak.

`BACKSTOP_MINUTES`, `OTHER_VERB_TIMEOUT_MS`, `timeoutFor`, `DEFAULT_RESOLVER`, `callResolver`, `candidates` and the "install is incomplete" and "declined after it answered" messages go. A decline can no longer come after an answer: the adapter is picked once.

### 4. The commands pass adapter inputs, not protocol requests

Each command checks every `--model` with `parseModel` before it reads the config's adapters, and throws a `UsageError` naming the bad value (D8). Then:

- `review.ts` calls `adapter.run({ name, prompt, cwd, family, model, effort }, { timeoutMs })`, with `timeoutMs` from `--timeout` or `DEFAULT_TIMEOUT_MINUTES[effort]`. It reports `resolver: adapter.name`, the family it asked for, and `model ?? <the --model value>`, exactly as the JSON line does now. Its empty-message check, tree check and exit 7 stay as they are. It finishes with `adapter.finish(handle, ok, { cwd })` on the same adapter; any error from `finish` becomes the existing "could not finish" warning.
- `handoff.ts` calls `adapter.start({ name, prompt, cwd, family, model })` and prints `{ resolver, handle }`, or `{ resolver, handle: null, instructions }` when `start` returned instructions. Its exit mapping (3 stays 3, any other failure is 4) stays.
- `instructions.ts` calls `adapter.options(warn)` on the adapter `pick` chose for the strategy's kind. `STRATEGIES[...].verb` still says which kind. `warn` writes `lets delegate: <message>` to stderr. The programs' warnings were lost before, because `lets` printed a resolver's stderr only on failure; stderr text may change (#110).

`normalizeName`, `parseModel`, `DEFAULT_TIMEOUT_MINUTES` and the types stay imported from `kit/protocol.ts` until the deletion story moves what survives. `lookup.ts` no longer imports `parseResponse`, `exitFor` or `DECLINE`.

### 5. `start` may return instructions in place of a handle

`Adapter.start` returns `Promise<Handle | { instructions: string }>`. `t3.ts` still returns a `Handle` and needs no change. `subagent.ts` gains `createAdapter(io)`: `name` `subagent`, `detect` always true, `options` `[]`, `run` throws the same `Refused` message as today, `start` saves the prompt under `.workspace/lets-delegate/` and returns the same instructions text, and `finish` does nothing. The prompt-writing and the texts are shared with `createAnswer`, which stays for the program.

### 6. The words

`DELEGATE_HELP` describes names, not paths and `LETS_SPEC_RESOLVER`. The exit-4 lines say "the outcome is unknown". The README's *Install a resolver* becomes a table of the three names, what each needs (T3 Code running; a family CLI on `PATH`; nothing), and nothing to install. The new decision record supersedes ADR-003, ADR-004 and ADR-009, and ADR-005 is amended (D14).

## Risks / Trade-offs

- [The t3 adapter now runs inside `lets`'s process, not a child of it, so `detect()` sees a different `pid`.] → `isAncestor` walks up from the process's own `pid`, so it is true when T3 is `lets`'s ancestor, which it is whenever it was the program's. The t3 adapter's tests already cover the walk.
- [A hung adapter call now hangs `lets`, with no backstop.] → Each adapter already enforces its own deadline (`pollUntil` in t3, the `execFile` timeout in cli). This is the decision in #110's Won't list.
- [An adapter's unknown error used to be contained by a process; now a thrown non-`Error` value could slip past `inAdapter`.] → `inAdapter` turns any thrown value it does not know into a `SpawnError` with `String(value)` as the message.
- [Users with path entries get exit 2 after upgrading.] → The message names the three names, and the 0.6 note in `docs/upgrading.md` says what to write.
- [Moving end-to-end tests from `cli.test.ts` to the command seam could lose a check of the real program's wiring.] → `cli.test.ts` keeps the no-config `subagent` answer and the unknown-name exit 2, which pass through `realDeps()`, and the flake checks run the packaged `lets`.

## Migration & Rollback

Users replace each path in `resolvers` with its name, then remove the `lets-delegate-*` links and packages they installed. `docs/upgrading.md` gets that as the one 0.6 note. Nothing else in the config changes, and the version stays `2`.

Rollback is a revert of the change's commits. A config that lists names is invalid for an older `lets`, so a user who rolls back must restore the paths.
