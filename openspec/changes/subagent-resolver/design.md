## Context

- `lets/src/delegate/lookup.ts` has two candidate kinds. An `external` candidate is a command that `callResolver` runs with `io.execFile(command, [verb])`. The `default` candidate calls `createDefaultResolver(io).handle()` in process. `resolve()` asks them in order, and the default is always last.
- `lets` knows one folder about itself: `packageRoot`, the folder above the file that holds `cli.ts`. That is `dist/` in the release tarball, `$out/` in the Nix `lets-cli` package (`$out/libexec/..`), and `lets/` in the source tree. Only the tarball has a `contrib/` folder there today.
- The resolver kit, `contrib/resolver-kit/`, has one layer. `runResolver(createAdapter)` reads stdin, and `handle()` turns a verb into calls on an `Adapter`: `detect`, `availableFamilies`, `spawn`, `waitForResult` and `finish`. That layer assumes a resolver starts sessions. `start` always answers with a handle, and `run` always picks a family.
- The kit's `bundle()` writes a one-file program with a `#!/usr/bin/env node` banner. The Nix build sandbox has no `/usr/bin/env`, which is why the `dist` check runs `node ${dist}/bin/lets`.
- The command tests in `tests/lets/delegate/` build their `Deps` with `commandDeps()`. It sets `packageRoot` to `/pkg`, runs the fake resolver as a real process, and answers every other command from a queue.

## Goals / Non-Goals

**Goals:**
- One candidate kind in the lookup. The default is a command like any other, and the only thing special about it is where `lets` finds it.
- The default runs with the same Node that runs `lets`, so it needs nothing on `PATH` and no `/usr/bin/env`.
- The kit carries the protocol for a resolver that starts no session, so `lets-delegate-subagent` holds only its own answers.

**Non-Goals:**
- Changing the lookup order, the config's `resolver` field, or `lets delegate setup`. The chain and setup stories own them.
- A flake app or a `PATH` entry for `lets-delegate-subagent`. A user never runs it by hand.

## Test Seams

- **Primary test seam:** `resolve()` in `lets/src/delegate/lookup.ts`, driven with `fakeIo` and a `packageRoot`. It shows that `lets` finds its own `contrib/lets-delegate-subagent`, runs it with its own Node, and exits 4 when the file is missing.
- **Second seam:** the kit's verb layer, driven with a fake `Io`, for the subagent's own answers. This is where the tests in `tests/lets/delegate/default-resolver.test.ts` move to.
- **Existing seams reused:** `tests/lets/delegate/lookup.test.ts`, `handoff.test.ts` and `review.test.ts` with `commandDeps()`; `tests/resolver-kit/`; the `pnpm conformance` script; the bundle test in `tests/release-build.bats`; and the flake's `dist` and `commands` checks, which run a packaged `lets` end to end.

## Scrutiny Tier & Blast Radius

- **Tier:** high. The change touches four packages: `lets`, the kit, a new contrib package and the flake. It also changes a name in the protocol's output that users can see.
- **Blast radius:** every `lets delegate review` and `lets delegate handoff` that reaches the default, in all three places `lets` runs. The T3 and herdr resolvers change only if the kit's refactor changes their behaviour, and their existing tests guard against that.

## Decisions

### D1. `lets` looks for the default at `<packageRoot>/contrib/lets-delegate-subagent`

There is one path rule, the same in all three places:

| Where `lets` runs | How the file gets there |
|---|---|
| Release tarball | `flake.nix`'s `dist` copies the bundle into `$out/contrib/`, beside the T3 and herdr ones. |
| Nix `lets-cli` | Its `installPhase` installs the bundle from the new `lets-delegate-subagent` derivation into `$out/contrib/`. |
| Source tree | A committed symlink, `lets/contrib/lets-delegate-subagent`, points to `../../contrib/subagent-resolver/bin/lets-delegate-subagent`. |

Alternatives:
- Probe several paths, including `../contrib/subagent-resolver/bin/` for the source tree. This puts knowledge of the repository's layout into the shipped code, and a broken install could quietly find the wrong file.
- An environment variable that the Nix wrapper and the dev scripts set. That is one more thing to set in every wrapper, and forgetting it fails only at run time.

