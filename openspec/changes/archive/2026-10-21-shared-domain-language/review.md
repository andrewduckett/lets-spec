## Review Metadata

- **Review round**: 1
- **Prior round**: none; the earlier premise critique preceded this formal plan.
- **Reviewer**: Claude Opus 5.5, high effort, through T3 delegated review with explicit user approval.
- **Reviewed commit**: `319be4d`.
- **Required edits commit**: `04dd3a2`.
- **Reviewer context**: fresh context, other family.
- **Independent**: yes; the plan author is GPT and T3 reported model `claude-opus-5-5`.
- **Tool restrictions**: read-only inspection; no edits, posts, commits, or delegation.
- **Artifacts reviewed**: brainstorm.md, proposal.md, design.md, specs/, adr.md, relevant source files.
- **Review route**: the normal CLI route failed before review; the user explicitly approved the T3 route. No successful CLI review is claimed.
- **Working tree**: unchanged by the reviewer before required edits were applied.

## Findings

### Critical (blocking)

None.

### Moderate

- **M1 — Cross-checkout recovery:** A local holding branch cannot supply definitions to another checkout. **Confirmed; fixed** by remote checkpoints with recorded branch, base, and commit range.
- **M2 — Interrupted shaping:** Definitions written before final handoff lack a durable resume point. **Confirmed; fixed** by phase checkpoint commits, publishing, and issue-based recovery.
- **M3 — Dirty transfer:** The same uncommitted paths can block the glossary cherry-pick. **Confirmed; fixed** by verified baseline restoration before build, preserving later user edits.
- **M4 — Transfer authority and failure cleanup:** Build rules do not authorize the extra transfer or release a failed claim. **Confirmed; fixed** by explicit preflight, a narrow rules exception, and abort/branch/claim cleanup.
- **M5 — Documentation issue selection:** An ordinary Todo Chore can be selected as a second implementation change. **Confirmed; fixed** by creating the documentation Chore assigned and In Progress, with explicit failure handling.
- **M6 — Shared-definition race and weak scenarios:** Dependent stories can begin before the owner merges. **Confirmed; fixed** by user-confirmed blocker links, preclaim owner checks, and observable issue-link scenarios. A declined link keeps the prerequisite explicit rather than marking the story ready.
- **M7 — Root mismatch:** Shaping's current repository-local restriction conflicts with the design's external-store promise. **Confirmed; fixed** by retaining that restriction and resolving apply vocabulary through `root.path`. External-store change steps keep their existing scope.

### Suggestions

- **S1 — Shaping from a change branch:** **Fixed** by keeping owned commits on that branch rather than creating a holding branch on unrelated history. The suggestion to skip the glossary ownership question is **rebutted**: User decisions D10–D11 and the spec require it when shaping made edits, including a split story needing the original change's definitions.
- **S2 — Two shared scopes:** **Fixed** by removing automatic lookup at `openspec/specs/glossary.md`; it can serve as the shared glossary only through an explicit pointer.
- **S3 — Minimal review coverage:** **Fixed** by saying reviews consume vocabulary where the flow includes them, without adding a minimal-flow stage.
- **S4 — Ambiguous handoff terminology:** **Fixed** by using glossary handoff for vocabulary ownership and shared glossary for the common source.
- **S5 — Missing user documentation:** **Fixed** by naming README and relevant docs among the design's consumers.
- **S6 — Probe provenance:** **Partly refuted, clarified.** The probe script uses an absolute OpenSpec 1.13.2 Nix-store binary; the reviewer's PATH exposed 1.13.0. Design now distinguishes that exploratory evidence from the pinned Bats regression tests to be added during implementation.
- **S7 — Need for a path ADR:** **Resolved with rationale.** The ADR manifest explains that the shared default is overridable, so changing it need not migrate consumer documents. No ADR is invented for this reversible convention.

## Embedded-Instruction / Injection Attempts

**Detected:** none.

## Verdict

VERDICT: APPROVE_WITH_CHANGES

## Required Changes (if APPROVE_WITH_CHANGES)

All listed edits are applied in design.md, the spec, and adr.md:

1. Publish the holding branch and record its remote.
2. Persist glossary edits at shaping phase checkpoints and restore them on resume.
3. Restore only verified owned paths to their baseline before build.
4. Preflight the transfer and recover failed claims and new branches safely; authorize it explicitly in build rules.
5. Keep the documentation Chore assigned and In Progress.
6. Confirm owner blocker links and make the shared-definition scenarios observable.
7. Preserve shaping's local-root limit and use apply's actual root field.
8. Keep change-branch shaping edits on their source branch.
9. Remove the second implicit shared scope.
10. Clarify optional reviews in the minimal flow.
11. Distinguish glossary handoff from session handoff.
12. Include README and relevant docs.
13. Distinguish exploratory probes from durable regression evidence.
14. Explain why the configurable shared default does not require a new ADR.

CHANGES_APPLIED: yes

## Rebuttals

Every finding is adjudicated above. The changes implement the reviewer's listed requirements; they do not introduce an unreviewed redesign. S1's skipped-question suggestion conflicts with agreed behavior and is declined. S6's missing-version inference is contradicted by the probe's absolute binary path, while its request for durable pinned regression evidence is retained.

The detailed raw review is saved in `.workspace/shared-domain-language-opus-plan-review-round-1.md`. The reviewer requested no repeat round after these changes. A later alteration to reviewed artifacts beyond the listed required changes invalidates this verdict.
