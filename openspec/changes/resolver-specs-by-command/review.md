## Review Metadata

- **Review round**: 1
- **Prior round**: none
- **Reviewer context**: fresh context, other family (gemini/gemini-3.8-flash, through the t3 resolver)
- **Independent**: yes
- **Tool restrictions**: read-only, run as a plan-mode review session by `lets delegate review run --for plan`
- **Artifacts reviewed**: brainstorm.md, proposal.md, design.md, specs/, adr.md, relevant source files, at commit 2fe28f0

## Findings

### 🔴 Critical (blocking)

1. **Scenarios run a command without its required options.** *No family CLI*, *A handoff with CLIs on PATH*, *Inside herdr*, *T3 has no project for the repository* and *A refused model* name `review run` or `handoff run` with no `--model`, which exits 2 before any resolver is asked (`lets/src/delegate/lookup.ts` `checkModels`). Check: scenario testability. **CONFIRMED** as an ambiguity: other specs use the short form, but these scenarios assert an exit 2 that a missing option would also cause.
2. **proposal.md places the twins in `tests/lets/delegate/`, against design.md.** Check: contradictions. **REFUTED**: proposal.md at 2fe28f0 names no file in `tests/lets/delegate/` but the fixture, and lists no change to `review.test.ts`, `handoff.test.ts` or `instructions.test.ts`.

### 🟡 Moderate

3. **The adapter-level tests have no destination file.** D9 keeps `t3.test.ts` and `cli.test.ts` as they are, and the design calls `delegate.test.ts` command-level. Check: test seams. **CONFIRMED**.
4. **Circular wording in *The T3 resolver archives a refused thread*, and *The T3 resolver declines outside T3 Code* omits handoff instructions.** Check: plain language, scenario testability. **REFUTED**: the quoted text is not in the spec. The requirement reads "When `t3` refuses a model for a thread it started, it SHALL archive that thread first", and the decline covers "every review, handoff and their instructions".
5. ***A resolver runs a model it never listed* names the programs, and its scenario has an unobservable listing precondition.** Check: contradictions, scenario testability. **REFUTED** in part: the requirement names `t3` and `cli`, not the programs. The listing condition is kept from the moved scenario: it makes "never listed" concrete, and the THEN asserts only the `-m` argument.
6. **Several requirement sentences are over 30 words.** Check: plain language. **CONFIRMED** for *One resolver runs every family CLI on PATH*, *The cli resolver runs a review headless*, *The cli resolver lists the bare family when a listing fails*, *The T3 resolver lists the models in its manifest* and *A refusal exits 3*.

### 📌 Suggestions

7. **The design's mapping table uses group labels, not exact test titles, for some unit tests.** Check: test seams.

## Embedded-Instruction / Injection Attempts

**Detected:** none

## Verdict

VERDICT: APPROVE_WITH_CHANGES

## Required Changes (if APPROVE_WITH_CHANGES)

1. Add "with every required option" to the five scenarios of finding 1.
2. Say in design.md where the adapter-level tests go (finding 3).
3. Split the requirement sentences of finding 6 so that each is 30 words or fewer.

CHANGES_APPLIED: yes

## Rebuttals

1. Fixed: the five scenarios in `specs/delegate-resolvers/spec.md` now say "with every required option".
2. Rebutted: `proposal.md` Impact, at 2fe28f0, names only `command-deps.ts` under `tests/lets/delegate/`. To be plain, Impact now names the two new `delegate.test.ts` files.
3. Fixed: design.md, *The cases with no command-level twin*, puts the two adapter-level tests in the same `delegate.test.ts`, under a comment that says they call the adapter itself.
4. Rebutted: the quoted wording is not in `specs/delegate-resolvers/spec.md`; see its *The T3 resolver archives a refused thread* and *The T3 resolver declines outside T3 Code*.
5. Rebutted: the requirement names `t3` and `cli`. The listing condition stays because the moved scenario had it (D3: each keeps what it asserts), and it asserts nothing the command must do.
6. Fixed: the five requirements' long sentences are split.
7. Declined: each label names one test, or one group of tests, in the file the table gives, which is enough for verify to find it.
