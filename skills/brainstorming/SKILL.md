---
name: brainstorming
description: Use when an OpenSpec change's brainstorm step questions the user about a story and records the decisions in a ledger. Says how to think, what to ask, how to fill the ledger and when to split the story. The schema says which files to write.
---

# Brainstorming

Reach one shared understanding of a story with the user before anyone plans
it. The schema that calls this skill says which files to write and when to
commit. This skill says how to question, what to record and when to split.

## The stance

Be a thinking partner, not a form to fill in.

- **Grounded.** Read the code, tests and specs the story touches before you ask anything. Never ask the user for a fact you can check.
- **Patient.** Let the shape of the problem emerge. Do not rush to a conclusion.
- **Skeptical.** Question the story's assumptions, the user's and your own. Say so if the story solves the wrong problem, if a smaller story would deliver the outcome, or if the code hides complexity the story misses.
- **Honest.** If something is unclear, dig deeper. Never fake understanding, and never invent the user's intent, priorities or constraints: ask.
- **Visual.** When a flow, a set of states or a choice is hard to hold in words, draw it. Use plain ASCII only (`+ - | --> v`), because other characters misalign in a terminal.

## Questioning

- Ask one question at a time, with your recommended answer and why it matters: the decision it settles.
- Settle first the questions that others depend on, such as scope before behavior. If an answer changes an earlier one, go back to it.
- Skip a question whose answer would not change the plan.
- Where a question has real alternatives, give two or three with their trade-offs, and lead with the one you recommend.
- Settle scope, behavior and acceptance: the what and the why. Leave the how to the design step, when the flow has one.

## The ledger

One row per resolved question, in the order settled. Each row names its source.

| Source | When |
|---|---|
| `User` | The user decided. |
| `Evidence: <where>` | Code or a document settled it. Name the file. |
| `Assumption` | Neither did. |

Silence is not agreement: a recommendation the user did not accept is an `Assumption`. Keep each row to one line; the design explains the why and the how.

## Splitting the story

A story is the right size when it would take about five to twelve tasks to build. If the answers show it is bigger, split it now, before any plan exists. Keep the thinnest slice that still delivers the outcome, and file the rest as a new issue:

1. Write the issue body from the story template at `.agents/skills/lets-shape/templates/issue-template.md`.
2. Create it with `gh issue create`, with the same parent as this story.
3. Set its kind and priority with `bash .agents/skills/lets-shape/scripts/backlog.sh set-kind <n> Story` and `bash .agents/skills/lets-shape/scripts/backlog.sh set-priority <n> <Must|Should|Could>`.
4. Record the split under "Changes from the story", with the new issue's number.

## Confirming

Show the user the ledger and the changes from the story, and ask them to confirm. Only an explicit yes counts. Until then the brainstorm is not finished, whatever the file says.
