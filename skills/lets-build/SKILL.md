---
name: lets-build
description: Move one story forward in an OpenSpec project. On the base branch, pick and claim the next story and plan it. On a change's branch, carry on planning, apply, verify or archive that change. Use when the user wants to build, start the next story, pick up work, or continue the change on the current branch.
---

# Let's build

Move one story forward. The current branch says which story: on the base
branch, start the next one; on a change's branch, move that change on.

You own picking and claiming the story. OpenSpec owns everything after
that. Invoke its skills, follow the schema's instructions, and add no
steps of your own.

## Find where you are

1. Find the base branch, the repository's default branch:
   `gh repo view --json defaultBranchRef --jq .defaultBranchRef.name`.
2. Run `git branch --show-current`.
3. Take the first row that matches:

| The current branch | Do |
|---|---|
| is the base branch | [Start a change](#start-a-change) |
| has a folder `openspec/changes/<branch>/` | [Move the change on](#move-the-change-on) |
| has an archived folder whose whole name is `<date>-<branch>` in `openspec/changes/archive/` | Say the change is archived and its pull request is ready for review. Stop. |
| anything else | Say that `lets-build` works on `<base>`, or on a change's branch, which has the change's name. Stop. |

## Start a change

This is the start rule. Parallel sessions share the backlog, so claim the
story before you create the change.

This skill's `scripts/backlog.sh` picks and claims stories. Run it from
the project root, as the steps below show. It needs `gh` and `jq`, which
the dev shell provides.

1. Use the issue the user named. Otherwise run
   `bash .agents/skills/lets-build/scripts/backlog.sh next`, which prints
   the next story.
   - If `next` finds no story, say no story is ready, suggest the
     `lets-shape` skill to shape more, and stop.
   - If the user named a story that is blocked by an open issue, say so,
     and stop. It must stack on the blocker's branch, which is done by
     hand.
2. Run `bash .agents/skills/lets-build/scripts/backlog.sh claim <n>`. If
   it refuses because the issue already has an assignee, another session
   took it: run `next` again.
3. Name the change after the issue title. A story's title is
   `<kebab-story-name> — <one-line outcome>`, so the name is the part
   before the dash.
4. If a branch with the change's name already exists, say so, suggest
   switching to it and running `lets-build` there, and stop. Otherwise
   create a branch with the same name off the base branch, and create the
   change on it with `openspec new change <name>`.
5. Invoke the `openspec-propose` skill. Tell it to continue the change
   `<name>`, which you just created for issue #<n>. It runs the
   brainstorm with the user, writes the plan, and stops.
6. Stop when propose stops. Tell the user the plan is ready, and that
   running `lets-build` again on this branch builds it.

## Move the change on

Run `openspec instructions apply --change <branch> --json`, and read
`state`:

| `state` | Meaning | Do |
|---|---|---|
| `blocked` | The plan is not finished. | Invoke `openspec-propose` to continue the change `<branch>`. Stop when it stops. |
| `ready` | Tasks are left. | Invoke `openspec-apply-change` for `<branch>`. The schema's apply instruction carries on through verify and archive. |
| `all_done` | Every task is ticked. | Run the `openspec-verify-change` skill. If it reports a problem, stop and show it to the user. Otherwise archive the change as [Archive](#archive) says. |
| any other `state` | OpenSpec has a state this skill does not know. | Show the user the `instruction` from the CLI's output, and stop. |

## Archive

The schema's apply instruction comes here when every task is done, and so
does the `all_done` state above.

1. If `.agents/skills/` holds the `peer-code-review` skill, the change
   needs a code review. If the pull request description
   has no **Code review** section, run the skill now. Otherwise check
   the section as the skill's *Before archive* section says, and run the
   skill again only when it tells you to.
2. Archive the change, then commit it on its own as `chore:`.
3. Mark the pull request ready for review.

## Rules

- Never pick a new story on a change's branch, and never move a change
  on from the base branch.
- Never write an artifact or code yourself, outside the skills you
  invoke.
- One story per run.
- Change requests on a pull request are not yours to handle. If the
  user is fixing them, as the workflow rules in `AGENTS.md` describe,
  run only after every fix is committed.
