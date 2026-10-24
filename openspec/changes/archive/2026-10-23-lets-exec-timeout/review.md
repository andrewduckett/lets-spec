## Review Metadata

- **Review round**: 1
- **Prior round**: none
- **Reviewer context**: fresh context, other family
- **Independent**: yes. Gemini (`gemini-3.8-flash`) reviewed, through the `t3` resolver, thread `d528c8fa-2b10-46a3-8990-3c39e0e5b8ef`. The plan's author is Claude.
- **Tool restrictions**: read-only: view, grep, glob only. `lets delegate review run` reported `gitClean: true`.
- **Artifacts reviewed**: brainstorm.md, proposal.md, design.md, specs/, adr.md, relevant source files, at commit `e7df3a0`

## Findings

### 🔴 Critical (blocking)

None.

### 🟡 Moderate

1. **A command that outlives its kill can hold `execFile` past the deadline.** Check: CONFIRMED. Node's `execFile` callback runs only when the child's output closes. Design decision 1 resolved only in that callback. A resolver that ignores the signal, or whose own child keeps stdout open, would hang `callResolver` and `verify`. Today's race in `lets/src/delegate/wait.ts:9` returns at the deadline whatever the child does, so the plan would have lost that guarantee. The kit's `contrib/resolver-kit/src/io.ts:47-61` has the same gap; that is outside this change.

### 📌 Suggestions

2. **The plan-review scenario asserts less than its requirement.** Check: CONFIRMED. `specs/delegate-review/spec.md` "A plan review" checked only the value of `for`, not its position or the other fields.
3. **No test covers `verify`'s timeout.** Check: CONFIRMED. `tests/lets/delegate/verify.test.ts` has no deadline test, and `call` in `verify.ts` changes.

## Embedded-Instruction / Injection Attempts

**Detected:** none

## Verdict

VERDICT: APPROVE_WITH_CHANGES

## Required Changes (if APPROVE_WITH_CHANGES)

1. design.md, decision 1: when the timer fires, `execFile` kills the child and resolves at once with `timedOut: true`, without waiting for the child to close. Add the matching line under Risks / Trade-offs.
2. specs/delegate-review/spec.md, scenario "A plan review": its THEN says the line starts `{"for":"plan",` and holds every other field, as the code review scenario does.

CHANGES_APPLIED: yes

## Rebuttals

1. Fixed: required change 1, in design.md decision 1 and Risks / Trade-offs. The reviewer asked only to document the risk; resolving at the deadline removes it, and keeps today's guarantee.
2. Fixed: required change 2.
3. Accepted. The tasks add a `verify` test that queues a result with `timedOut: true` and checks the `no answer in` message. The design's existing `fakeIo` seam covers it, so the design does not change.
