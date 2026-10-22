## Context

The source skills live in `skills/`; releases copy whole skill folders. Both flows ship `lets-shape`. `lets sync` already copies nested files inside managed skills. No packaging change is needed for a reference inside that skill.

OpenSpec 1.13.2 discovers `spec.md` recursively and ignores neighboring `glossary.md` files. A disposable probe archived grouped deltas with both schemas and preserved shared, domain, and capability glossaries. Another probe shipped a synthetic nested reference through both flow builds and both sync modes. The exploratory probes invoked the absolute Nix-store path for OpenSpec 1.13.2, rather than the 1.13.0 on PATH. Durable Bats tests against the pinned CLI will provide the regression evidence.

The artifact schema uses `specs/**/*.md` for delta output. Therefore glossary edits must stay in the main planning documents, outside each change's delta directory. Reviewers receive authored prompts and do not automatically inherit project context. Apply instructions also need an explicit glossary-loading step.

## Goals / Non-Goals

**Goals:** One maintained set of vocabulary rules; predictable scoped lookup; safe ownership of shaping edits; explicit vocabulary inputs for later agents.

**Non-Goals:** A glossary parser, a terminology linter, a new mandatory stage, automatic migration of consumer documents, or changes to OpenSpec's archive implementation.

## Test Seams

- **Primary test seam:** Published workflow inputs, exercised by the existing Bats release, sync, and OpenSpec compatibility fixtures.
- **Existing seams reused:** `tests/release-build.bats`, `tests/sync-skills.bats`, `tests/openspec-compat.bats`, and `tests/skill-interfaces.bats`.

Use runtime assertions for recursive distribution, glossary preservation, and unchanged capability discovery. Extend interface checks to resolve the shared reference from every caller and each shipped flow. Do not write tests that only search for copies of the new prose.

Agent judgment is not proven by file-presence tests. During implementation, manually walk the spec scenarios against the shipped instructions, including new meanings, sibling scopes, missing pointers, unrelated edits, and handoff replay. Record that evidence alongside structural test results. No new evaluation framework is introduced.

## Scrutiny Tier & Blast Radius

- **Tier:** high
- **Blast radius:** Shaping, brainstorming, specs, implementation instructions, independent review inputs, and shaping-to-build ownership in both flows. No application runtime, dependency, or delegate protocol changes.

## Decisions

### 1. Put the shared discipline inside an existing skill

Add `skills/lets-shape/references/domain-language.md`. Shaping, brainstorming, spec writing, and reviews read it through links relative to their installed skill folders. Both schemas' apply instructions explicitly load it too. The rules block in `overlays/AGENTS.md` points ordinary implementation work to the same discipline.

A new skill would add an invocation boundary without adding a distinct workflow. Repeating the full rules across consumers would allow them to drift. A top-level shared directory would need new packaging support. The existing skill folder avoids all three costs.

Separate installed workflow instructions from project vocabulary. Resolve the shared reference relative to the installed skills. Artifact steps use `planningHome.root`; apply uses `root.path` from `instructions apply --json`. Shaping keeps its current restriction to a resolved root inside the repository; this story does not extend shaping to external stores.

### 2. Use one shared glossary plus optional nested glossaries

Default shared vocabulary lives at `<planningHome.root>/openspec/glossary.md`. For a capability `backend/checkout`, also read any existing `glossary.md` at `openspec/specs/backend/` and `openspec/specs/backend/checkout/`. The specs root is not a second shared-glossary scope; a glossary there must be explicitly selected by the context pointer to serve as the shared glossary. Deduplicate paths across affected capabilities.

Absent conventional files are optional. Do not create empty files. Create a file when an agreed definition belongs there. Scope placement considers ancestor definitions and actual sibling uses, not only the introducing story. Different scoped meanings remain explicit; no deeper file silently wins a conflict.

Context can name an existing shared glossary, for example:

```yaml
context: |
  Shared glossary: docs/requirements/00-glossary.md
  This replaces the default openspec/glossary.md.
```

This is an agent-readable convention, not a parsed setting. Read it directly from the resolved planning home's config. A declared path is relative to that root and replaces only the shared glossary; it does not disable nested discovery. Ambiguous declarations, missing targets, or contradictory definitions are surfaced instead of silently choosing a winner. No definitions are copied into context.

