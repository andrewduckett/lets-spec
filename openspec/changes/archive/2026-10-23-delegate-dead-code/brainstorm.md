**Why:** The delegation refactors left code with no callers, comments that name deleted files, and a contract link to a list `lets` no longer uses, so readers follow dead ends and two copies can drift. The blocker, #72, has merged, so the `lets` copy of the `ps` fallback can now go.

## Story

#80 delegate-dead-code — nothing in lets or the kit is left over from the delegation refactors. https://github.com/sidereal-io/lets-spec/issues/80

## Decisions

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | What is in scope? | The five rows of #80 (C2, C3, C9, C10, C15), one commit each, as #70 describes them. | Evidence: #80, #70 |
| D2 | Is #72's `ps` fallback in the kit, so `lets` can lose its copy? | Yes. `contrib/resolver-kit/src/io.ts:55` has it. | Evidence: `contrib/resolver-kit/src/io.ts` |
| D3 | C2: delete `ExecOptions.env` too? | No. Keep it. Tests pass the fake resolver's settings through it (`tests/lets/delegate/lookup.test.ts` `ioWith`, `fixtures/command-deps.ts`). Deleting it would need a second exec helper in the tests. | User (delegated) |
| D4 | C2: what happens to the tests that use the `commands` option? | Drop the option everywhere. Delete the handoff test "the same whichever CLIs are on PATH": with no `commandExists`, it compares two identical runs. Other tests keep their checks without the option. | User (delegated) |
| D5 | C9: delete the two guards, or keep one test each? | Delete both, with no new tests. Commander rejects both cases first (`cli.ts:269` `<command...>`, `cli.ts:170` `makeOptionMandatory()`). The type check still passes: `noUncheckedIndexedAccess` is off. | User (delegated) |
| D6 | C10: what does a missing default report once the pre-check goes? | The "cannot run its default resolver … install is incomplete" message, then Node's own "Cannot find module" error. The `delegate-default` spec still holds: exit 4, the path, and the word `incomplete`. | Evidence: `openspec/specs/delegate-default/spec.md` |
| D7 | C10: what happens to the tests that expect a thrown `SpawnError` for a missing default? | Delete the two lookup tests that expect it; the "default that fails" tests cover the message. The command-deps fixture answers as Node does when the default file is missing, so the review and handoff tests keep checking exit 4. | User (delegated) |
| D8 | C15: give `handle()` a production caller, or move it to a test helper? | Move it to a test helper under `tests/resolver-kit/`. That removes a production export, and adds no wiring. | User (delegated) |
| D9 | C15: move the sync `UsageError`, rename it, or both? | Move it to a new `lets/src/sync/errors.ts` and keep its name. A rename is churn the finding does not need. | User (delegated) |
| D10 | C15: where does the shared `SCRATCH` constant live in the kit? | In `contrib/resolver-kit/src/io.ts`, which both resolvers import. Not `protocol.ts`: a test keeps that file equal to its `lets` copy. | User (delegated) |
| D11 | C15: does t3 `options()` warn when the manifest is missing? | Yes, as the issue says. Stdout is unchanged; stderr names the manifest path. This changes observable behavior, so the `contrib-resolvers` spec gets a delta. | Evidence: #80, `openspec/specs/contrib-resolvers/spec.md` |
| D12 | C15: what replaces the fake `PATH` names `herdr` and `lets-delegate-resolver`? | `some-tool`. | Evidence: #70 C15 |
| D13 | Does this change touch any domain terms? | No. There is no shared glossary, and no term changes meaning. | Evidence: `openspec/glossary.md` is absent |

## Changes from the story

- Cut: deleting `ExecOptions.env` (C2). The tests use it to set up the fake resolver, so it has callers. Removing it would add test code, not remove it. See D3.

Confirmed by user: yes
