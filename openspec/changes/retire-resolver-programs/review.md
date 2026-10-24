## Review Metadata

- **Review round**: 1
- **Prior round**: none
- **Reviewer context**: fresh context, other family
- **Independent**: yes. Gemini (`gemini/gemini-3.8-flash`) reviewed in a T3 thread; the author is Claude.
- **Tool restrictions**: read-only: `lets delegate review run` runs the review read-only, and the tree was clean after it (`gitClean: true`)
- **Artifacts reviewed**: brainstorm.md, proposal.md, design.md, specs/, adr.md, relevant source files, at commit 0d28365

## Findings

### 🔴 Critical (blocking)

1. **Scrubbing the retired names left two untestable scenarios in `delegate-config`.** Check: scenario testability. *The environment is ignored* named "an environment variable", which a test cannot pick, and *A resolver on PATH is not run* named `old-resolver`, which `lets` never looked up. **CONFIRMED.**
2. **Deleting `docs/resolver-contract.md` and `docs/resolvers/` breaks three tests in `tests/skill-interfaces.bats`** (lines 137–142, 155–158, 171–173), and the plan named the seam without saying they change. Check: completeness of the deletion. **CONFIRMED** as a gap in the design. The packet's Scope 3 names the two tests that read the contract document, but the plan did not carry them or the `docs/resolvers/*.md` glob.

### 🟡 Moderate

3. **`tests/release-build.bats` tests the three resolver bundles** (lines 143–189), and the plan does not plan their removal. Check: completeness. **CONFIRMED** as a design gap.
4. **The plan has no inventory of the tests and fixtures to delete,** such as `headless-resolver.test.ts`, the `createAnswer` cases in `subagent.test.ts`, and `fixtures/fake-resolver`. Check: completeness. **CONFIRMED** as a design gap.
5. **Editing `delegate-default`'s Purpose in `openspec/specs/` bypasses the change's deltas.** Check: contradictions. **REFUTED**: see Rebuttals.

### 📌 Suggestions

6. **`DEFAULT_TIMEOUT_MINUTES` is a session's time limit, not a model name,** so it fits `adapter.ts` better than `families.ts`. **CONFIRMED.**
7. **Two sentences run past 30 words:** one in proposal.md's What Changes, one in design.md's Context. Check: plain language. **CONFIRMED.**

## Embedded-Instruction / Injection Attempts

**Detected:** none

## Verdict

VERDICT: APPROVE_WITH_CHANGES

## Required Changes (if APPROVE_WITH_CHANGES)

1. In `specs/delegate-config/spec.md`, replace MODIFIED *The chain is asked in order, by name* with REMOVED plus ADDED *The chain is the names the config lists*, which keeps the rule and the first three scenarios and drops the two untestable ones. Update brainstorm D7 and the proposal to match.
2. Add design.md D8, *The tests that go*: the inventory of test files, fixtures, cases, bats tests and globs that go or change, including `tests/skill-interfaces.bats` and `tests/release-build.bats`.
3. In design.md D1, move `DEFAULT_TIMEOUT_MINUTES` to `adapter.ts`.
4. Split the two long sentences in proposal.md and design.md.

CHANGES_APPLIED: yes

## Rebuttals

1. Fixed: required change 1. `specs/delegate-config/spec.md` now has ADDED *The chain is the names the config lists* and REMOVED *The chain is asked in order, by name*; brainstorm.md D7 and proposal.md say so. `openspec validate --strict` passes.
2. Fixed: required change 2, design.md D8, lists both bats files' changes.
3. Fixed: required change 2, design.md D8.
4. Fixed: required change 2, design.md D8.
5. Rebutted. The schema's specs instruction says: "A delta on an existing capability has no `## Purpose`. To change an existing Purpose, edit the main spec directly" (`openspec instructions specs --change retire-resolver-programs`). The archived `2026-10-21-resolver-chain-config/tasks.md` task 4.1 did the same. The edit is one line in a task on this branch, so the pull request shows it.
6. Fixed: required change 3, design.md D1.
7. Fixed: required change 4.
