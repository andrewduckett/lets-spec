## Why

The built-in default resolver is the one resolver that runs inside `lets`. So the lookup has two kinds of candidate, and the default has its own code path in `lookup.ts` and `default-resolver.ts`. Making the default a program like the others removes that special case before the chain story changes the lookup (#48, #46).

## What Changes

- A new program, `lets-delegate-subagent`, in `contrib/subagent-resolver/`, built on the resolver kit like `lets-delegate-t3` and `lets-delegate-herdr`. It does what the in-process default does today (D4), and it never declines (D5).
- Every `lets` carries the program: the release tarball, the Nix `lets` package and the source tree (D1). `lets` runs it as a process from where it is installed, last in the lookup, where it asked the in-process default (D5).
- **BREAKING:** the default answers as `subagent`, not `default`, in `probe` and in the JSON line that `lets delegate handoff` prints (D2). Anything that matched on `"resolver":"default"` must match `"subagent"`.
- New: when `lets` cannot run its own `lets-delegate-subagent`, `lets delegate` exits 4. Stderr names the file and says the `lets` install is incomplete (D3).
- Removed: `lets/src/delegate/default-resolver.ts`, the `default` candidate kind in `lookup.ts`, and the conformance fixture that wraps the in-process code (D7). `pnpm conformance` checks the real program instead.
- The README, `docs/resolver-contract.md` and the contrib READMEs name `lets-delegate-subagent` where they describe the default (D9).

The config list, the lookup order and installing the program under `$XDG_DATA_HOME/lets-delegate/` stay as they are. The chain and setup stories change them (D6). ADR-001 still holds: the default starts no session (D8).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `delegate-default`: the default is the program `lets-delegate-subagent`, which every `lets` carries and runs as a process. It answers as `subagent`. A new requirement says what happens when `lets` cannot run it.
- `contrib-resolvers`: the release folder's `contrib/` also holds `lets-delegate-subagent`, and the conformance check must pass for it.

## Impact

- **Code:** a new workspace package, `contrib/subagent-resolver/`. The resolver kit in `contrib/resolver-kit/` may need to support a resolver that starts no session. `lets/src/delegate/lookup.ts` loses its `default` kind, and `lets` needs to find the program in each of the three places it runs from. `lets/src/delegate/default-resolver.ts` goes.
- **Build:** `flake.nix` builds the program, puts it in the release folder's `contrib/`, and adds it to the `lets-cli` package. The `dist` check lists it.
- **Tests:** `tests/lets/delegate/default-resolver.test.ts` and `lookup.test.ts` change. Tests for the new package join the `pnpm test` list. `package.json`'s `conformance` script checks the new program.
- **Users:** anything that reads `"resolver":"default"` from `lets delegate handoff` sees `"subagent"`. No skill in this repository reads the name.
