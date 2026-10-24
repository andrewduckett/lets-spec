## Why

After #104, the source keeps the resolvers in `lets/resolvers/`, but every install still ships them in `contrib/`. The checkout keeps a symlink, `lets/contrib/lets-delegate-subagent`, only to fake that release layout. The tree and the installs should say the same thing before the next release, so mise users re-link once.

## What Changes

- **BREAKING** for mise users who linked a resolver: the release folder ships the four resolvers in `resolvers/`, not `contrib/` (D3). There is no compatibility link (D4). The `0.6` upgrade note says how to re-link (D8).
- `lets` finds its default at `resolvers/lets-delegate-subagent` from its package root. In a checkout that is the dev entry itself, so `lets/contrib/` and its symlink are deleted (D2).
- The Nix `lets` package installs the default in `resolvers/` (D3). The flake packages `lets-delegate-t3` and `lets-delegate-cli`, the bin names, the protocol, the config and exit 4 for a missing default stay as they are (D5).
- The specs, tests, docs and ADR-004 name `resolvers/` (D6, D9, D10). The capability keeps its name and Purpose until #106 (D7).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `contrib-resolvers`: "The release folder ships each resolver" says the release folder's `resolvers/`.
- `delegate-default`: "The default answers when nothing else does" and "A missing or broken default fails the request" name `resolvers/lets-delegate-subagent`.

## Impact

- Code: `lets/src/delegate/lookup.ts` (`DEFAULT_RESOLVER`); `lets/contrib/` is deleted.
- Build: `flake.nix` (`workspaceSource`, `lets-cli`, `dist` and the `dist` check).
- Tests: `tests/lets/delegate/lookup.test.ts`, `fixtures/command-deps.ts`, `handoff.test.ts`, `review.test.ts`, `source-tree.test.ts`, and `tests/release-build.bats`.
- Docs: `docs/resolver-contract.md`, `docs/resolvers/{subagent,t3,cli}.md`, `README.md`, `docs/upgrading.md`, and `docs/decisions/ADR-004-default-resolver-is-a-program.md`.
- Users: mise users who linked `contrib/lets-delegate-t3` or `contrib/lets-delegate-cli` re-link from `resolvers/`. Nix profile and home-manager users need nothing.
