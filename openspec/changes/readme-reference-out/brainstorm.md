## Story

#77 readme-reference-out — the lets sync reference, upgrade notes and resolver mechanics live in docs/
https://github.com/sidereal-io/lets-spec/issues/77

## Decisions

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | What does this story move? | The `lets sync` reference, the four upgrade notes and the "Resolvers" subsection. The Quick start, monorepo notes, vocabulary and mise snippet stay for other stories. | Evidence: #77 scope, #70 D1 and D7 |
| D2 | What stays in the README where a section was? | The `⚙️ lets sync` and `🔄 Updating` headings stay. Each moved section becomes one sentence and a link. "Updating" keeps its Nix and mise steps. | User |
| D3 | Where do the Resolvers facts go? | Into "How `lets` finds a resolver" in `docs/resolver-contract.md`. Only facts the contract lacks are added, such as where the default writes a handoff prompt. | User |
| D4 | How is `docs/upgrading.md` ordered? | By release, newest first: the 0.5 notes (the default now answers as `subagent`; `lets-delegate-resolver` is gone), then `lets-sync` to `lets sync`, then linked skills. | Evidence: `git tag --contains` on the commits that wrote each note |
| D5 | What happens to the 42-line script in the contract? | Cut the code block. Keep the link to `contrib/headless-resolver` and the sentences around it. Drop the test that pins the copy to the file. | User |
| D6 | Which links must change? | The README's own links to `#committed-or-ignored-skills` point at the new page. `#resolvers` and `#set-up-delegation` stay in the README, so their links stay. | Evidence: grep for `README.md#` and `](#` |
| D7 | How do the tests follow the moved prose? | The test that checks how docs name `lets delegate review` and `handoff` reads every `docs/*.md`, not just the contract. No new tests. | User |
| D8 | When is it done? | Every fact in a moved section is on its new page, or already in the contract. No link breaks. `pnpm test` and `nix flake check` pass. | User |

## Changes from the story

- D5 takes neither option the story offered (an excerpt with a test, or the whole script). It cuts the script and its test outright. The file is linked and commented, so a copy adds nothing. This removes more text and one test.

Confirmed by user: yes
