## Why

Since #111 and #112, nothing runs the resolver programs or speaks their JSON protocol. Yet every change to delegation still has to keep four bundles, three flake packages, a verify command and a contract document in step. This is the last story of epic #110: delete them, so the release ships one program, `lets`.

## What Changes

- **BREAKING** The release folder has no `resolvers/`, and the flake no longer exports `lets-delegate-t3` or `lets-delegate-cli`. `lets` has run its resolvers in process since #111, so nothing that still works depends on them.
- **BREAKING** `lets delegate verify` is gone. It exits 2 as an unknown command (D9).
- The resolver programs go: `lets/resolvers/`, with three dev entries and the `sh` example, `headless-resolver`. So do each program's `main.ts`, the kit's `main.ts`, and every bundle and bin but `lets`.
- The protocol goes: `verbs.ts`, `resolver.ts`, the request and response parts of `protocol.ts`, `ContractError`, `createAnswer`, and the `Adapter` fields only the protocol read (D4, D5). The names `lets` and the adapters share move to `families.ts` and `adapter.ts` (D3), and `protocol.ts` goes.
- The tests that only checked the programs or the protocol go. The rest change only where they name a retired program (D7).
- The docs: `docs/resolver-contract.md` goes, the three resolver pages fold into `docs/resolvers.md` (D10), the README's development rows are corrected (D11), the 0.6 upgrade note gains one sentence (D12), and the journey map marks Andrew's *Change* stage supported (D13).
- `pnpm verify` goes, with its place in `pnpm test`, and the flake's checks on the programs (D14).

No command changes its names, flags, stdout or exit codes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `delegate-config`: the example path entries stop naming a resolver program, and *The chain is asked in order, by name* is replaced by *The chain is the names the config lists*, without the scenarios about `LETS_SPEC_RESOLVER` and `PATH` (D7).
- `delegate-default`: *The default never declines* and *The default finishes nothing* are removed, a new requirement, *The default answers wherever lets runs*, restates the first through `lets delegate`, and *Every lets carries the default* rewords its scenario about the program beside `lets` (D8).
- `delegate-instructions`: the example path entry stops naming a resolver program (D7).

### Removed Capabilities

- `delegate-verify` and `resolvers`. Every requirement in them is about a program, the protocol or the verify command. Their deltas remove every requirement, and archive retires both specs (D6).

## Impact

- Code: `lets/src/resolvers/kit/`, `lets/src/resolvers/{t3,cli,subagent}/`, `lets/src/delegate/` (`verify.ts` goes; `handoff.ts`, `lookup.ts`, `review.ts` and `strategies.ts` change imports), `lets/src/main.ts`, `lets/build.mjs`, `lets/package.json`, `package.json`.
- Build: `flake.nix` packages, `lets-cli`, `dist` and the `commands`, `dist` and `node-tests` checks.
- Tests: `tests/lets/delegate/`, `tests/lets/resolvers/`, `tests/release-build.bats`, `tests/skill-interfaces.bats`.
- Docs: `README.md`, `AGENTS.md`'s *Checks*, `docs/resolver-contract.md`, `docs/resolvers/`, `docs/upgrading.md`, `openspec/discovery.md`.
- Users: anyone who linked a program from the release folder's `resolvers/` gets a dangling link. The 0.6 note already tells them to delete it.
