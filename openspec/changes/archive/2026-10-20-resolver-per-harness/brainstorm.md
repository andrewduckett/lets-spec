## Story

#47 resolver-per-harness — contrib ships lets-delegate-t3 and lets-delegate-herdr as separate programs on a shared kit
https://github.com/andrewduckett/lets-spec/issues/47

## Decisions

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | `lets` still names `lets-delegate-resolver` in lookup, setup, help text and three specs. Does this story change that? | No. `lets` and its specs stay as they are. The docs say to name the new program with `lets delegate setup --resolver <path> --write`. #49 and #44 remove the old name. | User |
| D2 | When does each resolver answer rather than decline with exit 75? | Only when the process runs inside its harness: today's `detect()`. T3 means the T3 server is an ancestor process. herdr means `HERDR_ENV=1` and `herdr` is on PATH. | User |
| D3 | Where does the resolver contract live once the combined resolver's README is gone? | `docs/resolver-contract.md`, with the sh example. The main README and `contrib/headless-resolver` link to it. | User |
| D4 | Does the old `lets-delegate-resolver` Nix package or release file stay as an alias? | No. It goes outright as a breaking change (`feat!`). The README says how to switch. | User |
| D5 | What are the programs and the kit called? | `lets-delegate-t3`, `lets-delegate-herdr`, and the kit `contrib/resolver-kit/`, a workspace package that esbuild bundles into each program. | Evidence: epic #46, Shared decisions |
| D6 | What does the release folder's `contrib/` hold? | `headless-resolver`, `lets-delegate-herdr` and `lets-delegate-t3`. | Evidence: #47 Scope |
| D7 | What does each resolver do with `finish` for a handle kind it never makes? | Exit 4, as the combined resolver does today. Conformance accepts 0 or 4. | Evidence: contrib/lets-delegate-resolver/src/resolver.ts, lets/src/delegate/conformance.ts |
| D8 | What does each resolver's `probe` answer name? | `t3` and `herdr`, as today. | Evidence: contrib/lets-delegate-resolver/src/t3.ts, herdr.ts |
| D9 | Which files does the kit keep as copies of `lets`, checked by a test? | `protocol.ts` and `errors.ts`, as today. The copies test moves to the kit. | Evidence: tests/lets-delegate-resolver/copies.test.ts |
| D10 | What does a resolver print on stderr when it declines? | Its own name and its own harness, such as `lets-delegate-t3: not inside T3 Code`. | User |
| D11 | Does `pnpm conformance` check each program? | Yes: `lets-delegate-t3`, `lets-delegate-herdr` and `headless-resolver`, each on its own. | User |

## Changes from the story

- Added: the resolver contract moves to `docs/resolver-contract.md` (D3). The packet named the README sections, but not where the contract goes.
- Added: the change is breaking, with no alias for the old name (D4).
- Clarified: "not reachable" in the Scope means "not inside its harness" (D2).

Confirmed by user: yes
