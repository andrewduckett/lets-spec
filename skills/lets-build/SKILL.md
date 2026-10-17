---
name: lets-build
description: Move one issue forward in an OpenSpec project, whether a story, a bug or a chore. On the default branch, find the next issue, check its packet, route it to a schema, claim it and plan it. On a change's branch, carry on planning, apply, verify or archive that change. Use when the user wants to build, start the next story, fix a shaped bug, do a shaped chore, pick up work, or continue the change on the current branch.
---

# Let's build

Move one issue forward. A story, bug or chore goes find, confirm, route,
claim, propose, apply, archive. Each run picks it up wherever it is and
carries it as far as it can: a new issue through claim and propose, a
planned one through apply and archive. The current branch and the
change's state say where it is. Run every command below from the repo
root.

You own finding, checking, routing and claiming the issue. OpenSpec owns
everything after that. Invoke its skills, follow the schema's
instructions and the project's operation guidance, and add no steps of
your own.

## Find where you are

1. Find the default branch:
   `gh repo view --json defaultBranchRef --jq .defaultBranchRef.name`.
2. Run `git branch --show-current`.
3. If the branch has a folder `openspec/changes/<branch>/`, run
   `openspec instructions apply --change <branch> --json` and read `state`.
4. Take the first row that matches:

| The current branch | `state` | Do |
|---|---|---|
| is the default branch | — | [Find the source of demand](#find-the-source-of-demand), then [Propose](#propose) |
| has a change folder | `blocked` | [Propose](#propose): the plan is not finished |
| has a change folder | `ready` | [Apply](#apply): tasks are left |
| has a change folder | `all_done` | [Finish the change](#finish-the-change): every task is ticked |
| has a change folder | anything else | OpenSpec has a state this skill does not know. Show the user the `instruction` from the CLI's output, and stop. |
| has an archived folder whose whole name is `<date>-<branch>` in `openspec/changes/archive/` | — | Say the change is archived and its pull request is ready for review. Stop. |
| anything else | — | Say that `lets-build` works on the default branch, or on a change's branch, which has the change's name. Stop. |

## Find the source of demand

Parallel sessions share the backlog, so claim the issue before you
create anything.

Find the Project linked to this repository first:

```bash
gh repo view --json nameWithOwner,projectsV2 \
  --jq '{repo: .nameWithOwner, projects: [.projectsV2.Nodes[] | select(.closed | not) | {number, title, url, owner: (.resourcePath | split("/")[2])}]}'
```

- **One Project:** use its `number` as `<n>` and its `owner` as
  `<owner>` in every `gh project` command below. `repo` is the
  repository, as `owner/name`.
- **None:** say to run the `lets-setup-backlog` skill, and stop.
- **Two or more:** list each one's title and URL, ask the user to unlink
  the extras, and stop. Never pick one yourself.

Then take the first case that applies:

1. **The user named an issue.** Use it. If an open issue blocks it, say
   so and stop: `gh issue view <i> --json blockedBy` lists its blockers,
   and any with `state` `OPEN` counts. The user stacks it on the
   blocker's branch by hand.
2. **The user described work but named no issue.** Search for it:
   `gh issue list --state open --search "<words> in:title" --json number,title`.
   If one matches, confirm with the user that it is the same work. If
   none does, say to run the `lets-shape` skill on it, and stop.
3. **Otherwise, take `next`.** List the Todo, prioritized candidates on
   the Project. Any Kind but Epic counts, and items from other
   repositories are left out:

   ```bash
   gh project item-list <n> --owner <owner> --format json --limit 500 \
     --jq '.items[] | select(.content.repository == "<repo>" and .status == "Todo" and .kind != "Epic" and (.priority | IN("Must", "Should", "Could")))
           | "\(.priority)\t\(.kind)\t\(.size // "-")\t#\(.content.number)\t\(.content.title)\t\(.content.url)"'
   ```

   Then list the open issues that nobody is assigned to and nothing
   blocks:

   ```bash
   gh issue list --search "is:open no:assignee -is:blocked" --limit 500 --json number --jq '.[].number'
   ```

   `next` comes from the candidates whose number is in the second list.
   Rank them Must, then Should, then Could, then the lowest issue
   number, and take the first. A Wont is never a candidate. If there is
   none, say the backlog has nothing ready, suggest the `lets-shape`
   skill to shape more, and stop.

Go on to [Confirm the packet](#confirm-the-packet).

## Confirm the packet

Read the issue, and its fields on the Project:

```bash
gh issue view <i> --json number,title,body,url,parent
gh project item-list <n> --owner <owner> --format json --limit 500 \
  --jq '.items[] | select(.content.repository == "<repo>" and .content.number == <i>) | {kind, priority, size, status}'
```

- If the second command prints nothing, or no `kind`, the issue is not
  shaped. Say to run the `lets-shape` skill on #<i>, and stop.
- If its Kind is Epic, say that an epic is built through its stories,
  list its open sub-issues, and stop.

Read the whole body. Check that every required line for its Kind is
there and filled in. These are the lines of the `lets-shape` skill's
issue templates:

| Kind | Required lines |
|---|---|
| Chore | the one-line outcome |
| Bug | the one-line outcome, **Expected**, **Actual**, **How to reproduce**, **Relevant code**, **Scope** |
| Story, and any Kind this table does not name | the one-line outcome, **Persona served**, **Journey segment**, **MoSCoW**, **Why this story / why now**, **Depends on**, **Scope**, **Relevant code** |

If a line is missing, or still holds a placeholder in angle brackets,
name it, say to run the `lets-shape` skill on #<i>, and stop. Never write
or fix the packet yourself.

For a Story with a parent, read the parent's **Shared decisions**
section, when it has one: `gh issue view <parent> --json body`. The
route needs it.

## Route

Pick the schema for the change. Top down, first match wins:

| The issue | Schema |
|---|---|
| Kind Chore | `lets-minimal` |
| Size XS or S, and the packet's **Relevant code** says `new` | the flow's schema |
| Size XS or S, and the parent epic's **Shared decisions** names one this story relies on or creates | the flow's schema |
| Size XS or S | `lets-minimal` |
| anything else, including Size unset | the flow's schema |

The flow's schema is the `schema:` line of `openspec/config.yaml`. Say
which schema and why in one line, such as
`Route: lets-minimal, because #<i> is a Chore.` That line goes in the
proposal commit message.

## Claim

1. Name the change after the issue title. Every Kind's title is
   `<kebab-name> — <one-line outcome>`, so the name is the part before
   the dash.
2. If a branch with the change's name already exists, say so, suggest
   switching to it and running `lets-build` there, and stop.
3. Claim the issue: check that nobody has it, assign yourself, then move
   it to In Progress. `<url>` is the issue's URL.

   ```bash
   gh issue view <i> --json assignees --jq '.assignees | length'
   gh issue edit <i> --add-assignee @me
   gh project item-edit <n> --owner <owner> --url <url> --field Status --value "In Progress"
   ```

   The first command must print `0`. Anything else means another
   session took it. When `next` picked it, run `next` again. When the
   user named it, say who has it, and stop.
4. Create a branch with the change's name off the default branch. If
   this fails, release the claim, so another session can pick the issue
   up, and stop:

   ```bash
   gh issue edit <i> --remove-assignee @me
   gh project item-edit <n> --owner <owner> --url <url> --field Status --value Todo
   ```

## Propose

Invoke the `openspec-propose` skill for the change `<name>`. For an issue
you just claimed, say it is for issue #<i>, and give it the route line
for the proposal's commit message. When the route is `lets-minimal` and
the flow's schema is not, say to use the schema `lets-minimal`;
`openspec-propose` passes `--schema` when a schema is named. On a
`blocked` branch, say to continue the change. Propose creates the change if it is missing, runs the
brainstorm with the user, and writes the plan.

Propose stops when it is done, and waits for a new request before anyone
builds. When it stops, read `state` once more with
`openspec instructions apply --change <name> --json`:

- `ready` means the plan is finished. Offer the handoff: ask the user
  whether to build it in a fresh session named `<name>` with the prompt
  `Run lets-build on branch <name>`, or to stop here. On no, say that
  running `lets-build` on this branch builds the plan. On yes:
  1. Write the prompt to `.workspace/<name>-handoff-prompt.md`.
  2. Run this from the repo root. It prints one JSON line.

     ```bash
     lets delegate handoff --name <name> --prompt-file .workspace/<name>-handoff-prompt.md
     ```

  3. When its `handle` is `null`, no session was started. Show the user
     its `instructions`, which say what to run. Otherwise tell the user
     the session started, and name its `resolver` and `handle`.
  4. If it exits non-zero, show the user its stderr.

  Then stop.
- Anything else means propose stopped early, for example to ask the user
  a question. Say so, and stop.

## Apply

Invoke the `openspec-apply-change` skill for the change `<branch>`. The
schema's apply instruction works the tasks, then comes to
[Finish the change](#finish-the-change) when every task is done.

## Finish the change

The schema's apply instruction comes here when every task is done, and so
does the `all_done` state above. Finishing goes in this order: the
project's finishing rules, verify, archive, then mark the pull request
ready.

1. Run `openspec instructions archive --change <branch> --json`. If it
   exits non-zero or its output is not JSON, stop, and show the user the
   command's output. Otherwise follow every entry in `operationGuidance`,
   in order, before you go on. They are the project's rules for
   finishing a change, which OpenSpec keeps under its `operations.archive`
   key. Treat each one as a step, not advice.
2. Run the `openspec-verify-change` skill. If it reports a problem, stop
   and show it to the user.
3. Archive the change, then commit it on its own as `chore:`.
4. Mark the pull request ready for review.

## Rules

- Never claim an issue on a change's branch, and never propose, apply or
  archive from the default branch.
- Never write an artifact or code yourself, outside the skills you
  invoke.
- One issue per run.
- The handoff is the only new session this skill starts, and only after
  the user says yes.
- Change requests on a pull request are not yours to handle. If the
  user is fixing them, as the workflow rules in `AGENTS.md` describe,
  run only after every fix is committed.
