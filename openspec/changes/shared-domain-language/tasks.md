## Verification approach

Implement only after a new apply request. Use the pinned development environment; every heavy command goes through `deli`.

Write meaningful regression tests first at the existing release, sync, and OpenSpec boundaries. A regression that already passes records existing compatibility; do not manufacture a failure or add tests that merely repeat instruction text.

For instruction changes, interface checks verify referenced paths, command names, and schema structure. They do not prove agent judgment. Before ticking those tasks, also record the relevant scenario walkthrough and its observed result on the task line or in Acceptance Evidence below.

## 1. Shared reference and compatibility

- [x] 1.1 [medium] Make the domain-language reference available through both published flows: add `skills/lets-shape/references/domain-language.md` with the reviewed lookup, context-pointer, scope, semantic-consistency, and lifecycle rules; prove real nested-file distribution through release and sync fixtures in committed and ignored modes, without initializing or overwriting project glossaries (✓ deli -- nix develop --command bats tests/release-build.bats tests/sync-skills.bats passed: 48 tests; new reference tests first failed on the absent file).
- [x] 1.2 [medium] Preserve project-owned glossary files across OpenSpec operations: extend `tests/openspec-compat.bats` for both schemas with unchanged capability IDs, grouped delta archive, and capability retirement leaving glossary cleanup to the author (✓ deli -- nix develop --command bats tests/openspec-compat.bats passed: 15 tests across both schemas; compatibility already supported, no runtime change).

## 2. Workflow integration [depends-on: 1]

- [x] 2.1 [medium] Make shaping use and develop agreed vocabulary: update `skills/lets-shape/SKILL.md` to read the reference, resolve shared and affected-scope definitions, ask about meaning and scope, write accepted terms immediately, and retain tentative terms in the issue; walk the ambiguity, local-scope, shared-scope, and missing-pointer scenarios (✓ 12 skill-interface tests passed; manual walkthrough: Session ambiguity pauses dependent packets, sibling Order uses common scope, local Checkout attempt stays local, stale pointer reports its path).
- [x] 2.2 [complex] Preserve shaping glossary edits between sessions: document baseline ownership, glossary-only phase checkpoints, remote publication without a PR, issue-based resume, and safe restoration in `lets-shape`; rehearse a new glossary, unrelated edits, interrupted shaping, and recovery from a second clone using a disposable local bare remote (✓ git diff --check passed; disposable bare-remote rehearsal passed new glossary, preexisting and unrelated edits, interrupted phase recovery in second clone, two published checkpoints, later-edit detection and baseline restoration).
- [ ] 2.3 [medium] Give shaped vocabulary exactly one PR owner: implement the conditional glossary handoff in `lets-shape`, including the selected story route, an assigned In Progress documentation Chore, user-confirmed blocker links, and the unresolved-prerequisite path; walk single-story, multi-story, stopped, and change-branch split cases (verify: deli -- nix develop --command bats tests/skill-interfaces.bats).
- [ ] 2.4 [complex] Make `lets-build` safely consume the recorded glossary handoff: add preclaim owner and checkpoint verification, skip unresolved next-story candidates, authorize glossary-only imports, and recover failed transfers without stranding claims or deleting existing branches; rehearse success, replay, missing checkpoints, and a conflicting target in disposable Git repositories (verify: git diff --check).
- [ ] 2.5 [medium] Make both flows load vocabulary through planning and implementation: update `lets-brainstorm`, `lets-write-specs`, and both source schemas to read the shared reference and relevant glossary inputs with the correct root field; extend interface checks to resolve every reference in its shipped flow, and walk standard/minimal consumption plus capability retirement (verify: deli -- nix develop --command bats tests/skill-interfaces.bats tests/openspec-compat.bats).
- [ ] 2.6 [medium] Give delegated reviewers the relevant definitions explicitly: update `lets-review-plan` and `lets-review-code` prompt construction guidance to include affected glossary paths and semantic checks while treating glossary text as domain data; inspect concrete plan and code review prompts for a cross-domain example and a harmless code-naming difference (verify: deli -- nix develop --command bats tests/skill-interfaces.bats).
- [ ] 2.7 [easy] Explain the vocabulary convention and glossary handoff to users: update README, relevant documentation, and the source `overlays/AGENTS.md` rules with shared-reference loading, the context-pointer example, optional nested scopes, and the narrowly scoped shaping documentation-PR exception; leave generated copies untouched (verify: git diff --check).

## 3. Acceptance [depends-on: 2]

- [ ] 3.1 [medium] Confirm the workflow meets the spec: record acceptance evidence for all 30 scenarios, including cross-checkout recovery, declined blockers, preexisting edits, and transfer cleanup; distinguish manual instruction walkthroughs from automated boundary coverage, then run the complete project test suite (verify: deli -- nix develop --command pnpm test).
- [ ] 3.2 [easy] Confirm every release flow builds and ships its references with no project-owned glossary changes (verify: deli -- nix flake check).

## Acceptance Evidence

Pending implementation. Record scenario outcomes and the disposable Git rehearsal results here; do not count planning probes as implementation verification.

## Deviations Ledger

None.
