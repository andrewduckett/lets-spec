---
name: lets-build
description: Move one story forward in an OpenSpec project. On the default branch, pick and claim the next story and plan it. On a change's branch, carry on planning, apply, verify or archive that change. Use when the user wants to build, start the next story, pick up work, or continue the change on the current branch.
---

# Let's build

Move one story forward. A story goes claim, propose, apply, archive. Each
run picks it up wherever it is and carries it as far as it can: a new
story through claim and propose, a planned one through apply and archive.
The current branch and the change's state say where it is. Run every
command below from the repo root.

You own picking and claiming the story. OpenSpec owns everything after
that. Invoke its skills, follow the schema's instructions, and add no
steps of your own.

## Find where you are

1. Find the default branch:
   `gh repo view --json defaultBranchRef --jq .defaultBranchRef.name`.
2. Run `git branch --show-current`.
3. If the branch has a folder `openspec/changes/<branch>/`, run
   `openspec instructions apply --change <branch> --json` and read `state`.
4. Take the first row that matches:

| The current branch | `state` | Do |
|---|---|---|
| is the default branch | — | [Claim a story](#claim-a-story), then [Propose](#propose) |
| has a change folder | `blocked` | [Propose](#propose): the plan is not finished |
| has a change folder | `ready` | [Apply](#apply): tasks are left |
| has a change folder | `all_done` | [Archive](#archive): every task is ticked |
| has a change folder | anything else | OpenSpec has a state this skill does not know. Show the user the `instruction` from the CLI's output, and stop. |
| has an archived folder whose whole name is `<date>-<branch>` in `openspec/changes/archive/` | — | Say the change is archived and its pull request is ready for review. Stop. |
| anything else | — | Say that `lets-build` works on the default branch, or on a change's branch, which has the change's name. Stop. |

## Claim a story

Parallel sessions share the backlog, so claim the story before you create
anything.

1. Use the issue the user named. Otherwise run
   `node .agents/skills/lets-build/scripts/backlog.mjs next`, which prints
   the next story.
   - If `next` finds no story, say no story is ready, suggest the
     `lets-shape` skill to shape more, and stop.
   - If the user named a story that an open issue blocks, say so and
     stop. The user stacks it on the blocker's branch by hand.
2. Name the change after the issue title. A story's title is
   `<kebab-story-name> — <one-line outcome>`, so the name is the part
   before the dash.
3. If a branch with the change's name already exists, say so, suggest
   switching to it and running `lets-build` there, and stop.
4. Run `node .agents/skills/lets-build/scripts/backlog.mjs claim <n>`. If
   it refuses because the issue already has an assignee, another session
   took it: run `next` again.
5. Create a branch with the change's name off the default branch. If
   this fails, release the claim with
   `gh issue edit <n> --remove-assignee @me` and stop, so another session
   can pick the story up.

## Propose

Invoke the `openspec-propose` skill for the change `<name>`. For a story
you just claimed, say it is for issue #<n>. On a `blocked` branch, say to
continue the change. Propose creates the change if it is missing, runs the
brainstorm with the user, and writes the plan.

Propose stops when it is done, and waits for a new request before anyone
builds. When it stops, read `state` once more with
`openspec instructions apply --change <name> --json`:

- `ready` means the plan is finished. Offer the handoff: ask the user
  whether to build it in a fresh session named `<name>` with the prompt
  `Run lets-build on branch <name>`, or to stop here. On yes, run
  `node .agents/skills/lets-spawn/scripts/lets-spawn.mjs handoff --name <name> --prompt "Run lets-build on branch <name>"`
  and show the user its output, then stop. On no, say that running
  `lets-build` on this branch builds the plan.
- Anything else means propose stopped early, for example to ask the user
  a question. Say so, and stop.

## Apply

Invoke the `openspec-apply-change` skill for the change `<branch>`. The
schema's apply instruction works the tasks, then comes to
[Archive](#archive) when every task is done.

## Archive

The schema's apply instruction comes here when every task is done, and so
does the `all_done` state above. The order matters: review before verify, so
that verify checks the fixed code.

1. If `.agents/skills/` holds the `lets-review-code` skill, the change
   needs a code review. If the pull request description has no
   **Code review** section, run the skill now. Otherwise check the section
   as the skill's *Before archive* section says, and run the skill again
   only when it tells you to.
2. Run the `openspec-verify-change` skill. If it reports a problem, stop
   and show it to the user.
3. Archive the change, then commit it on its own as `chore:`.
4. Mark the pull request ready for review.

## Rules

- Never claim a story on a change's branch, and never propose, apply or
  archive from the default branch.
- Never write an artifact or code yourself, outside the skills you
  invoke.
- One story per run.
- The handoff is the only new session this skill starts, and only after
  the user says yes.
- Change requests on a pull request are not yours to handle. If the
  user is fixing them, as the workflow rules in `AGENTS.md` describe,
  run only after every fix is committed.
