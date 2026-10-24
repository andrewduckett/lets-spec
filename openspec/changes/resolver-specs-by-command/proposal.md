## Why

The `resolvers` spec states every t3 and cli rule as a program's exit code and stdout, such as "`lets-delegate-cli probe` exits 75 and prints nothing". Since #111, `lets` calls these adapters in process, so the next story can delete the programs. If it did so now, those rules and the tests behind them would go too. This change moves them first, restated where the skills meet them: the `lets delegate` commands.

## What Changes

- A new capability, `delegate-resolvers`, holds the t3 and cli rules, each scenario restated through a `lets delegate` command with that resolver's name in the config (D2, D3, D4). A decline becomes "the next name answers", or exit 2 when every name declines (D5).
- *The cli resolver declines a probe for start* merges into *The cli resolver declines every handoff* (D6). *A refusal exits 3* loses the two program-only causes of exit 4 (D7). Nothing else changes in what a rule asserts.
- `resolvers` keeps only the 7 rules about the programs and the protocol, for the deletion story (D2, D8).
- The tests follow: each case in the two `resolver.test.ts` files gets a twin that runs a `lets delegate` command with the real adapter. Two cases move to the adapter itself (D10). Then both files are deleted (D9). No new test covers what `t3.test.ts` or `cli.test.ts` already check (D11).
- No behaviour change. The adapters' code is not touched.

## Capabilities

### New Capabilities
- `delegate-resolvers`: what the t3 and cli resolvers built into `lets` do when the chain asks them: when each declines, which models it lists, and how it runs, refuses, times out and cleans up a session.

### Modified Capabilities
- `resolvers`: the 16 t3 and cli rules are removed, each pointing to `delegate-resolvers`.

## Impact

- Specs: `openspec/specs/resolvers/spec.md` and a new `openspec/specs/delegate-resolvers/spec.md`.
- Tests: `tests/lets/resolvers/t3/resolver.test.ts` and `tests/lets/resolvers/cli/resolver.test.ts` are replaced by tests that call the delegate commands. `tests/lets/delegate/fixtures/command-deps.ts` may change so that a test can pass a real adapter.
- Code: none. `lets/src/` is unchanged. The programs, their bundles and `lets delegate verify` still build and pass.