The symlink keeps one rule in the code, and makes the source tree look like an install.

### D2. `lets` runs the default with its own Node

The default candidate runs as `io.execFile(nodePath, [subagentPath, verb])`. `nodePath` is `process.execPath`, which reaches the lookup through `Deps`. To allow this, an `external` candidate gets optional leading `args`, and `callResolver` puts them before the verb. `conformance.ts` already runs a command with leading args.

Alternative: run the file directly, through its shebang. That needs `/usr/bin/env` and a `node` on `PATH`. The Nix sandbox has neither, and the Nix `lets-cli` wrapper does not add `node` to `PATH`.

### D3. A missing default is a `SpawnError`, thrown before the call

When `resolve()` reaches the default candidate, it checks `io.exists(subagentPath)` first. If the file is missing, it throws `SpawnError`: "lets cannot find its default resolver at <path>, so this lets install is incomplete. Reinstall lets." `exitCodeOf` maps that to exit 4. This follows the configured-resolver check, which throws a `UsageError` at the same point. A file that exists but crashes takes the normal path: `exitFor` turns any other exit into 4, with the program's stderr.

### D4. The kit gets a verb layer under the adapter layer

The kit splits in two:

- **The verb layer** reads stdin and parses the request. It calls `answer(verb, request)`, which returns a response or `null`. It prints the JSON, or nothing for `null`, and maps the kit's errors to exit codes, with `<program>: ` before each stderr line.
- **The adapter layer** is today's `handle()`. It becomes one `answer` function built on the verb layer, so `runResolver(createAdapter)` keeps its signature, and the T3 and herdr programs do not change.

`lets-delegate-subagent` uses the verb layer with its own `answer`. It ports the code in `default-resolver.ts`: `probe` answers `{"resolver":"subagent"}`; `run` throws `NoFamilyError` with today's message; `start` writes the prompt file and returns `handle` `null` with instructions; and `finish` returns `null`.

Alternative: fit the subagent to `Adapter`, with `detect()` always true and hooks for a null handle and for exit 3. That bends the adapter model, which is about harness sessions, to fit a resolver that has none. The kit's `run` would also need a special case to skip family picking.

### D5. `contrib/subagent-resolver/` is a workspace package like the others

It has `package.json` with a `bin` entry, `build.mjs` that calls `bundle()`, `bin/lets-delegate-subagent` (the dev entry, with type stripping), `src/main.ts` and `src/subagent.ts`, and a `README.md`. Its tests go in `tests/subagent-resolver/`. They join the `pnpm test` list and `tsconfig.json`'s `include`.

### D6. The command tests treat the default as an external resolver

`commandDeps()` routes `nodePath` with `/pkg/contrib/lets-delegate-subagent` to the real source program. It runs in a temporary folder that stands in for `/repo`, so the handoff tests keep checking the saved prompt file through a real process. The default's own answers are tested at the kit seam (D4). The lookup's path and failure rules are tested in `lookup.test.ts` with `fakeIo` (D1, D3).

## Risks / Trade-offs

- [`lib.fileset` in `workspaceSource` may refuse or copy the `lets/contrib/` symlink, whose target is outside `lets/`] → Leave the symlink out of `workspaceSource` with `lib.fileset.difference`. The Nix build bundles `lets` and never reads it. Check with `nix flake check`.
- [Running the default as a process adds Node start-up time to every review that falls back to a subagent] → It is about 50 ms, next to a review that runs for minutes. Accept it.
- [The kit refactor changes T3 or herdr behaviour without anyone noticing] → `tests/resolver-kit/`, `tests/t3-resolver/`, `tests/herdr-resolver/` and `pnpm conformance` run unchanged against them. Any change to their expected output is a defect.
- [A user's script matches `"resolver":"default"`] → The proposal marks this BREAKING, and the pull request's description says to match `"subagent"`, so the release notes carry it.

## Migration & Rollback

No data changes shape. A user upgrades `lets` and gets the program with it. To roll back, install the previous release. Nothing on disk depends on the new name: `.workspace/lets-delegate/` holds only prompt files, at the same path.
