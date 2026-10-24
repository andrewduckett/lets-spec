## Story

#111 builtin-resolver-chain — lets runs the t3, cli and subagent resolvers in process, chosen by name in the config.
https://github.com/sidereal-io/lets-spec/issues/111

## Decisions

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | Is this one story, or should it split? | One story. The packet's in and out lists stand. Code without the docs and the record would leave a README whose setup exits 2. | User |
| D2 | What may a `resolvers` entry be? | Only `t3`, `cli` or `subagent`. With no config the chain is `[subagent]`. An unknown name or a path exits 2, and the message names the config file, the entry and the three names. | User |
| D3 | Does the config version change? | No. It stays `2`. `delegations` is untouched. No automatic rewrite of a path to a name. | User |
| D4 | When is a bad entry caught? | When the config is read, before any resolver is asked. So an earlier entry that would answer no longer hides a bad later one. | User |
| D5 | Where is the seam, and how do tests reach it? | The `Adapter` type. `Deps` carries the three adapters by name, built in `realDeps()`; tests pass fakes. No registry, loader or plugin. | User |
| D6 | Which rules does the chain enforce in process? | `detect()` false declines. No `start` declines a handoff and a probe for one. A refusal tries the next model on the same adapter. An empty final message exits 5. `finish` goes to the adapter that made the handle, and a failed `finish` is a warning. An unexpected error thrown inside an adapter exits 4 with its message; any other unexpected error in `lets` propagates. | User |
| D7 | How does `subagent` answer in process? | It gains `createAdapter`: always detects, lists no models, refuses `run`, and its `start` saves the prompt and returns instructions in place of a handle. `createAnswer` stays for the program until the deletion story. | User |
| D8 | Who checks `--model` now that no program parses a request? | `lets` checks every `--model` is `<family>` or `<family>/<model>` before it asks any adapter, and exits 2 when one is not, as the program did. | Evidence: `lets/src/resolvers/kit/protocol.ts` `parseRequest`; `resolvers` spec, exit 2 on a bad `model` |
| D9 | Does `lets` keep a timer around an adapter call? | No. Each adapter enforces its own deadline; `BACKSTOP_MINUTES` and `OTHER_VERB_TIMEOUT_MS` go. | User |
| D10 | What happens to the programs, bundles and `lets delegate verify`? | They stay and still work, but `lets` no longer runs them. `verify.test.ts` may keep the fake program. The deletion story removes them. | User |
| D11 | Which specs change beyond the packet's list? | Every requirement whose text would become false: in `delegate-config`, *A chain where every resolver declines*, *A request from lets carries the model the user gave* and *A refused model passes to the next* (worded for adapters, not requests and exit codes); in `delegate-default`, *The default answers when nothing else does*; in `delegate-instructions`, *The instructions command* and *The probe names the verb it is for*; in `resolvers`, the example's scenario that lists it in the config by path. | Evidence: `openspec/specs/` searched for `LETS_SPEC_RESOLVER`, paths and own Node |
| D12 | What becomes of the two packaging requirements in `delegate-default`? | *Every lets carries the default* says the default is built into `lets`, with no file beside it; its three scenarios stay. *A missing or broken default fails the request* is removed: nothing can be missing. | User |
| D13 | Which words follow? | The help texts (exit 4 is "the outcome is unknown"), the README's *Resolver*, *Set up delegation* and *Install a resolver* (a short table of names), the install and lookup sections of `docs/resolvers/`, `skills/lets-build/SKILL.md`'s default name, and one 0.6 note in `docs/upgrading.md`. | User |
| D14 | Which decision records? | One new record, "The resolvers are built into lets", superseding ADR-003, ADR-004 and ADR-009, each header pointing at it. ADR-005 is amended in place: entries are names. | User |
| D15 | Does the story touch the glossary? | No. The project has no glossary file, and no term here needs one. | Evidence: `openspec/glossary.md` is absent |
| D16 | How is it accepted? | `pnpm test` and `nix flake check` pass, including the flake checks that expect `subagent` from `handoff run` with no config. No test but `verify.test.ts` sets `LETS_SPEC_RESOLVER` or runs `fixtures/fake-resolver`. Every command keeps its names, flags, stdout and exit codes 0 and 2–7. | User |

## Changes from the story

- Added: the spec requirements in D11, beyond the packet's list, because their text names `LETS_SPEC_RESOLVER`, a path entry or a request that no longer exists in process.
- Added: `lets` checks `--model` itself (D8). The program used to, so without it a bad model would reach an adapter.
- Changed: a bad entry is caught when the config is read (D4), so the *An earlier listed resolver answers first* scenario goes.

Confirmed by user: yes
