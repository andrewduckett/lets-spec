**Why:** Agents need to find the right project and shared behavior specs in a monorepo while retaining one shared workflow and the existing flat-spec layout.

## Story

[#36 — domain-aware-planning](https://github.com/andrewduckett/lets-spec/issues/36): use shared skills with project-specific specs in one root OpenSpec project.

## Decisions

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | Where do skills and planning live? | Keep shared skills and one OpenSpec project at the repository root. | User |
| D2 | What does the agent read before planning? | Identify affected domains and read their existing specs, including relevant shared behavior. | User |
| D3 | What happens to existing layouts? | Preserve flat capability paths without migration or mandatory domain-selection prompts. | User |
| D4 | How are changes across domains verified? | Verify that deltas update matching main specs and leave unrelated specs unchanged. | User |
| D5 | Which issue and backlog apply? | Use upstream issue #36, make the change on mstelz/lets-spec, and skip Project setup. | User |
| D6 | Is a new installer or merge mechanism needed? | No; the existing schemas preserve capability paths and OpenSpec owns discovery and merging. | Evidence: schemas/lets-standard/schema.yaml; schemas/lets-minimal/schema.yaml |
| D7 | How will guidance reach both flows? | Extend the existing brainstorm and spec-writing skills, align both schemas, document the layout, and extend the pinned CLI compatibility tests. | Assumption |

## Changes from the story

None. The fork has issues disabled; the pull request references the upstream issue. The user explicitly waived Project setup and confirmed D1–D5 before planning.

Confirmed by user: yes