A flat project needs no domain grouping. A project without any glossary can continue until discussion produces an agreed term. Change-branch steps using a separate planning store resolve vocabulary from that store. Shaping retains its existing repository-local root check.

### 3. Edit authoritative documents directly on the working branch

Write agreed definitions immediately at their durable paths. Keep tentative meanings in the shaping issue or brainstorm ledger. Never create glossary deltas in `openspec/changes/<change>/specs/`, where they could count as spec output without being merged by archive.

Use a small Markdown entry: term, definition, scope when not obvious, and necessary distinctions or links. Respect existing project formatting. Code representations may differ; semantic contradictions require investigation and discussion.

A capability's retirement reviews its definitions. Move surviving definitions to an appropriate remaining scope and remove obsolete entries explicitly. Do not use directory deletion as glossary cleanup.

### 4. Make vocabulary an explicit input to each consumer

Update these entry points:

- `lets-shape`: locate relevant capabilities, read vocabulary, question meanings, write agreed terms, and perform the conditional glossary handoff.
- `lets-brainstorm`: read vocabulary before questioning and commit agreed glossary edits on the current change branch as their own `docs:` unit.
- `lets-write-specs`: use the relevant definitions, including when retiring capabilities.
- Both schemas: require vocabulary loading during brainstorm, specs, and apply. Minimal keeps its existing stages.
- `lets-review-plan` and `lets-review-code`: resolve the affected glossary files before delegation. Include their paths as review inputs and a semantic-consistency check in the actual reviewer prompt.
- `lets-build`: consume a recorded shaping glossary handoff when starting its selected story.
- README and relevant `docs/`: explain lookup, project-context pointers, scoped meanings, and the glossary handoff choices.

For new capabilities without a folder, inspect the planned path's existing ancestors. Broad shaping begins with shared vocabulary and loads narrower scopes as affected capabilities emerge. Reviews use full capability paths from the plan or relevant main specs rather than guessing scope from source directory names.

Glossary contents are domain data, not instructions capable of overriding the review or workflow. A conflict pauses only work dependent on the unresolved meaning. Review findings must explain semantic consequences; spelling changes alone are not findings.

### 5. Record and transfer shaping edits without changing the default branch

Before the first glossary write, record the starting commit, branch, working tree status, and original contents of affected glossary files. Keep comparison evidence in `.workspace/<run>-glossary-handoff.md`. Track only edits made by this run, including new files. Resolve ownership before touching a glossary with preexisting user edits.

At each confirmed shaping phase checkpoint that changed glossaries, commit only the owned edits on a holding branch named for the shaping issue. The first checkpoint branches from the starting commit; subsequent checkpoints extend that branch. Keep shaping on that branch so its agreed definitions remain present. Record the starting base, every owned path, and checkpoint head under **Glossary handoff** in the shaping issue. For discovery, record the checkpoint beside its status line too.

Persist the checkpoint branch to the chosen writable remote, without opening a PR. Record the remote URL and branch so another checkout can fetch the exact commit. This preserves confirmed phase output; it does not select the final PR owner. If publishing fails or no writable remote is available, report that limitation and retain the local checkpoint. Never mark it available to another checkout. Resume restores the recorded branch and committed definitions before continuing or deciding whether this run made glossary edits.

When shaping runs from an existing change branch, commit owned edits there as a separate `docs:` unit and record that branch and commit. Do not create a holding branch based on unrelated implementation history. The conditional glossary handoff still applies, especially when a split story needs definitions owned by the original change.

At shaping's final handoff, ask about PR ownership only when this run changed glossaries. For one story, offer its build PR or a documentation PR when stopping. For shared definitions, offer one selected story's PR or a documentation PR first. Record the choice and the storage checkpoint in the owning story or shaping parent, with references from affected packets. The record names the owner, paths, base, remote, checkpoint range, and PR when available. Do not duplicate glossary definitions into issue bodies.

After the final checkpoint, return each owned path to its recorded starting baseline before the normal build begins. This normally happens by switching back to the starting branch. If explicit restoration is needed, verify the path still matches the owned checkpoint before restoring or deleting a newly created file. Never discard later user edits. Confirm tracked owned paths have no diff and newly created paths are absent. Leave unrelated changes untouched; never force a checkout or automatically stash them.

