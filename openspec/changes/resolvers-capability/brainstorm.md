**Why:** The resolvers now ship in `resolvers/`, so the capability name `contrib-resolvers` names a folder that no longer exists, and this is the last story of #103.

## Story

#106 resolvers-capability — the spec capability for the shipped resolvers is named resolvers, https://github.com/sidereal-io/lets-spec/issues/106

## Decisions

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | What does the change do? | Removes all 23 requirements from `contrib-resolvers` and adds each, word for word, to a new capability `resolvers`. | User |
| D2 | Can any requirement or scenario change on the way? | No. Names, text and scenarios stay exactly as they are in `openspec/specs/contrib-resolvers/spec.md` on this branch. | User |
| D3 | What is the Purpose of `resolvers`? | The old Purpose with `contrib/` replaced by `resolvers/`: "Says which resolver programs this repository ships in `resolvers/`, when each one answers a request or declines it, and how a user gets them from the release folder or the flake." | User |
| D4 | What do the REMOVED entries say? | **Reason:** the capability is renamed to `resolvers`. **Migration:** moved to `resolvers` unchanged. | Evidence: #106, How to rename |
| D5 | What happens to `openspec/specs/contrib-resolvers/` after archive? | If archive leaves it behind with no requirements, delete the folder in the archive commit. | Evidence: #106, How to rename |
| D6 | Does anything else name `contrib-resolvers`? | No. `git grep contrib-resolvers -- ':!openspec/changes/archive'` on this branch finds only the spec file's own heading. Archived changes keep the old name. | Evidence: `git grep` on branch `resolvers-capability` |
| D7 | Does the change need code or test edits? | No. No code, test or doc outside `openspec/` names the capability, so the work is the spec delta and a validate check. | Evidence: D6 |
| D8 | Is the story the right size? | Yes. It is one spec delta and one check; no split. | User |

## Changes from the story

None

Confirmed by user: yes
