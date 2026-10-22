# Verification: shared-domain-language

Using change: shared-domain-language (lets-standard).

## Completeness

All 11 tracked tasks are complete. OpenSpec status reports every planning
artifact done and apply reports all_done. The delta defines 15 ADDED
requirements with 30 scenarios; tasks.md maps every scenario to its
implementation-time walkthrough and separately records automated evidence.
No required artifact or tracked task is missing.

## Correctness

All 15 requirements map to authored workflow instructions:

- Vocabulary loading, context replacement, and missing-pointer handling:
  the shared domain-language reference, shaping/brainstorm/spec-writing skills,
  both schemas' brainstorm/specs/apply instructions, and source AGENTS rules.
- Developing language, scope confirmation, immediate recording, tentative
  candidates, explicit scope distinctions and promotion without duplication:
  the shared reference plus shaping and brainstorming entry points.
- Semantic consistency and conflict handling: the reference, both apply
  instructions and both delegated review prompts. Spelling differences alone
  are explicitly excluded from conflict findings.
- Conditional shaping ownership, carrying edits through one PR, and shared
  owner prerequisites: shaping checkpoint/handoff instructions, optional
  issue recovery template, and build ranking/preclaim/import/cleanup steps.
- Capability retirement: reference/spec-writing/apply instructions and the
  explicit CLI retirement setting, with compatibility tests proving the
  glossary remains project-owned when its spec disappears.

All 30 scenarios were checked by manual instruction walkthroughs. Automated
release/sync/CLI/interface tests cover distribution, preservation, capability
IDs, retirement and emitted reference resolution. Disposable Git rehearsals
cover cross-checkout recovery and import/abort behavior; claim release was
simulated locally. These checks verify instructions and boundaries, not
future agents' judgment or live GitHub permission failures. No scenario is
claimed as an automated semantic evaluation.

The independent code review's ten findings have targeted fixes recorded in
code-review.md. Actual emitted-instruction and symlinked-root regressions
were observed failing before their fixes. No review finding remains open.

## Coherence

Implementation follows all six design decisions: one reference in a shipped
skill, one selectable shared source with optional nested scopes, direct
project-owned glossary edits outside delta directories, explicit consumer
inputs, durable owned checkpoints and one PR owner, and boundary tests rather
than a vocabulary parser. No new mandatory review stage, runtime engine,
configuration field, consumer migration or ADR was introduced.

File layout and tests follow existing project conventions. Source skills,
schemas and overlay rules changed; generated copies remain untouched. The
post-review root fix distinguishes the installed method in the code checkout
from project vocabulary in the resolved planning home, including a store.

## Assessment

No critical issues, warnings or suggestions remain from this verification.
Applicable task, coverage, implementation mapping, scenario, design and
pattern checks were performed. The explicit test limits above are the
planned evidence boundary. This report does not claim cross-platform builds
or a live multi-agent behavioral evaluation.

Final project check results are recorded in tasks.md and the PR description.

## Archive validation

The user selected sync and archive. The new main shared-domain-language
spec preserves the delta's Purpose, all 15 requirement blocks and all 30
scenarios, with the delta operation header converted to Requirements.
A full body comparison confirmed nothing remains to sync.
`openspec validate --specs --strict` passed all six main specs.
