## Context

- `lets/src/delegate/config.ts` owns the config: `configPath` builds `<base>/lets-delegate/config.yaml`, `readConfig` reads it and also refuses a leftover `config.json`, `parseConfig` checks `version` `2` and a top-level `resolvers`, and `guidanceFor` walks `delegations.<intent>.guidance`.
- Three commands read the config through `readConfig`: `review.ts`, `handoff.ts` and `instructions.ts`. `lookup.ts` turns `config?.resolvers` into the chain, with `['subagent']` when there is no config.
- `lets/src/resolvers/t3/t3.ts` repeats the folder rule in its own `tokenPath`, with a comment that points at `configPath`. The two rules can drift apart.
- `lets/src/io.ts` and `lets/src/resolvers/kit/io.ts` are separate `Io` types. Both have `env` and `homedir()`.
- Strategies and their intents are already fixed in `lets/src/delegate/strategies.ts`: `review` takes `plan` and `code`, and `handoff` takes `apply`.
- The tests write config text inline, nearly always as `version: 2\nresolvers: [...]\n`, and two fixtures hold the old path: `CONFIG` in `tests/lets/delegate/fixtures/command-deps.ts` and `HOME_CONFIG` in `config.test.ts`.

## Goals / Non-Goals

**Goals:**

- One rule for the `lets` config folder, used by both the config and the T3 token.
- A parsed config that keeps the file's shape, so a later section sits beside `delegate` without reshaping what is there.
- Errors that name the full key path the user wrote, such as `delegate.review.code.guidance`.

**Non-Goals:**

- A general settings framework. This change adds no reader for any key outside `delegate`.
- Reading, detecting or migrating anything under `lets-delegate/` (D4, D5).
- Renaming the scratch folder or the T3 session label (D14).

## Test Seams

- **Primary test seam:** the delegate command tests in `tests/lets/delegate/`, which drive `review`, `handoff` and `instructions` through `commandDeps` with config text and a fake `io`. They prove the path, the shape, the chain and the guidance from outside the parser.
- **Existing seams reused:** `tests/lets/delegate/config.test.ts` for the parser's errors, `tests/lets/delegate/cli.test.ts` for the real binary reading a real file under `XDG_CONFIG_HOME`, and `tests/lets/resolvers/t3/t3.test.ts` for the token path.

## Scrutiny Tier & Blast Radius

- **Tier:** medium
- **Blast radius:** the `lets delegate` config contract (path, version and shape), the T3 token's location, the help text, the README, `docs/resolvers.md` and three skills. No other command reads the file. The change is wide but mechanical: the logic that changes is in `config.ts` and one line of `lookup.ts`.

## Decisions

### One function names the config folder

Add `lets/src/config-dir.ts` with `configDir(env, homedir)`. It returns `$XDG_CONFIG_HOME/lets` when the variable is set and not empty, and `~/.config/lets` otherwise. `configPath` joins `config.yaml` to it, and `t3`'s `tokenPath` joins `t3-token`. It takes plain values, not an `Io`, so both `Io` types can call it.

- *Alternative:* keep the two copies and fix both. That keeps the drift risk the current comment admits to. The new folder exists to be shared, so it gets one owner.
- *Alternative:* have `t3.ts` import `configPath` from `delegate/config.ts`. That makes a resolver depend on the delegate command's module. A small module at `lets/src/` sits below both.

### The parsed config keeps the file's shape

`Config` becomes `{ version: 3; delegate: { resolvers?: ResolverName[]; review?: unknown; handoff?: unknown } }`. `parseConfig` always fills `delegate`, with `{}` when the key is missing. A `delegate` or `delegate.resolvers` that is YAML null counts as missing, as a null already does for guidance. `review` and `handoff` stay as the user wrote them, unchecked, as `delegations` is today, so a bad guidance never stops `run`. Other keys are dropped.

- *Alternative:* flatten to an internal shape such as `{ resolvers, guidance }`. That saves a level in `lookup.ts`, but the code then no longer matches the file, and every error message has to rebuild the path. Keeping the shape means the key in an error is the key in the code.

### The chain reads `delegate.resolvers`

`chain` in `lookup.ts` becomes `config?.delegate.resolvers ?? ['subagent']`. A file with no chain gets the default, as no file does (D8). An empty list stays an empty chain, so every resolver declines and the command exits 2, as today.

### Guidance is looked up by strategy and intent

`guidanceFor(config, strategy, intent, path)` walks `delegate.<strategy>.<intent>.guidance`. It checks only the levels on that path. A level that is present and is not a mapping, or a `guidance` that is not a string, throws a `UsageError` naming the dotted path up to the bad level. `instructions.ts` passes the strategy it already has. The skills, the help text and the README name the three paths in full.

### The version goes to 3, and a version 2 file fails on the version

The version check runs before any shape check, so a file copied from the old folder fails with `version must be 3, got 2`, not with a missing-key message. No other mention of version 2 remains.

### `readConfig` reads one file

The `config.json` branch is deleted. `readConfig` returns `parseConfig(text, path)` or `null`, and nothing else in `lets` looks at the `lets-delegate` folder.

### Tests change their text, not their structure

Each inline `version: 2\nresolvers: [x]\n` becomes `version: 3\ndelegate: { resolvers: [x] }\n`, a one-line edit that keeps every test readable on its own. Block-form lists are re-indented under `delegate:`. The `CONFIG` and `HOME_CONFIG` fixtures move to `.../lets/config.yaml`. Tests of the `config.json` refusal are deleted with the requirement.

## Risks / Trade-offs

- [The user's own file stops being read the moment they upgrade, and nothing says so (D4)] → Agreed with the user, who will ask for their file to be migrated once the change is done. A `lets delegate` command with a missing config still works, falling back to `subagent`.
- [A test that still writes the old shape could pass by accident, since a file with no `delegate` key is valid and means the default] → Commands that expect `t3` or `cli` to answer would then get `subagent` and fail their assertions. A final search for `version: 2`, `resolvers:` at the top level, `delegations` and `lets-delegate/config` across `lets/` and `tests/` catches what is left.
- [The `lets` a machine runs may not include this change yet: this repository pins a published release in `mise.toml`] → The skills only describe the guidance path. They take the guidance from `lets delegate ... instructions`, so the `lets` that runs decides which file is read. The user migrates their file when they move to a `lets` that includes this change. The skills' copies in `.agents/skills/` update at the same release.
- [A stored T3 token is left behind under `lets-delegate/`] → `t3` issues a new one the first time it needs it. The old folder can be deleted by hand.

## Migration & Rollback

No code migration (D4, D6). The user moves `~/.config/lets-delegate/config.yaml` to `~/.config/lets/config.yaml`, sets `version: 3`, moves `resolvers` under `delegate:`, and splits `delegations` into `delegate.review` and `delegate.handoff`. They can delete `~/.config/lets-delegate/` afterwards. Rollback is reverting the change's commits, after which the old file is read again.
