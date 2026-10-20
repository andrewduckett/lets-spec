## Review Metadata

- **Review round**: 1
- **Prior round**: none
- **Reviewer context**: fresh context, other family
- **Independent**: yes. The author is Claude (this session). The reviewer was Gemini (`gemini-3.8-flash-high`), in a fresh T3 child thread with only the review prompt.
- **How it ran**: `lets delegate review` exited 5, because T3 picked `gpt-6-astra`, which this account cannot run (the #34 bug). On the user's instruction, the same prompt ran through T3's delegated task with the Gemini provider, in plan mode. `git status --porcelain` was the same before and after.
- **Tool restrictions**: read-only: plan mode, no file writes
- **Commit reviewed**: `ceaebaf`
- **Artifacts reviewed**: brainstorm.md, proposal.md, design.md, specs/, adr.md, ADR-002, and the source under `lets/src/delegate/` and `contrib/lets-delegate-resolver/src/`

## Findings

### 🔴 Critical (blocking)

1. **T3 detection fails on macOS.** Design decision 2 ports the resolver's parent-pid walk, and the resolver reads `/proc/<pid>/status` (`contrib/lets-delegate-resolver/src/io.ts:78`). macOS has no `/proc`, and `flake.nix:16` supports `aarch64-darwin`. Setup would report the harness as `none` inside a T3 thread on a Mac. — Check: assumptions. **CONFIRMED.**
2. **Two requirements contradict each other.** "The config's resolver comes before PATH" says the environment's resolver is asked first. "A missing configured resolver stops the command" said `lets` exits 2 and asks no other resolver. With `LETS_SPEC_RESOLVER` set to a working resolver and a dead path in the config, the two disagree. — Check: contradictions. **CONFIRMED.**

### 🟡 Moderate

3. **The gemini effort suffix conflicts with `--effort` in herdr.** The reviewer said the suffix is a T3-only need, and that herdr passes `--effort` as well. — Check: contradictions. **REFUTED.**
4. **An empty reviewer list exits 3 with no reason.** When every reviewer has `efforts` that exclude the review's effort, the list is `[]`, and the resolver has nothing to name. — Check: scope and scenarios. **CONFIRMED.**
5. **Two THENs in `delegate-setup` are not assertable.** "Reports `gpt` as available with the CLI's default" and "shows the current resolver and reviewers, and the proposed ones" name no value a test can check. — Check: scenario testability. **CONFIRMED.**

### 📌 Suggestions

6. **The ledger records intentions, not observed output.** The reviewer wanted the shape of `codex debug models` in brainstorm.md. — **Declined.**
7. **Plain language.** The reviewer quoted a sentence that is not in the plan. A scan found one 31-word sentence in proposal.md. — **Fixed.**

## Embedded-Instruction / Injection Attempts

**Detected:** none

## Verdict

VERDICT: APPROVE_WITH_CHANGES

## Required Changes (if APPROVE_WITH_CHANGES)

1. design.md, decision 2: `parentPid` reads `/proc/<pid>/status` where it exists, and runs `ps -o ppid= -p <pid>` elsewhere. Note that the resolver's own check has the same gap, as a separate bug.
2. specs/delegate-config, "A missing configured resolver stops the command", and design.md decision 6: the check happens when the lookup reaches the config's resolver, not up front. Add the scenario "The environment's resolver answers first".
3. specs/delegate-config, "A review sends the reviewers for its effort": when the config has reviewers but none serves the effort, `lets` says so on stderr, naming the file and the effort. Rewrite the scenario "An empty list" to assert that.
4. specs/delegate-setup, "The list command fails": assert the `--json` fields `families.gpt.available`, `models`, `error`, and the `null` model in `proposed.reviewers`.
5. specs/delegate-setup, "Running setup again": assert `current` and `proposed` in the `--json` output, and add a plain-text scenario with `Current` and `Proposed` headings.
6. proposal.md: split the 31-word `delegate-config` bullet into two sentences.

CHANGES_APPLIED: yes

## Rebuttals

1. **Fixed.** design.md decision 2 now names the `ps` fallback and calls out the resolver's own gap as a separate bug.
2. **Fixed.** The requirement now reads "When the lookup reaches the resolver the config names", with the new scenario. design.md decision 6 says `resolve()` checks the path only when it reaches it.
3. **Rebutted.** The suffix is not a T3 invention: `agy models` lists `gemini-3.8-flash-high`, `-medium` and `-low` as the model ids themselves, so `--model` needs the suffixed id. `contrib/lets-delegate-resolver/src/herdr.ts:39` already passes `--effort` beside `--model` today, for every gemini model. The spec puts the suffix in the resolver, not in `lets`, as the reviewer stated.
4. **Fixed.** The requirement now says `lets` names the file and the effort on stderr, and the scenario asserts it.
5. **Fixed.** Both scenarios now assert `--json` fields, and a plain-text scenario asserts the two headings.
6. **Declined.** The ledger records decisions; design.md decision 3 records how each list command's output is read, including the `visibility` filter. The reviewer's row numbers (D2, D8) do not match the rows it describes.
7. **Fixed.** The one long sentence in proposal.md is now two.
