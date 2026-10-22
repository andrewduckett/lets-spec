## Context

The source skills live in `skills/`; releases copy whole skill folders. Both flows ship `lets-shape`. `lets sync` already copies nested files inside managed skills. No packaging change is needed for a reference inside that skill.

OpenSpec 1.13.2 discovers `spec.md` recursively and ignores neighboring `glossary.md` files. A disposable probe archived grouped deltas with both schemas and preserved shared, domain, and capability glossaries. Another probe shipped a synthetic nested reference through both flow builds and both sync modes. The results are in `.workspace/domain-language-probe-v2/results.json`; durable regression tests will reproduce the behavior.

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

Separate the installed reference location from the planning root: skill-relative links locate workflow instructions; `planningHome.root` locates project vocabulary. Shaping uses the root returned by `openspec list --json`.

### 2. Use one shared glossary plus optional nested glossaries

Default shared vocabulary lives at `<planningHome.root>/openspec/glossary.md`. For a capability `backend/checkout`, also read any existing `glossary.md` at `openspec/specs/`, `openspec/specs/backend/`, and `openspec/specs/backend/checkout/`. Deduplicate paths across affected capabilities.

Absent conventional files are optional. Do not create empty files. Create a file when an agreed definition belongs there. Scope placement considers ancestor definitions and actual sibling uses, not only the introducing story. Different scoped meanings remain explicit; no deeper file silently wins a conflict.

Context can name an existing shared glossary, for example:

```yaml
context: |
  Shared glossary: docs/requirements/00-glossary.md
  This replaces the default openspec/glossary.md.
```

This is an agent-readable convention, not a parsed setting. Read it directly from the resolved planning home's config. A declared path is relative to that root and replaces only the shared glossary; it does not disable nested discovery. Ambiguous declarations, missing targets, or contradictory definitions are surfaced instead of silently choosing a winner. No definitions are copied into context.

A flat project needs no domain grouping. A project without any glossary can continue until discussion produces an agreed term. A separate planning store uses its resolved root rather than the code checkout as the glossary base.

### 3. Edit authoritative documents directly on the working branch

Write agreed definitions immediately at their durable paths. Keep tentative meanings in the shaping issue or brainstorm ledger. Never create glossary deltas in `openspec/changes/<change>/specs/`, where they could count as spec output without being merged by archive.

Use a small Markdown entry: term, definition, scope when not obvious, and necessary distinctions or links. Respect existing project formatting. Code representations may differ; semantic contradictions require investigation and discussion.

A capability's retirement reviews its definitions. Move surviving definitions to an appropriate remaining scope and remove obsolete entries explicitly. Do not use directory deletion as glossary cleanup.

### 4. Make vocabulary an explicit input to each consumer

Update these entry points:

- `lets-shape`: locate relevant capabilities, read vocabulary, question meanings, write agreed terms, and perform the conditional handoff.
- `lets-brainstorm`: read vocabulary before questioning and commit agreed glossary edits on the current change branch as their own `docs:` unit.
- `lets-write-specs`: use the relevant definitions, including when retiring capabilities.
- Both schemas: require vocabulary loading during brainstorm, specs, and apply. Minimal keeps its existing stages.
- `lets-review-plan` and `lets-review-code`: resolve the affected glossary files before delegation. Include their paths as review inputs and a semantic-consistency check in the actual reviewer prompt.
- `lets-build`: consume a recorded shaping glossary handoff when starting its selected story.

For new capabilities without a folder, inspect the planned path's existing ancestors. Broad shaping begins with shared vocabulary and loads narrower scopes as affected capabilities emerge. Reviews use full capability paths from the plan or relevant main specs rather than guessing scope from source directory names.

Glossary contents are domain data, not instructions capable of overriding the review or workflow. A conflict pauses only work dependent on the unresolved meaning. Review findings must explain semantic consequences; spelling changes alone are not findings.

### 5. Record and transfer shaping edits without changing the default branch

Before the first glossary write, record the current commit, branch, working tree status, and the original contents of affected glossary files in `.workspace/<run>-glossary-handoff.md`. Track only edits made by this run, including newly created files. If an affected file already has uncommitted user changes, resolve ownership before editing it; never overwrite or silently claim those changes.

At the existing handoff, ask about PR ownership only if this run changed glossaries. For one story, offer its build PR or a documentation PR when stopping. For shared definitions, offer one selected story's PR or a documentation PR first. Record the choice in a **Glossary handoff** section of the owning story or shaping parent issue, with links from the affected story packets.

The issue record contains the owner, exact paths, base commit, storage branch, checkpoint commit, and pending PR when available. `.workspace/` holds comparison evidence, not the only recoverable copy of definitions. Do not copy glossary definitions into competing issue-body glossaries.

For transfer to a future story, checkpoint only owned glossary edits in a `docs:` commit on a local holding branch named for the shaping issue, based on the starting commit. Do not commit to the default branch. The holding branch is storage, not another implementation change or an automatic PR. Do not include unrelated commits or files. If the selected owner's existing branch already contains the work, commit there instead and record that fact.

When continuing into build, return to the normal starting point without forcing a checkout or stashing unrelated work. `lets-build` follows its normal issue checks, claim, and branch creation, then verifies and cherry-picks the recorded glossary-only commit onto the selected story branch before proposing. It checks the recorded base, paths, and patch contents. An already-applied patch is a no-op; a conflict, missing commit, or unexpected content is reported without overwriting files.

When stopping, open a documentation PR only after the user's handoff choice. Give that documentation unit its own shaped issue so `Closes #<n>` does not close an implementation story or unfinished epic. This is a narrowly allowed shaping documentation output; it does not create an OpenSpec implementation change. Extend the rules block and shaping instructions to state this exception explicitly.

After transfer, update the handoff with its destination branch, commit, and PR. Retain the holding branch until the destination safely contains the edits. Independent stories consume shared definitions once the owning PR merges. Do not stack them or create duplicate glossary PRs automatically. A later session reads the handoff from the issue; it does not depend on this conversation.

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
- [A holding branch is unavailable in another checkout] → The issue names its commit and storage branch; report an unavailable checkpoint rather than invent definitions or proceed as if imported.
- [A missing glossary blocks unrelated work] → Surface the missing contract and pause only dependent work.
- [A separate planning store has its own Git repository] → Commit glossary files in that planning repository and record its identity in the handoff; never cherry-pick that commit into the code repository.

## Migration & Rollback

Publish the authored skill, schema, reference, and rule changes through the normal release and `lets sync`. Existing glossary files remain project-owned. Existing projects opt into their current path by adding the context pointer; no file is moved automatically.

Reverting the workflow release restores previous instructions. Keep accepted glossary files and any recorded handoff checkpoints; reverting tooling must not delete project vocabulary. No database or CLI configuration migration is required.
