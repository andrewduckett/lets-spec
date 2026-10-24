## Story

#76 rules-block-plain — the rules block and the glossary guidance say less, in plain language.
https://github.com/sidereal-io/lets-spec/issues/76

## Decisions

The user handed the brainstorm to the agent. They asked it to take each solid recommendation, and to prefer the option that removes text. Rows marked `User` are recommendations made under that authority.

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | Does any skill's behaviour change? | No. Only the wording changes. Every step the skills take today, they still take. | Evidence: #76 Scope, epic #71 Non-goals |
| D2 | Do the rules still mention the glossary documentation pull request? | No. Cut it from both rules. `lets-shape` owns that case and already describes it. | Evidence: #70 D3, `overlays/AGENTS.md:9-12, 26-27` |
| D3 | Which Project fields do the rules name? | Kind, Priority, Size and Status, capitalised as the README does. No skill sets a "readiness" field. | Evidence: #70 D3, README "The Project fields" |
| D4 | What does the "Domain language" section of the rules say? | The five-sentence draft in finding 12 of the plain-language review. It drops the YAML example and the OpenSpec JSON field names. | User |
| D5 | Which skill sections get rewritten? | `lets-shape` "Glossary handoff", and `lets-build` "Glossary preflight" and "Import the glossary checkpoint", plus the sentences elsewhere in `lets-build` that point at them. Each becomes numbered steps, one actor per step. Other glossary sections stay as they are. | Evidence: #76 Scope, #70 finding 16 |
| D6 | How much of the domain-language reference changes? | Only the paragraph that repeats the shaping handoff. The rest is agent-facing and clear enough; it keeps its field names. | User |
| D7 | What does `docs/domain-language.md` cover? | About 40 lines for the project owner: where the glossary lives, how to point at an existing one, what agents do with a term, and what happens when shaping adds one. The agent procedure and the checkout example go. | Evidence: #70 finding 11 |
| D8 | Does the change need a spec delta? | No. No behaviour changes, so the change sets `skip_specs: true`. | User |
| D9 | Is there a test? | Yes, one bats test: the rules block names no "readiness" field and no OpenSpec JSON field. It guards against the old text coming back. | User |
| D10 | Does this change update this repository's own `AGENTS.md`, `CLAUDE.md` or `.agents/` copies? | No. `lets sync` writes them from the pinned release. They update at the next release. | Evidence: `CLAUDE.md` "Where the source is" |

## Changes from the story

- Cut: a spec delta for `shared-domain-language`. The story allowed wording changes there, but no requirement quotes the rewritten text (D8).

Confirmed by user: yes
