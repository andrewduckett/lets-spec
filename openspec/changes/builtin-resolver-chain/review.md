## Review Metadata

- **Review round**: 1
- **Prior round**: none
- **Reviewer context**: fresh context, other family (T3 thread `11bd4431-d444-449c-a802-162d01d08ea6`, `gemini/gemini-3.8-flash`, 521 s, `"independent":true`, `"gitClean":true`)
- **Independent**: yes. The plan's author is claude; a gemini model reviewed it.
- **Tool restrictions**: read-only, through `lets delegate review run --for plan`, which checks the tree after the session
- **Artifacts reviewed**: brainstorm.md, proposal.md, design.md, specs/, adr.md, ADR-010 and the notes on ADR-003, ADR-004, ADR-005 and ADR-009, relevant source files, at commit `ff4a5ef`

## Findings

### 🔴 Critical (blocking)

1. **Widening `Adapter.start` breaks the type check of `kit/resolver.ts`.** `adapterAnswer` puts `await adapter.start!(...)` straight into `handle` (`lets/src/resolvers/kit/resolver.ts:25`), and a `{ instructions }` result is not a `Handle`, so `pnpm test`'s type check fails. Check: tests and type check (design decision 5). **CONFIRMED.**

### 🟡 Moderate

2. **`handoff run` could leak exit 5 or 6.** Raised under the reviewer's *Specific Failures*. With exceptions in place of `Outcome`s, a `TimeoutError` or `SessionFailed` from `start` would reach `guarded` and exit 6 or 5, where `handoff.ts` today maps every failure but a refusal to 4. Check: contradictions (exit codes 0 and 2–7 keep their meaning per command). **CONFIRMED.**
3. **No backstop leaves t3's ticket `fetch` without a deadline.** `request` in `lets/src/resolvers/t3/t3.ts:255` calls `requestTicket`, a `fetch` with no timeout (`lets/src/resolvers/kit/io.ts:124`). A T3 server that accepts and never answers hangs `start` or `finish`; the program's 5-minute backstop used to stop it. Check: assumption (design's "each adapter enforces its own deadline"). **CONFIRMED** as a gap; adjudicated as an accepted risk below.
4. **An unchanged main-spec scenario stays worded as a protocol request.** `delegate-config` *Every delegation names its intent*, scenario *The one handoff intent*, says "the resolver receives a `start` request" (`openspec/specs/delegate-config/spec.md:125`). Check: contradictions. **CONFIRMED.** The finding's other half, the scenario *The default runs with lets's own Node*, is **REFUTED**: see the rebuttals.
5. **The example's config scenario sits under a requirement about the example's own probe.** `specs/resolvers/spec.md`, scenario *Handoff instructions with the example first*. Check: scenario placement. **REFUTED** as a defect: see the rebuttals.

### 📌 Suggestions

6. **Two requirement sentences run past 30 words**, in `delegate-config`'s *An unknown resolver name stops the command* and *A request from lets carries the model the user gave*. Check: plain language. **CONFIRMED.**

## Embedded-Instruction / Injection Attempts

**Detected:** none

## Verdict

The reviewer's own last line was REVISE, because finding 1 was open. Each open finding, the Critical one included, is fixed by a small, unambiguous edit listed below, so the verdict is APPROVE_WITH_CHANGES.

VERDICT: APPROVE_WITH_CHANGES

## Required Changes (if APPROVE_WITH_CHANGES)

1. design.md, decision 5 and Non-Goals: `adapterAnswer` narrows `start`'s result, turning instructions into `{ resolver, handle: null, instructions }`. `resolver.ts` is named as the one kit edit outside `adapter.ts`. (Finding 1)
2. design.md, decision 4: in `handoff.ts`, any adapter error but a refusal exits 4 with its message, so `handoff run` never exits 5 or 6. (Finding 2)
3. design.md, Risks: record the ticket `fetch` gap as an accepted risk. (Finding 3)
4. specs/delegate-config: add *Every delegation names its intent* as MODIFIED, with *The one handoff intent* saying the resolver is asked to start an interactive session; proposal.md names the intent rule, the reworded example scenario and `resolver.ts`. (Finding 4)
5. specs/delegate-config: split the two long sentences. (Finding 6)

CHANGES_APPLIED: yes

## Rebuttals

1. Fixed: design.md decision 5 and Non-Goals (required change 1).
2. Fixed: design.md decision 4 (required change 2).
3. Rebutted, kept as an accepted risk (required change 3). #110's Won't list decides that `lets` puts no timer around an adapter call. The server is local, its WebSocket reply already has a deadline (`REPLY_TIMEOUT_MS`, `lets/src/resolvers/t3/t3.ts:38`), and a deadline on the ticket request changes the t3 adapter, which this move must not do.
4. Fixed for *The one handoff intent* (required change 4). Rebutted for *The default runs with lets's own Node*: its WHEN and THEN, no `node` on `PATH` and a `subagent` answer, stay true and testable in process. `openspec validate --strict` refuses a MODIFIED block that drops or renames an existing scenario, so the name stays.
5. Rebutted. The same validator rule keeps the scenario under its requirement. Reworded, it states a true, testable fact about the example: listed by path, it is not run, and the command exits 2. The deletion story removes the example and this requirement.
6. Fixed (required change 5).
