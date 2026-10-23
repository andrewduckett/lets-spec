## Story

#82 readme-front-door — a new user installs and runs the first story from the README alone. https://github.com/sidereal-io/lets-spec/issues/82

## Decisions

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | Are the blockers #76, #77 and #25 done? | Yes. Each is built and archived lower in this stack, so this branch starts from their work, not from the line numbers in the issue. | User (delegated) |
| D2 | What is in scope? | The outline in #70 D1, as the issue's Scope lists it. The README is restructured. `docs/monorepo.md` is new. The other named files change only to match. | Evidence: #82 |
| D3 | How long is the README? | About 400 lines, down from 856. | Evidence: #82 |
| D4 | How does it get to about 400 lines? | Where the README repeats a skill, `--help` or a page in `docs/`, it keeps one sentence and a link. No new `docs/` page other than `docs/monorepo.md`. | User (delegated) |
| D5 | What line does Quick start show as success? | `lets-spec: wrote <n> files. Commit them.`, which the first `lets sync` prints. Then the `git add` and `git commit` commands. | Evidence: `lets/src/sync/skills.ts:100` |
| D6 | Does the "Choose a flow and a skills mode" step stay? | No. The Nix and mise snippets say `standard` and `committed` are the defaults, and link to where the other choices are explained. | Evidence: #82, #70 D5 |
| D7 | Where does the rest of "Specs in a monorepo" go? | A three-sentence note in "Set it up" links to `docs/monorepo.md`, written for the user. The sentences meant for the agent go to `skills/lets-write-specs/SKILL.md`, only where "Choose the capability paths" does not already say them. | Evidence: #82, `skills/lets-write-specs/SKILL.md:74` |
| D8 | What replaces "Shared domain language"? | A 12-line "Your project's vocabulary" that links to `docs/domain-language.md`. #76 already rewrote that page for the user, so it does not change. | Evidence: `docs/domain-language.md` |
| D9 | Do "strategy" and "intent" stay in the README? | No. The README says what `review` and `handoff` do, and that `--for` names what the session is for. The formal names stay in `--help` and ADR-007. | Evidence: #70 D4 |
| D10 | What replaces the "rungs"? | A two-row table, "First choice" and "Fallback". | Evidence: #70 D4 |
| D11 | Do the terms the README defines (resolver, harness, family, chain, packet, decline, refuse) go in `openspec/glossary.md`? | No. The README defines them for its readers. The project has no glossary file, and this change adds none. | User (delegated) |
| D12 | Does `tests/skill-interfaces.bats` still need `delegations.<intent>.guidance` and `--for` in the README? | Yes. The config section keeps both. The tests change only where the new prose breaks them. | Evidence: `tests/skill-interfaces.bats:166` |
| D13 | Which wording does a declined handoff use in the contrib READMEs? | The cli README's: "the next resolver in your config answers". The t3 README changes to match. | Evidence: #70 D6 |
| D14 | Does this change any behavior? | No. It changes only documentation, one skill's prose, and the tests that check the prose. No spec requirement changes. | Evidence: `openspec/specs/` |

## Changes from the story

- Cut: the "add the `lets sync` command table and the owns-these-paths rule to The working rules" part of the #70 outline. #77 moved that reference to `docs/lets-sync.md`. The README keeps one link to it, so the text is not in two places.
- Cut: rewriting `docs/domain-language.md`. #76 already rewrote it for the user. See D8.

Confirmed by user: yes
