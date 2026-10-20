## Story

#39 handoff-subagent-fallback — a handoff that starts no session builds in a subagent
https://github.com/andrewduckett/lets-spec/issues/39

## Decisions

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | Should the skill keep a fallback of its own when a handoff starts no session? | No. Every delegated session goes through a resolver, and the skill does what the resolver's answer says. | User |
| D2 | Who chooses the resolver a machine uses? | The install command from #40. This story covers only the built-in default, which answers when no resolver is installed or configured. | User |
| D3 | What does the built-in default do for a review? | It runs nothing. `lets delegate review` exits 3, and the review skills take the subagent step they already have. | User; Evidence: `skills/lets-review-code/SKILL.md`, `skills/lets-review-plan/SKILL.md` (exit 3 → subagent) |
| D4 | What does the built-in default do for a handoff? | It starts nothing and gives back the prompt, so the user can carry on by hand. `lets-build` shows it and stops, as it does today. | User; Evidence: `skills/lets-build/SKILL.md`, the handoff step |
| D5 | Does the default still pick a model family? | No. The default's subagent and manual handoff ignore the family rule, because they cannot choose one. A subagent review records `independent: no`. | User |
| D6 | What happens to the headless family CLI runner (`codex exec`, `claude -p`, `agy`) in the default? | It leaves the default resolver in this story. Whether it comes back as a resolver, in #40 or in a story of its own, is decided when #40 is shaped. | User |
| D7 | What does the manual handoff give the user? | The prompt text and the file it is saved in, with an instruction to start any agent in the repository with it. It names and looks up no CLI. | User |
| D8 | Does "fresh session or stop?" in `lets-build` stay? | Yes. It is still the one question before a handoff. | User |
| D9 | Do the README's delegate sections change? | Yes. They describe the default as running a family CLI headless, and printing a command to run. | Evidence: `README.md`, *lets delegate* |

## Changes from the story

- **Outcome flipped.** The story asked for the build to run in a subagent when a handoff starts no session. Instead the default handoff stays manual, and the subagent becomes the default for reviews (D1–D4). The issue's title and body no longer match. They need updating through `lets-shape`, and the change keeps the name `handoff-subagent-fallback`, which the branch already uses.
- **Cut:** the default's headless family CLI runner (D6). Its successor goes to #40, or to a new story filed when #40 is shaped.
- **Affects #35:** the gemini fix targets the headless runner that this story removes from the default. #35 needs re-scoping onto that runner's successor, or closing.
- **Out, unchanged:** how a user installs or configures a resolver (#40); `LETS_SPEC_RESOLVER` and the `PATH` lookup.

Confirmed by user: yes
