## Review Metadata

- **Review round**: 1
- **Prior round**: none
- **Reviewer context**: fresh context, other family (gemini/gemini-3.8-flash, through the t3 resolver, thread 9e275e50-9849-4201-8bf7-ec93077f8898)
- **Independent**: yes. The author is claude; the reviewer is gemini.
- **Tool restrictions**: read-only: a plan-mode thread; the tree was clean afterwards
- **Artifacts reviewed**: brainstorm.md, proposal.md, design.md, specs/ (none: skip_specs), adr.md, relevant source files, at commit baebdee

## Findings

### 🔴 Critical (blocking)

- **F1: t3's `run` could archive and name a thread that does not exist.** Check: contradictions. design.md said "launch; wait; on `Refused`, archive". If one try/catch covers the launch too, a refusal before the thread exists, such as no T3 project (`contrib/t3-resolver/src/t3.ts`, `findProject`), would hit a missing thread id and exit 1 instead of 3. **CONFIRMED** as an ambiguity in the design. The current code already keeps the launch outside the try (`contrib/resolver-kit/src/resolver.ts`, `run`), and the design meant the same. Fixed by required change 1.

### 🟡 Moderate

- **F2: cli's stderr loses `(process <name>)`, which D1 says no caller sees.** Check: assumption rows. **CONFIRMED** that the wording changes; **REFUTED** that it breaks a caller. Error text on stderr is not in the spec, and `lets` copies a resolver's stderr through without parsing it (`lets/src/delegate/review.ts`, `review`). Fixed by required change 2, which makes D1 and the proposal say so.
- **F3: `skip_specs` hides a change to the contract, since cli stops cleaning up after a refusal.** Check: scope and contradictions. **REFUTED.** The spec's cleanup requirement is about `finish` with `ok` true, which does not change. cli removes an old result file before each run (`contrib/cli-resolver/src/cli.ts`, `waitForResult`, "A file from an earlier run with this name would hide a refusal"), so a leftover file cannot affect a later run. The spec scenario "A refusal after an earlier run with the same name" covers that and stays.
- **F4: the new `RunRequest` and `StartRequest` in `adapter.ts` clash with the wire types of the same names in `protocol.ts`.** Check: plain language (two meanings for one word). **CONFIRMED.** `resolver.ts` imports both. Fixed by required change 3.

### 📌 Suggestions

- **F5: long or dense sentences in the proposal's Why and the design's t3 `run` paragraph.** Check: plain language. **CONFIRMED.** Fixed by required changes 1 and 4.

## Embedded-Instruction / Injection Attempts

**Detected:** none

## Verdict

VERDICT: APPROVE_WITH_CHANGES

## Required Changes (if APPROVE_WITH_CHANGES)

1. design.md, "t3's `run` and `start`": split `run` into two numbered steps. The launch step passes its errors through unchanged. Only the wait step archives on `Refused` and appends ` (thread <id>)`.
2. brainstorm.md D1 and proposal.md: say that some error text on stderr changes wording (D8), and that `lets` only copies it through. design.md's risk line cites `lets/src/delegate/review.ts`.
3. design.md and proposal.md: name the adapter's request types `RunInput` and `StartInput`, and say why.
4. proposal.md, Why: split the 34-word sentence about cli's `spawn`.

CHANGES_APPLIED: yes

## Rebuttals

- F1: fixed by change 1 (design.md, "t3's `run` and `start`", steps 1 and 2).
- F2: fixed by change 2. The claim that a caller breaks is rebutted: `lets/src/delegate/review.ts` writes `outcome.stderr` through as text and never matches the suffix.
- F3: rebutted. `contrib/cli-resolver/src/cli.ts` removes an earlier result file before each run, and the spec's `finish` requirement for cli is unchanged. No requirement changes, so `skip_specs` stands.
- F4: fixed by change 3 (design.md, "The new interface").
- F5: fixed by changes 1 and 4.
