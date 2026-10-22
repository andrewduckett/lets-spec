# Code review

Reviewed: main 92905a3..10f5015

Claude Opus 5.5 reviewed the committed diff in fresh context through a T3
read-only subagent at high effort. Independent: yes; this implementation's
author is GPT. The reviewer ran its built-in high-effort code review and
made no edits. There is no root REVIEW.md, so no project review rules were
available. Working-tree status was clean before and after review.

The documented CLI first failed with exit 126 because `lets` resolved to a
directory. Using the repository's actual CLI entry point corrected that
execution error; it exited 3 because no resolver started a session. The
skill's subagent fallback then ran successfully through T3. The raw review
and original prompt are retained under .workspace/ for this checkout.

## Findings and disposition

| # | Finding | Disposition | Fix commit |
|---|---|---|---|
| 1 | Schema-relative reference links cannot be resolved from CLI-emitted instructions. | Confirmed. Use the code-root installed path, explicitly separate from the planning store; regression now consumes actual brainstorm/specs/apply JSON for both shipped flows. | 9c154cc |
| 2 | Existing-branch stop comes after transfer work; resume case is unclear. | Confirmed. Stop before transfer checks and describe the existing-change OpenSpec route separately. | 93365b2 |
| 3 | Reference containment compares a canonical link with a noncanonical root. | Confirmed with failing symlink fixture. Canonicalize the root; regression passes. Darwin itself was not executed locally. | 081d9a9 |
| 4 | All candidates can be filtered without a no-ready stop. | Confirmed. Explicitly stop without selecting or confirming a packet. | 069b6db |
| 5 | Backlog ownership wording leaves the docs-Chore claim exception implicit. | Confirmed ambiguity. State the narrow shaping assignment/claim exception in the backlog rule too. | 5eeda00 |
| 6 | Issue templates omit the durable glossary recovery record. | Confirmed resilience gap. Provide an optional record for every Kind, preserving it across body replacement. | c6164d6 |
| 7 | Full transfer rehearsal repeats during ranking and claim. | Confirmed. Ranking checks only owner/prerequisite readiness; the selected candidate gets one transfer preflight after branch-existence checks. | e3b6ff8 |
| 8 | Retirement guidance does not name the CLI setting. | Confirmed. Name retire_capabilities: true in the change metadata beside schema. | b66d6b9 |
| 9 | Review lookup/check guidance is duplicated. | Confirmed maintenance concern. Move detailed rules into the shared reference; both review skills explicitly load and include its delegated-input checklist. | fb943eb |
| 10 | Domain guide has two top-level headings. | Confirmed formatting issue. Make the recovery heading level two. | deba2b8 |

Every finding has a separate targeted commit. No finding remains open, and
none was dropped or deferred. Each post-review implementation commit changes
only its listed finding. No repeat review is required by the review skill;
this record does not claim the reviewer re-reviewed the fixes.
