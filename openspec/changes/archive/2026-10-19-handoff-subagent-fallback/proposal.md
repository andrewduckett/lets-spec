## Why

When no resolver is installed, the built-in default for `lets delegate` makes choices that belong to the user's setup. It picks a model family and runs that family's CLI headless for a review. For a handoff it names a CLI to paste. Choosing a resolver is moving to the install command in #40 (D2). The default only has to work on any machine, with no family choice: a subagent for a review, and a prompt the user carries on by hand for a handoff (D3–D5, D7).

## What Changes

- **BREAKING** The default resolver no longer runs a review. `lets delegate review` exits 3 when the default answers, and the review skills take their existing subagent step (D3, D5).
- **BREAKING** The default resolver no longer runs `codex exec`, `claude -p` or `agy` headless. That runner leaves the default. Whether it returns as a resolver is for #40 (D6).
- The default's handoff gives back the prompt text and the file it is saved in, and says to start any agent in the repository with it. It names no CLI and looks none up (D7).
- `lets-build` keeps "build in a fresh session, or stop here?" as the one question before a handoff. It shows the default's instruction and stops, as it does today (D4, D8).
- The README's *lets delegate* sections describe the new default (D9).

## Capabilities

### New Capabilities
- `delegate-default`: what `lets delegate` does when the built-in default resolver answers: no review session, and a manual handoff with the prompt.

### Modified Capabilities

## Impact

- `lets/src/delegate/default-resolver.ts`: `run` answers "no session" with exit 3, `start` writes new instructions, and the headless command builder goes.
- `lets/src/delegate/families.ts`: `HEADLESS_EXECUTOR`, `familiesFromExecutors` and `pickFamily` lose their only caller in `lets`. The copies in `contrib/lets-delegate-resolver/` stay, because herdr uses them.
- Tests: `tests/lets/delegate/default-resolver.test.ts`, `families.test.ts`, `review.test.ts`, `handoff.test.ts`, `cli.test.ts`, and the `fixtures/default-resolver` fixtures.
- Skills: `skills/lets-review-code/SKILL.md` and `skills/lets-review-plan/SKILL.md` say when exit 3 happens. `skills/lets-build/SKILL.md` describes the handoff instructions.
- `README.md`: *lets delegate*, *What a review gets*, and the default's paragraph.
- Users with no resolver installed get same-family subagent reviews, marked `independent: no`, until #40 gives them a way to pick another family.
- #35 targets the runner this change removes, and needs re-scoping (see brainstorm, *Changes from the story*).
