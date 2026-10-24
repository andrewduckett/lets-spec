## Context

Since #111, `lets` calls the `t3`, `cli` and `subagent` adapters in process through the `Adapter` type, and since #112 every adapter rule is specified and tested through `lets delegate`. What is left of the old design is a layer nobody calls:

- Each program's `main.ts` calls `runResolver` or `runProgram` in `kit/main.ts`. That runs `respond` in `kit/verbs.ts`, which parses a request with `parseRequest` from `kit/protocol.ts` and calls `adapterAnswer` in `kit/resolver.ts`.
- `lets delegate verify` (`lets/src/delegate/verify.ts`) builds requests and parses responses with the same `protocol.ts`.
- `lets/resolvers/` holds a dev entry per program and the `sh` example. `lets/build.mjs` bundles each program, `lets/package.json` lists each as a bin, and `flake.nix` packages, copies and checks them.

`lets delegate` itself uses only a few names from `protocol.ts`: `FAMILIES`, `EFFORTS`, `Family`, `Effort`, `Handle`, `parseModel`, `normalizeName`, `DEFAULT_TIMEOUT_MINUTES` and `SessionVerb`. The adapters also use `ModelString`.

## Goals / Non-Goals

**Goals:**

- Delete the protocol layer and everything that only served it, with no change to what any `lets delegate` command prints or exits with.
- Leave the kit as the code the adapters and `lets delegate` share, with no file named for a protocol.

**Non-Goals:**

- Renaming the kit folder or the adapters, or moving code between `kit/` and `delegate/` beyond `protocol.ts`'s survivors.
- Any change to an adapter's behaviour, or to the config's location (#89).

## Test Seams

- **Primary test seam:** the `lets delegate` command tests in `tests/lets/delegate/`, which drive each command through `commandDeps` with fake adapters and the real `subagent`. They prove no command changed.
- **Existing seams reused:** `tests/lets/delegate/cli.test.ts`, which runs the real `lets` as a process, for `verify` becoming an unknown command; `tests/release-build.bats` and the flake's `dist` and `commands` checks for the packaging; `tests/skill-interfaces.bats` for the docs. The type check proves every surviving import resolves.

## Scrutiny Tier & Blast Radius

- **Tier:** medium
- **Blast radius:** the `lets` package (`src/resolvers/`, `src/delegate/`, `src/main.ts`, the bundle script and bins), the flake's packages and checks, the root scripts, and the docs. It touches several packages, but only deletes: no new contract, schema or trust boundary.

## Decisions

### D1. Where the surviving names go

`families.ts` takes the names about models: `FAMILIES`, `EFFORTS`, `Family`, `Effort`, `Model`, `parseModel` and `DEFAULT_TIMEOUT_MINUTES`. It already holds the family commands and the effort suffix, and it imports nothing after the move. `adapter.ts` takes the names about sessions: `Handle`, `ModelString` and `normalizeName`, which shapes the `name` every `RunInput` carries. `adapter.ts` imports `Family` and `Effort` from `families.ts`, so there is no cycle.

Alternative: a new `kit/types.ts`. Rejected: the packet allows no new file, and the two existing homes fit.

### D2. `SessionVerb` becomes `Kind`

`strategies.ts` types its `verb` with `Kind` from `lookup.ts`, which is the same `'run' | 'start'`. Its comment stops calling it a protocol verb. `SessionVerb` and `SESSION_VERBS` go.

### D3. Dead adapter fields go with the protocol

`Adapter` loses `program`, `harness` and `whyDeclined`. Once `resolver.ts` goes, nothing reads them: `pick` in `lookup.ts` declines silently. Each adapter drops the lines that set them. In `subagent.ts`, `createAnswer`, `PROGRAM` and the shared `answers` helper go, and `createAdapter` holds its two answers directly.

### D4. Errors keep their classes, less one

`ContractError` goes from `errors.ts` and `exitCodeOf`. The comments on `UsageError` and `SpawnError` stop naming requests, programs and the contract. Every exit code keeps its meaning.

### D5. `verify` becomes an unknown command

`main.ts` drops the `verify` command, its import and `VERIFY_HELP`. Commander then rejects `lets delegate verify` with exit 2, as it does each old command. `cli.test.ts` adds `verify` to the list in *every old command is rejected by name*.

### D6. The flake keeps one program

The `program` helper stays and builds only `lets`. `lets-cli` no longer copies a default beside itself. `dist` has no `resolvers/`, and its check asserts that. The checks that run each program, the copy alone and the copy without the default go, and the check that the tarball's `lets` answers `handoff run` as `subagent` stays. `node-tests` drops `pnpm verify`, `jq` and `patchShebangs lets/resolvers`. `tests` still holds fixtures that run as programs, so `patchShebangs tests` stays. The lockfile does not change, so `pnpmDeps` keeps its hash.

### D7. The resolver pages fold into one

`docs/resolvers.md` opens with the table from the README, then has one section per resolver: what it does in its harness, which models it lists (as `instructions` shows them, not `probe`), and for `t3`, *Before the first review in T3 Code* and *After a t3 update*. The README's resolver table and *After a T3 Code update* link to its sections.

### D8. The spec Purposes are edited directly

OpenSpec deltas cannot change a Purpose, so `delegate-default`'s Purpose is edited in `openspec/specs/`, as `resolver-chain-config` did. The two retired capabilities go at archive through `retire_capabilities: true`.

## Risks / Trade-offs

- [A test fixture still imports a deleted file] → The type check and the Node tests fail at once. Each task runs both.
- [A doc or test still names a retired program] → The packet's `git grep` is a task's verification, and `tests/skill-interfaces.bats` checks the docs.
- [A mise user's link into the old release folder's `resolvers/` dangles after updating] → The 0.6 upgrade note already says to delete it; this change adds that the folder is gone.
- [Archive does not retire the two specs] → A rehearsed archive in a disposable copy checks it before the real one.

## Migration & Rollback

N/A for data. Users follow the 0.6 upgrade note, which #111 wrote. To undo, revert the branch's commits: nothing outside the repository changes shape.