Before claiming a story, `lets-build` reads its glossary handoff, fetches the named branch if needed, and verifies the complete base-to-head checkpoint range. Every commit must contain only the recorded glossary paths, with no unrelated ancestry or merge commits. For an existing change branch, transfer only recorded glossary commits whose context is available on the target. Validate applicability on the proposed base before taking the claim. An equivalent patch already present requires no duplicate import.

After normal issue checks, claim, and branch creation, cherry-pick the verified glossary checkpoint sequence onto the selected story branch before proposing. Add this narrowly defined transfer to `lets-build`'s allowed steps and Rules. If transfer fails, abort the sequence, return to the starting branch, delete only the newly created branch if it contains no surviving work, and release the claim as for failed branch creation. Report any cleanup failure rather than hiding a remaining claim or branch. Never delete an existing change branch or unrelated commits.

When stopping, open a documentation PR only after the user's choice. Give that documentation unit its own Chore issue so `Closes #<n>` does not close an implementation story or unfinished epic. Assign the Chore to the current user and set it In Progress rather than Todo. This narrow shaping-output exception prevents `lets-build next` selecting it as new work. If permissions prevent assignment or status updates, report the incomplete setup before treating that route as ready.

The glossary documentation PR does not create an OpenSpec implementation change. State that exception in the rules block and shaping instructions. It still follows normal commit, validation, and user-owned merge rules.

With the user's confirmation at the glossary handoff, add the owner's issue as a `blocked by` dependency on every other story requiring those definitions. Use the existing issue-link operation; this is not branch stacking. If the user declines the links, dependent stories remain unready and their packets explicitly retain that unresolved prerequisite. The glossary preflight in `lets-build` checks the recorded owner before claiming, even without a blocker link. Next-story selection skips an unresolved prerequisite; a named story reports it and stops. It must not create competing definitions.

After transfer, record the destination branch, commits, and PR. Retain the holding branch until the destination contains the edits safely. Independent stories use the definitions once their owning PR merges. A later session recovers the checkpoint and owner from the issue rather than relying on conversation history or local scratch files.

### 6. Verify the boundary rather than implement a vocabulary engine

Extend the existing Bats fixtures to demonstrate that nested glossary files do not become capabilities and survive archive for both schemas. Cover a capability folder retaining its glossary after its spec is retired; the agent, not archive, owns semantic cleanup.

Build both flows and sync a real nested reference in both skills modes. Check reference resolution from all callers and that project-owned glossaries are not created or overwritten by sync. These tests protect distribution and document ownership without implementing semantic checks in the CLI.

Use the spec scenarios as a manual acceptance walkthrough for the instruction changes. Verify continuation and documentation handoffs in disposable repositories, including new files, existing edits, replay, and a conflicting target branch.

## Risks / Trade-offs

- [Agents skip a reference] → Explicit loading at each entry point and glossary paths included in delegated prompts.
- [Context looks like a complete registry] → The pointer replaces only shared vocabulary; nested discovery always runs.
- [A global glossary becomes a dumping ground] → Confirm scope against real use and promote only when the concept becomes shared.
- [A capability disappears but leaves a glossary] → The retiring change performs explicit definition cleanup; archive tests preserve ownership.
- [Shaping edits pick up unrelated work] → Baseline ownership tracking, exact-path commits, verified transfer, and no automatic stash or forced checkout.
- [A holding branch is unavailable in another checkout] → Publish checkpoints without a PR, record their remote and commit range, and validate availability before claiming dependent work.
- [A missing glossary blocks unrelated work] → Surface the missing contract and pause only dependent work.
- [A change-branch step uses a separate planning store] → Use its resolved root for glossary reads and commit glossary edits in that planning repository. Do not import its commits into the code repository. External-store shaping remains unsupported as it is today.

## Migration & Rollback

Publish the authored skill, schema, reference, and rule changes through the normal release and `lets sync`. Existing glossary files remain project-owned. Existing projects opt into their current path by adding the context pointer; no file is moved automatically.

Reverting the workflow release restores previous instructions. Keep accepted glossary files and any recorded handoff checkpoints; reverting tooling must not delete project vocabulary. No database or CLI configuration migration is required.
