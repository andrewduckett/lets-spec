---
name: lets-review-code
description: Use when an implementation branch is finished and needs a code review before verify, archive, or a pull request — such as when an OpenSpec change's apply tasks are all done. Also use when someone asks for a code review of a branch's changes.
---

# Peer Code Review

Have a different model family review the branch's code. A reviewer from the author's family shares the author's blind spots. This skill finds the author, runs the review read-only through `lets-spawn`, and acts on what it finds.

## When to apply

- **After apply.** Every task in an OpenSpec change is done. Review before the verify workflow, so verify checks the fixed code. This is the one review per change.
- **On request.** Someone asks for a code review of a branch.

Archive only checks that this review happened and still covers the code. It does not start a second review on its own.

## Find the author

`<base>` is the branch this one merges into: the pull request's base (`gh pr view --json baseRefName`), else the parent branch of a stacked story, else the repository's default branch.

Find who wrote each commit. Take the first source that names its author:

- **The commits.** Every family named in their `Co-Authored-By` lines is an author:

  ```bash
  git log --format='%(trailers:key=Co-Authored-By,valueonly)' <base>..HEAD | sort -u
  ```

  A commit with no such trailer names no author. Use the next source for it.

- **This session** — the commits name no model, and you wrote the code here.
- **Ask the author.** Do not guess. A wrong answer turns the review into a rubber stamp.

Pick the reviewer from a family that wrote none of the commits.

## Run the review

Commit or stash first. The review covers commits, not the working tree.

1. Run, from the repo root:

   ```bash
   node .agents/skills/lets-spawn/scripts/lets-spawn.mjs critique \
     --name <branch>-code-review --author <family> --effort high \
     --code-review --base <base> \
     > .workspace/<branch>-code-review-raw.md 2> .workspace/<branch>-code-review-meta.txt
   ```

2. Exit 0: the findings are in the raw file. The meta file holds one JSON line that names the harness, the family, the model, and whether the review was independent. Use those four in the report.
3. Any other exit: stop. Show the user the meta file's text and the exit code. Do not run the command again until something has changed.

The `lets-spawn` skill picks the reviewer's family and model and starts it read-only in a fresh session. When only the author's family is available, it still runs the review and reports `"independent": false`. Never review in the author's own session.

If the project has no `REVIEW.md`, the reviewer runs without project rules. Say so in the report.

Note the commit you reviewed: `git rev-parse --short HEAD`.

When the reviewer finds nothing, its whole output is `(none)`. That is a clean result, not a failure.

This costs real tokens. Run it once per change, never to chase a clean result.

## Act on the findings

The reviewer has no product context, so some findings will miss. Check each one against the code before you accept it:

- **CONFIRMED** — the defect is real. Fix it.
- **REFUTED** — name the evidence that contradicts it.
- **OUT-OF-SCOPE** — real, but not this change's. Say why, and file an issue if it matters.

Fix each confirmed finding in its own commit with its real type (`fix:`, `refactor:`, `test:`). A fix commit changes only what its finding names. Put any other change in its own commit: it is rework, and it needs a new review. Then run the project's checks, as its own instructions describe.

## Report

List every finding with its verdict and, when confirmed, its fix commit, most severe first. Name the reviewer, the commit it reviewed, and whether the review was independent. If the reviewer ran without the repo's review rules, say so. Put the same list in the pull request description under **Code review**, so the person who merges sees what was found and refuted.

## Before archive

Archive guidance checks the **Code review** section. Run this skill again only when:

- the section is missing; or
- a commit after the reviewed one changes files outside `openspec/changes/` and is not a listed fix.

Before treating a listed fix commit as exempt, read its diff with `git show <sha>`. Confirm it touches only what its finding names. If it touches anything else, run the review again.
