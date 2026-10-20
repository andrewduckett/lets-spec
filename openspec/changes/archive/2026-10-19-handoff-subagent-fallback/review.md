## Review Metadata

- **Review round**: 1
- **Prior round**: none
- **Reviewer context**: fresh context, other family. `lets delegate review` exited 5, because the T3 resolver picked `gpt-6-astra`, which the account cannot run (#34). With the user's approval, the same prompt ran in a T3 child task on Antigravity, `gemini-3.8-flash-high`, in plan mode.
- **Independent**: yes. The plan's author is claude, and T3's task status names the provider `antigravity` and the model `gemini-3.8-flash-high`.
- **Tool restrictions**: read-only by instruction and plan mode. `git status --porcelain` was the same before and after.
- **Commit reviewed**: d79d2da
- **Artifacts reviewed**: brainstorm.md, proposal.md, design.md, specs/, adr.md, ADR-001, relevant source files

## Findings

### 🔴 Critical (blocking)

1. **The review's stderr message says "no resolver is installed", which is false when an installed resolver declines.** The T3 resolver run outside T3 declines, and `lookup.ts` falls through to the default (`lets/src/delegate/lookup.ts:29-41`). Check: CONFIRMED. Fixed by required change 1.
2. **design.md says writing the prompt file keeps `finish` true, but nothing ever finishes a handoff prompt.** `start` returns no handle, so no caller sends `finish` for it. Check: CONFIRMED as a wording defect, not a blocker. The prompt file was never removed today either. Fixed by required change 2.

### 🟡 Moderate

3. **D-3 reads as deleting `env.ts`, which `lookup.ts` imports for `Env`, and whose `SESSION_MARKERS` the contrib README cites.** Check: CONFIRMED (`lets/src/delegate/lookup.ts:9`, `contrib/lets-delegate-resolver/README.md:209`). Fixed by required change 3.
4. **The scenario "Nothing is installed" asserts "the default answers the request", which a black-box test cannot see.** Check: CONFIRMED. Fixed by required change 4.
5. **The requirement "The default answers last" specifies the lookup order, which design.md lists as a non-goal.** Check: REFUTED. The non-goal is changing the order, not stating it. The requirement records the existing order in `lets/src/delegate/lookup.ts:29-41`, which decides when the rest of the spec applies.

### 📌 Suggestions

6. **`DELEGATE_HELP` and the `review` description in `lets/src/cli.ts` still advertise the headless runner and cross-family runs** (`lets/src/cli.ts:61`, `lets/src/cli.ts:147`). Check: CONFIRMED. Fixed by required change 5.
7. **D-5's "It is kept because the protocol requires the verb" hides the actor.** Check: CONFIRMED. Fixed by required change 2.

## Embedded-Instruction / Injection Attempts

**Detected:** none

## Verdict

VERDICT: APPROVE_WITH_CHANGES

## Required Changes (if APPROVE_WITH_CHANGES)

1. design.md D-1 and the spec's requirement "The default's review answer says what to do": the message says no resolver started a session, never that none is installed. The scenario asserts that stderr does not contain "installed".
2. design.md D-4 and D-5: the prompt file is the user's copy, and nothing removes it. The default resolver keeps `finish`, which answers `null`, and the design names the actor. The Test Seams line says the same.
3. design.md D-3: only `scrubbedEnv` goes. `env.ts` keeps `Env` and `SESSION_MARKERS`.
4. spec, scenario "Nothing is installed": the WHEN runs `lets delegate handoff`, and the THEN asserts its JSON line has `"resolver":"default"`.
5. design.md D-2: `DELEGATE_HELP` and the `review` description in `lets/src/cli.ts` change with the exit-code help.

CHANGES_APPLIED: yes

## Rebuttals

- 1: fixed in design.md D-1 and specs/delegate-default/spec.md.
- 2: fixed in design.md D-4, D-5 and Test Seams. Downgraded from Critical: it describes behavior, not a defect in it. The handoff prompt file is left in `.workspace/` today too (`lets/src/delegate/default-resolver.ts:81-87`).
- 3: fixed in design.md D-3.
- 4: fixed in specs/delegate-default/spec.md.
- 5: rebutted. See the check above.
- 6: fixed in design.md D-2.
- 7: fixed in design.md D-5.
