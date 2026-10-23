## Workflow

These rules come from lets-spec, and apply to every agent.

- **Plan product changes with OpenSpec.** Work in progress lives in
  `openspec/changes/`, specs in `openspec/specs/`, and decision records
  in `docs/decisions/`. A change starts with a brainstorm and ends with
  archive. The schema's instructions say what to do at each step in
  between. [Routing](#routing) says where each request starts.
- **One change is one branch and one pull request,** from propose to
  archive. Independent changes branch off the repository's default
  branch. A change that
  depends on another stacks: it branches off the other change's branch
  and targets its pull request.
- **One commit per unit of work,** with Conventional Commits: `feat:`,
  `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- **Run the project's checks** before you push, and fix what they
  report. The project's own instructions say how to run them.
- **When you review code, also apply the project's `REVIEW.md`,** if it
  has one.
- **The backlog is the GitHub Project linked to this repository.**
  `lets-shape` sets Kind, Priority, Size and Status; `lets-build`
  picks, claims and routes. Never set a Project field with `gh` outside
  those skills. Every piece of work is an issue, and its pull request
  says `Closes #<n>`. An epic is a parent issue with its stories as
  sub-issues. Dependencies are "blocked by" links on the story they
  block. Put a blocker on each story it blocks, never only on the epic:
  picking the next story cannot see a blocker on a parent issue. A
  "relates to" link never counts as a blocker.
- **The user owns the merge.** Never merge a pull request unless the
  user asks. Stacks merge bottom-up.
- **Change requests reopen an archived change.** If a ready pull request
  gets change requests, mark it as a draft again and `git revert` the
  archive commit. Make the fixes, archive again as the last commit, and
  mark it ready. A rejected pull request is closed and its branch
  deleted.
- **Never edit what lets-spec puts in the project:** this section,
  between its markers, the `lets-*` and `openspec-*` skills in
  `.agents/skills/` and the `lets-*` schema folders in
  `openspec/schemas/`. `lets sync` rewrites all of these, so an edit
  there is lost. Change lets-spec instead. Never run `openspec init` or
  `openspec update`; they write skills of their own.

### Routing

| Request | Start with |
|---|---|
| A large idea, or work that needs splitting or prioritizing | The `lets-shape` skill |
| A bug, a chore or a single story with no issue yet, or an issue with no packet | The `lets-shape` skill |
| Start the next story, or move the current branch's change on | The `lets-build` skill |
| Set up or check this repository's backlog | The `lets-setup-backlog` skill |

### Domain language

Read the installed shared reference at
`.agents/skills/lets-shape/references/domain-language.md` when shaping,
planning, implementing or reviewing. Resolve project vocabulary from the
planning root: `planningHome.root` for artifacts, `root.path` for apply.
The shared glossary defaults to `openspec/glossary.md`. Existing free-text
project context can replace it explicitly:

```yaml
context: |
  Shared glossary: docs/requirements/00-glossary.md
  This replaces the default openspec/glossary.md.
```

Paths are relative to the planning root. Also load existing ancestor and
local glossaries under `openspec/specs/<capability-path>/`; nested scopes
are optional and never silently override shared meanings. Report a missing
declared target. Confirm meaning and scope before writing agreed terms,
and preserve domain meaning across code naming and representation choices.

### Writing

- **Write prose in plain language** (ISO 24495): READMEs, decision
  records, issue bodies, `docs/`, pull request descriptions and OpenSpec
  artifacts. Put the reader first, and make each document easy to find,
  understand and act on. Code and config follow their own conventions.
- **Put scratch files in `.workspace/`** at the repo root, not in `/tmp`
  or a scratch path your tool suggests. Create it if it is missing, and
  keep it out of git. Anything worth keeping belongs in the repo or an
  issue.
