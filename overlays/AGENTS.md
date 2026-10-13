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
- **Use the entry points' backlog scripts for issue selection, kind and
  priority.** `lets-build`'s script picks and claims stories, and
  `lets-shape`'s sets kind and priority. Never set an issue's kind or
  priority with `gh` directly. Every story is an issue, and its pull
  request says `Closes #<n>`. An epic is a parent issue with its stories
  as sub-issues. Dependencies are "blocked by" links. Put a blocker on
  each story it blocks, never only on the epic: picking the next story
  cannot see a blocker on a parent issue. A "relates to" link never
  counts as a blocker.
- **The user owns the merge.** Never merge a pull request unless the
  user asks. Stacks merge bottom-up.
- **Change requests reopen an archived change.** If a ready pull request
  gets change requests, mark it as a draft again and `git revert` the
  archive commit. Make the fixes, archive again as the last commit, and
  mark it ready. A rejected pull request is closed and its branch
  deleted.
- **Never edit what lets-spec puts in the project:** this section,
  between its markers, the skills in `.agents/skills/` and the schema
  folder in `openspec/schemas/`. `lets-spec-sync` rewrites this section, and
  the skills and the schema are read-only links into the Nix store that
  git ignores. Change lets-spec instead. Never run `openspec init` or
  `openspec update`; they write skills of their own.

### Routing

| Request | Start with |
|---|---|
| A large idea, or work that needs splitting or prioritizing | The `lets-shape` skill |
| Start the next story, or move the current branch's change on | The `lets-build` skill |
| A tooling or dependency change that changes no behavior | An ordinary branch and pull request, with no OpenSpec change |

### Writing

- **Write prose in plain language** (ISO 24495): READMEs, decision
  records, issue bodies, `docs/`, pull request descriptions and OpenSpec
  artifacts. Put the reader first, and make each document easy to find,
  understand and act on. Code and config follow their own conventions.
- **Put scratch files in `.workspace/`** at the repo root, not in `/tmp`
  or a scratch path your tool suggests. Create it if it is missing, and
  keep it out of git. Anything worth keeping belongs in the repo or an
  issue.
