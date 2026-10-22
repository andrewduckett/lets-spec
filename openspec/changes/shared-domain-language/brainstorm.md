## Story

[#53 — shared-domain-language](https://github.com/andrewduckett/lets-spec/issues/53): agents maintain consistent domain terms throughout planning and implementation.

## Decisions

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | When does shared language work begin? | Shaping reads established vocabulary, uses it in discussion and issue packets, and actively resolves ambiguous or conflicting terms. | User |
| D2 | When are definitions recorded? | Write definitions into the project-owned glossary as soon as the user agrees on their meaning and scope, before implementation stories start. | User |
| D3 | How are definitions scoped? | Use optional nested `glossary.md` files that follow the project's domain and capability hierarchy; do not require a glossary for every scope. | User |
| D4 | How are scoped definitions read? | Read shared, ancestor, and affected-scope glossaries; nesting never silently overrides an ancestor's meaning. | User |
| D5 | Where does a new definition belong? | Choose the narrowest scope covering its intended uses, checking ancestors and siblings before confirming meaning and scope with the user. | User |
| D6 | How does vocabulary become shared? | Move a definition to the common scope when other domains adopt the same concept, update references without duplication, and reconcile differing meanings before promotion. | User |
| D7 | Where do tentative meanings live? | Keep unresolved terms and candidate meanings explicitly tentative in the shaping issue or brainstorm ledger until agreed. | User |
| D8 | Must code use identical words and structures? | Preserve domain meaning across code representations; prefer recognizable names and explain unclear mappings, but do not enforce literal spelling or a blanket ban on synonyms. | User |
| D9 | How are apparent code conflicts handled? | Investigate semantic contradictions before proposing fixes; implementation boundaries may explain differences, and code cannot silently redefine an agreed concept. | User |
| D10 | Who owns glossary edits made while shaping? | When glossary edits exist, ask at the handoff whether to carry them into the build's branch and PR or open a documentation PR if stopping; do not commit directly to the default branch. | User |
| D11 | When is that handoff question needed? | Ask only for glossary edits made during the current shaping run; otherwise keep the existing handoff, and record where edits live for a later build session. | User |
| D12 | Which steps consume or maintain vocabulary? | Shaping and brainstorming develop definitions; spec writing, implementation, and reviews read relevant vocabulary in both flows, without adding a review stage to the minimal flow. | User |
| D13 | What happens when a later step finds ambiguity? | Surface semantic conflicts for discussion before continuing affected work; unrelated work may continue. | User |
| D14 | How is an existing shared glossary selected? | Declare it explicitly in OpenSpec project context as replacing the default shared glossary; nested glossaries supplement it, and paths resolve from the planning root. | User |
| D15 | What if no glossary pointer exists or its target is missing? | Use the default convention when no pointer exists; report a missing declared file instead of silently substituting another glossary. | User |
| D16 | Does lookup require new configuration machinery? | Use the existing free-text context mechanism, with explicit workflow instructions to load the pointer and relevant nested files; add no new structured field or parser. | User |
| D17 | Who owns definitions shared by several shaped stories? | Ask whether one selected story's PR carries them or a documentation PR lands first; record the owner, avoid competing copies, and do not automatically stack independent stories. | User |
| D18 | What happens when a capability retires? | The retiring change reviews its glossary, moves still-used definitions to the appropriate remaining scope, and removes obsolete definitions; spec deletion alone never deletes a glossary. | User |
| D19 | Does this story select a dedicated skill? | Leave shared-reference versus dedicated-skill structure, exact conventional paths, distribution, and pinned OpenSpec compatibility checks to design. | User |

## Changes from the story

None. The issue records the agreed behavior and the advisory Claude Opus review. Glossary migration in consumer repositories and automated terminology linting remain out of scope.

Confirmed by user: yes
