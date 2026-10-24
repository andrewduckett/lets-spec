## Story

#113 retire-resolver-programs — the release ships one program, with no resolver programs, protocol or verify command.
https://github.com/sidereal-io/lets-spec/issues/113

## Decisions

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | Is this one story, or should it split? | One story. The packet's Scope, Kept and Won't lists stand. It is deletion, and the parts share the same flake checks and tests. | User |
| D2 | Where does the branch start? | Off `resolver-specs-by-command` (#112), whose pull request is not merged. The pull request targets that branch. | User |
| D3 | Where do the kit names that survive `protocol.ts` go? | Into `families.ts` and `adapter.ts`, so no file is named for a protocol. Design picks which name goes where. Nothing else is added. | User |
| D4 | Which `Adapter` fields go? | `program`, as the packet says, and also `harness` and `whyDeclined`: once `resolver.ts` goes, nothing reads them. `subagent.ts` loses `createAnswer`, `PROGRAM` and the shared `answers` helper. | Evidence: `git grep` finds them only in `kit/resolver.ts`, `kit/main.ts` and test fixtures |
| D5 | What happens to `SessionVerb`, which `strategies.ts` imports from `protocol.ts`? | It goes. `strategies.ts` uses `Kind` from `lookup.ts`, which has the same two values. | Evidence: `lets/src/delegate/lookup.ts` `Kind`, `strategies.ts` |
| D6 | How do the `delegate-verify` and `resolvers` capabilities retire? | A delta for each lists every requirement under REMOVED, with a Reason and a Migration, and the change's `.openspec.yaml` sets `retire_capabilities: true`, so archive deletes both specs. | Evidence: `.agents/skills/lets-write-specs/SKILL.md`, *Read and maintain domain language* |
| D7 | What about the retired names in specs that stay? | The Done-when search must find nothing, so they change. In `delegate-config` and `delegate-instructions`, the example path entries become paths with no program name, such as `/opt/r/old-resolver`. In `delegate-config`, *The chain is asked in order, by name* is replaced by *The chain is the names the config lists*, without its two scenarios about `LETS_SPEC_RESOLVER` and a program on `PATH`. OpenSpec refuses a MODIFIED requirement that drops a scenario, and neither leaves an input a test can set (plan review, finding 1). | User |
| D8 | And the program-level requirements left in `delegate-default`? | *The default never declines* is removed, and a new requirement, *The default answers wherever lets runs*, states it through `lets delegate review instructions` with no config. *The default finishes nothing* is removed: `subagent` makes no handle, so nothing reaches its `finish`. In *Every lets carries the default*, the scenario about the program beside `lets` becomes a release folder with no `resolvers/`. The Purpose line stops naming `lets-delegate-subagent`. | User |
| D9 | What replaces the `verify` command? | Nothing. `lets delegate verify` becomes an unknown command that exits 2, and `cli.test.ts` adds `verify` to its old-command list. | User |
| D10 | How do the resolver pages fold? | One `docs/resolvers.md` with a section each for `t3`, `cli` and `subagent`. It keeps *Before the first review in T3 Code* and *After a t3 update*, and drops *Check that it works* and *Develop it*. Protocol words such as `probe` become the command that does it, `instructions`. | User |
| D11 | Which README rows change? | The resolver table's links, the *Layout* row for `lets/`, *Releases*, the `pnpm test`, `pnpm verify` and `pnpm build` rows of *Testing*, and *After a T3 Code update*. There is no *Write your own* section left to delete. | Evidence: `README.md` on this branch |
| D12 | Is there a 0.6 upgrade note to add? | #111 wrote it. This story adds one sentence: the release folder has no `resolvers/`, and `lets delegate verify` is gone. | Evidence: `docs/upgrading.md` |
| D13 | Does the journey map change? | Yes. In `openspec/discovery.md`, Andrew's *Change* stage becomes supported, because this is the epic's last story. | User |
| D14 | What do the flake checks keep? | The checks that the Nix `lets` and the release folder's `lets` answer `handoff run` as `subagent` with no config. The `dist` check now asserts there is no `resolvers/`. `node-tests` drops `pnpm verify`, `jq` and `patchShebangs lets/resolvers`. | User |
| D15 | Are there decision records to write? | No. ADR-010 already supersedes ADR-003, ADR-004 and ADR-009. | Evidence: `docs/decisions/ADR-010-the-resolvers-are-built-into-lets.md` |
| D16 | Does the story touch the glossary? | No. The project has no glossary file, and no term here needs one. | Evidence: `openspec/glossary.md` is absent |
| D17 | How is it accepted? | The packet's `git grep` finds nothing outside `docs/upgrading.md`, `docs/decisions/` and `openspec/changes/archive/`. `openspec validate --strict` passes. `pnpm test` and `nix flake check` pass. No command changes its names, flags, stdout or exit codes. | User |

## Changes from the story

- Added: `harness` and `whyDeclined` leave `Adapter` with `program` (D4), and `SessionVerb` goes (D5). All are dead once the protocol goes.
- Added: `delegate-config`, `delegate-default` and `delegate-instructions` change wherever they name a retired program or `LETS_SPEC_RESOLVER` (D7, D8). The packet's Done-when search needs it.
- Added: `openspec/discovery.md` marks the *Change* stage supported (D13).
- Changed: the 0.6 upgrade note already exists, so it gains one sentence (D12).
- Cut: *Write your own* in the README, which #111 already removed (D11).

Confirmed by user: yes
