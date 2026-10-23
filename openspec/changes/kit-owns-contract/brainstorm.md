## Story

#78 kit-owns-contract — the resolver kit is the one source of the protocol, and lets imports it.
https://github.com/sidereal-io/lets-spec/issues/78

## Decisions

Andrew handed every choice in this brainstorm to the agent ahead of time. Rows marked `User (delegated)` are the agent's recommendation, which Andrew's brief accepts as his decision.

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | Which side owns the protocol and its errors? | The resolver kit. `lets` imports `resolver-kit/protocol.ts` and `resolver-kit/errors.ts`, and the kit imports nothing from `lets`. | User: #71 Shared decisions |
| D2 | Can `lets` bundle the kit under Nix? | Yes. A spike linked the kit into `lets`, removed the `lets` copies, and built `.#lets-cli`. The output is one `libexec/lets` file with no `node_modules`, it passes `lets delegate verify` on the sh example, and a forced rebuild of the pnpm dependencies kept the same hash. So there is no third package and no `contrib/protocol/`. | Evidence: spike on this branch's base, `nix build .#lets-cli` |
| D3 | How does `lets` depend on the kit? | As a workspace devDependency, `"resolver-kit": "workspace:*"`. esbuild puts the kit's code in the bundle, so nothing needs it at run time. | User: #71 Shared decisions |
| D4 | Does any wire field change? | No. `sourceFamily`, `readOnly` and `interactive` stay. The requests and responses are the same, byte for byte. | User: #71 Shared decisions |
| D5 | What dead code goes from the shared files? | Only the copy headers and the comments about keeping two files the same. With one file, every export is used by `lets`, a resolver or a test, so nothing else is dead. | Evidence: `git grep` of each export across `lets/src`, `contrib` and `tests` |
| D6 | Where does the protocol test go? | `tests/lets/delegate/protocol.test.ts` moves to `tests/resolver-kit/protocol.test.ts` and imports from the kit. `pnpm test` and `nix flake check` already run that folder. | Evidence: `package.json` `test`, `flake.nix` checks |
| D7 | What happens to the other `lets` tests that import the copies? | `config`, `git` and `lookup` tests import the errors and `buildRequest` from the kit instead. | Evidence: `git grep` in `tests/lets/delegate` |
| D8 | Does `lets/src/sync/errors.ts` move too? | No. It is the error `lets sync` reports, not part of the resolver contract. | User (delegated): it is outside the contract, and moving it adds a dependency for no gain |
| D9 | Which docs change? | `docs/resolver-contract.md` links to the kit's `protocol.ts`. The README Layout row for `contrib/resolver-kit/` says it owns the contract and `lets` imports it. The header comment of the kit's `protocol.ts` says the same. | Evidence: `docs/resolver-contract.md:19`, `README.md:429` |
| D10 | Does any spec requirement change? | No. The behavior a user or a resolver sees stays the same. The decision goes in ADR-009, not a spec. | User (delegated): this is a refactor with no visible change |
| D11 | Does the story need a glossary edit? | No. It adds no new domain term, and the project has no glossary file. | Evidence: no `openspec/glossary.md` |

## Changes from the story

- Cut: the `contrib/protocol/` fallback. The spike (D2) showed the workspace link bundles under Nix.
- Narrowed: "nothing dead stays in the shared files" means only the copy headers and comments go (D5). Each copy's dead lines were dead because the other side used them; one file uses them all.

Confirmed by user: yes
