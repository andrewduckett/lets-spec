# Domain language in a project

Use a shared glossary for concepts with the same meaning across the project.
Use optional `glossary.md` files within the existing capability hierarchy
for narrower meanings. A project does not need a glossary at every level.
The installed workflow's
[domain-language reference](../skills/lets-shape/references/domain-language.md)
contains the full agent rules.

For `backend/checkout` and `frontend/checkout`, agents read the selected
shared glossary, both domain glossaries, and both checkout glossaries when
those files exist. They deduplicate paths and inspect existing ancestors
for capabilities that have not been created yet. The default shared file
is `openspec/glossary.md`; `openspec/specs/glossary.md` is not a second
implicit shared scope.

An existing glossary can replace the shared default through project context:

```yaml
context: |
  Shared glossary: docs/requirements/00-glossary.md
  This replaces the default openspec/glossary.md.
```

The path is relative to OpenSpec's resolved planning root. Nested lookups
continue alongside this replacement. Missing or ambiguous declarations
need resolution, while absent conventional glossaries remain optional.
No setting parser or consumer glossary migration is introduced.

Before recording Order, ask whether siblings already use the same concept.
If checkout and fulfillment both do, propose their common scope. If
Checkout attempt is only local, keep it local. Different meanings of Account
in billing and identity need explicit distinctions where they interact.
Do not promote or duplicate a definition solely because names match.

## Recovering a shaping handoff

Agreed definitions are written immediately. Shaping records its baseline
and owned paths, makes glossary-only commits at confirmed phase boundaries,
and publishes the holding branch without selecting a PR owner yet. The
shaping issue records the remote URL, branch, base and checkpoint commits;
it is the recovery source for another checkout. A failed publication is
reported as local-only, so later build cannot silently assume it can fetch.
Preexisting or later user edits must be preserved, and unrelated changes
never become part of the checkpoint.

Only a run that changed glossary files asks who carries them. Choose one
story's PR or a documentation PR before independent implementations. The
latter gets a separate Chore issue, assigned and In Progress, with its own
`Closes` line and no OpenSpec implementation change. This exception does
not permit direct default-branch commits or an agent-owned merge.

Other story packets reference the selected owner, without copying its
definitions. You confirm blocker links; declining links still leaves an
unresolved prerequisite. Build checks ownership and availability before
claiming, validates every glossary commit and rehearses the import on the
proposed base. Equivalent edits already present need no second import.
Conflicts preserve user work, release the new claim, and report any Git
cleanup failure. Existing branches are never deleted as transfer cleanup.

A brainstorm on a change branch records accepted definitions in its own
`docs:` commit. For an external planning store, the glossary remains in
that repository; its commits are not imported into the code checkout.
Shaping itself retains its repository-local root restriction.
