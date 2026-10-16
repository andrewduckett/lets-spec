---
name: lets-review-code
description: Review a branch's commits with a model from another family, and check whether an earlier review still covers the branch. Use when a branch is finished and needs a code review, when a project rule or a workflow asks for one, or when someone asks for one.
---

# Peer Code Review

Have a different model family review the branch's code. A reviewer from the author's family shares the author's blind spots. This skill finds the author, runs the review read-only through `lets-spawn`, and acts on what it finds.

## When to apply

- **When a rule or a workflow asks for it.** The caller decides when a branch is reviewed, for example a project rule that wants a review before a change is finished. This skill does not decide that. Run it once per branch.
- **On request.** Someone asks for a code review of a branch.

A caller that finds a **Code review** section already in the pull request checks it as [Check an earlier review](#check-an-earlier-review) says, and runs this skill again only when that section says to.

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

1. Run the `lets-spawn` skill's `critique` command from the repo root. Give it the name `<branch>-code-review`, the author's family, effort `high`, and a code review against `<base>`. Save its stdout to `.workspace/<branch>-code-review-raw.md` and its stderr to `.workspace/<branch>-code-review-meta.txt`.
2. Exit 0: the findings are in the raw file. The meta file holds one JSON line that names the harness, the family, the model, and whether the review was independent. Use those four in the report.
3. Any other exit: stop. Show the user the meta file's text and the exit code. Do not run the command again until something has changed.

The `lets-spawn` skill says how to run the command and what each exit code means. It picks the reviewer's family and model and starts it read-only in a fresh session. When only the author's family is available, it still runs the review and reports `"independent": false`. Never review in the author's own session.

If the project has no `REVIEW.md`, the reviewer runs without project rules. Say so in the report.

Note the range you reviewed:

- the commit you reviewed, `<head-sha>`: `git rev-parse --short HEAD`;
- the base branch's name, `<base>`;
- the base commit the reviewer diffed from, `<base-sha>`: `git rev-parse --short "$(git merge-base <base> HEAD)"`.

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

The **Code review** section starts with this line, in exactly this form, so a later check can read the range:

```text
Reviewed: <base> <base-sha>..<head-sha>
```

## Check an earlier review

A **Code review** section in the pull request says what an earlier review covered. Before asking for another review, take `<base>`, `<base-sha>` and `<head-sha>` from its `Reviewed:` line, and run this skill again when any of these is true:

1. The pull request has no **Code review** section, or the section has no `Reviewed:` line.
2. The reviewed head is no longer in the branch's history: `git merge-base --is-ancestor <head-sha> HEAD` fails. The branch was rebased or squashed after the review.
3. A commit after `<head-sha>` changes files outside `openspec/changes/` and is not a listed fix. `git log --oneline <head-sha>..HEAD -- . ':(exclude)openspec/changes/'` lists the commits that change such files. Before treating a listed fix commit as exempt, read its diff with `git show <sha>`. Confirm it touches only what its finding names. If it touches anything else, it does not count as a fix.
4. The pull request's base no longer contains the reviewed base. Find the current base with `gh pr view --json baseRefName`, run `git fetch origin <current-base>`, then `git merge-base --is-ancestor <base-sha> origin/<current-base>`. If it fails, commits that the reviewer saw as already merged are now part of the pull request, unreviewed.

Rule 4 is what catches a stacked branch whose pull request is re-targeted to the default branch before its parent merges. If the parent was squash-merged, rule 4 also fires. Rebase the branch onto its new base first, so the one new review covers only this change's commits.
