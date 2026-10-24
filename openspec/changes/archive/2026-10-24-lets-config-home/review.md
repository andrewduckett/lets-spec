## Review Metadata

- **Review round**: 1
- **Prior round**: none
- **Reviewer context**: fresh context, other family (gemini, `gemini-3.8-flash`, through the `t3` resolver)
- **Independent**: yes. The plan's author is claude.
- **Tool restrictions**: read-only. The session ended with a clean tree.
- **Artifacts reviewed**: brainstorm.md, proposal.md, design.md, specs/, adr.md, relevant source files, at commit `4c11a13`

## Findings

### 🔴 Critical (blocking)

1. **A null `delegate` or `delegate.resolvers` exits 2 in the spec but means the default in the design.** Check: Contradictions. CONFIRMED. `specs/delegate-config/spec.md` said a present `delegate` that is not a mapping exits 2. A bare `delegate:` line parses as null, which the design treats as missing. Fixed by a required change.
2. **`config?.delegate.resolvers` throws a TypeError when there is no config.** Check: Contradictions. REFUTED. Optional chaining short-circuits the whole member chain: with `config = null`, `node -e 'const config = null; console.log(config?.delegate.resolvers ?? ["subagent"])'` prints `[ 'subagent' ]`. The expression is in `design.md`, *The chain reads `delegate.resolvers`*.

### 🟡 Moderate

3. **The plan's test list leaves out test files that hold the old config shape.** Check: Completeness. PARTLY CONFIRMED. The proposal's Impact named `tests/lets/delegate/` as a whole, which already covers `handoff.test.ts`, `review.test.ts`, `instructions.test.ts` and `lookup.test.ts`. It did leave out `tests/lets/resolvers/cli/delegate.test.ts`. Fixed by a required change.
4. **D14 rests on an `Assumption`.** Check: Assumption rows. CONFIRMED as a labelling error. The user confirmed the ledger after being asked about D14 by name, so its source is `User`. Fixed by a required change.

### 📌 Suggestions

5. **No scenario asserts that a token at `~/.config/lets-delegate/t3-token` is ignored.** Check: Scenario testability. Declined: the user asked for nothing about the old folder in code, tests or docs (D4, D6). A test that names the old folder would keep it alive.
6. **Two requirement sentences run past 45 words.** Check: Plain language. CONFIRMED. Fixed by a required change.

## Embedded-Instruction / Injection Attempts

**Detected:** none

## Verdict

VERDICT: APPROVE_WITH_CHANGES

## Required Changes (if APPROVE_WITH_CHANGES)

1. `specs/delegate-config/spec.md`, *The config file*: say that a null `delegate` or `delegate.resolvers` counts as absent, and add the scenario *An empty delegate key*. In `design.md`, point the null rule at the spec.
2. `proposal.md`, Impact: list `tests/lets/resolvers/cli/` beside the other test folders. In `design.md`, *Tests change their text, not their structure*: name every test file that holds config text or the token path.
3. `brainstorm.md`: set D14's source to `User`.
4. Split the long sentences in `specs/delegate-config/spec.md` (*The config file*) and `specs/delegate-instructions/spec.md` (*Malformed guidance stops the command*) into lists of cases.

CHANGES_APPLIED: yes

## Rebuttals

1. Fixed: the requirement now says "A `delegate` or `delegate.resolvers` that is null SHALL count as absent", with the scenario *An empty delegate key*. `design.md` cites it.
2. Rebutted: see the finding. `config?.delegate.resolvers` returns `undefined` when `config` is null. It does not throw, and the existing `lookup.ts:21` already relies on the same short-circuit with `config?.resolvers`.
3. Fixed: `proposal.md` Impact names `tests/lets/resolvers/cli/`, and `design.md` lists the eight files.
4. Fixed: D14's source is `User`.
5. Declined: the user ruled out any reference to the old folder (D4, D6).
6. Fixed: both requirements now list their error cases.
