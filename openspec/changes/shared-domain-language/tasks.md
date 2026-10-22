## Verification approach

Implement only after a new apply request. Use the pinned development environment; every heavy command goes through `deli`.

Write meaningful regression tests first at the existing release, sync, and OpenSpec boundaries. A regression that already passes records existing compatibility; do not manufacture a failure or add tests that merely repeat instruction text.

For instruction changes, interface checks verify referenced paths, command names, and schema structure. They do not prove agent judgment. Before ticking those tasks, also record the relevant scenario walkthrough and its observed result on the task line or in Acceptance Evidence below.

## 1. Shared reference and compatibility

- [x] 1.1 [medium] Make the domain-language reference available through both published flows: add `skills/lets-shape/references/domain-language.md` with the reviewed lookup, context-pointer, scope, semantic-consistency, and lifecycle rules; prove real nested-file distribution through release and sync fixtures in committed and ignored modes, without initializing or overwriting project glossaries (✓ deli -- nix develop --command bats tests/release-build.bats tests/sync-skills.bats passed: 48 tests; new reference tests first failed on the absent file).
- [x] 1.2 [medium] Preserve project-owned glossary files across OpenSpec operations: extend `tests/openspec-compat.bats` for both schemas with unchanged capability IDs, grouped delta archive, and capability retirement leaving glossary cleanup to the author (✓ deli -- nix develop --command bats tests/openspec-compat.bats passed: 15 tests across both schemas; compatibility already supported, no runtime change).

## 2. Workflow integration [depends-on: 1]

- [x] 2.1 [medium] Make shaping use and develop agreed vocabulary: update `skills/lets-shape/SKILL.md` to read the reference, resolve shared and affected-scope definitions, ask about meaning and scope, write accepted terms immediately, and retain tentative terms in the issue; walk the ambiguity, local-scope, shared-scope, and missing-pointer scenarios (✓ 12 skill-interface tests passed; manual walkthrough: Session ambiguity pauses dependent packets, sibling Order uses common scope, local Checkout attempt stays local, stale pointer reports its path).
- [x] 2.2 [complex] Preserve shaping glossary edits between sessions: document baseline ownership, glossary-only phase checkpoints, remote publication without a PR, issue-based resume, and safe restoration in `lets-shape`; rehearse a new glossary, unrelated edits, interrupted shaping, and recovery from a second clone using a disposable local bare remote (✓ git diff --check passed; disposable bare-remote rehearsal passed new glossary, preexisting and unrelated edits, interrupted phase recovery in second clone, two published checkpoints, later-edit detection and baseline restoration).
- [x] 2.3 [medium] Give shaped vocabulary exactly one PR owner: implement the conditional glossary handoff in `lets-shape`, including the selected story route, an assigned In Progress documentation Chore, user-confirmed blocker links, and the unresolved-prerequisite path; walk single-story, multi-story, stopped, and change-branch split cases (✓ 12 interface tests passed; manual walkthrough: one story selects its build PR, shared terms select one owner, stopped run offers docs Chore assigned/In Progress, change-branch split references original owner, declined links retain unresolved Depends on).
- [x] 2.4 [complex] Make `lets-build` safely consume the recorded glossary handoff: add preclaim owner and checkpoint verification, skip unresolved next-story candidates, authorize glossary-only imports, and recover failed transfers without stranding claims or deleting existing branches; rehearse success, replay, missing checkpoints, and a conflicting target in disposable Git repositories (✓ git diff --check passed; disposable Git rehearsal passed preflight, import, equivalent replay, missing checkpoint, conflict abort, new-branch deletion and existing-branch preservation; claim release simulated locally (no live Project mutation)).
- [x] 2.5 [medium] Make both flows load vocabulary through planning and implementation: update `lets-brainstorm`, `lets-write-specs`, and both source schemas to read the shared reference and relevant glossary inputs with the correct root field; extend interface checks to resolve every reference in its shipped flow, and walk standard/minimal consumption plus capability retirement (✓ 28 interface/compatibility tests passed; published standard and minimal reference links resolve; manual walkthrough confirms planningHome.root for artifacts, root.path for apply, fresh glossary loading without a minimal review stage, and explicit retirement cleanup).
- [x] 2.6 [medium] Give delegated reviewers the relevant definitions explicitly: update `lets-review-plan` and `lets-review-code` prompt construction guidance to include affected glossary paths and semantic checks while treating glossary text as domain data; inspect concrete plan and code review prompts for a cross-domain example and a harmless code-naming difference (✓ 14 interface tests passed; inspected concrete plan/code prompt fixtures listing shared and four backend/frontend glossary paths, Order-before-payment contradiction, harmless CheckoutAttempt casing, and domain-data trust boundary).
- [x] 2.7 [easy] Explain the vocabulary convention and glossary handoff to users: update README, relevant documentation, and the source `overlays/AGENTS.md` rules with shared-reference loading, the context-pointer example, optional nested scopes, and the narrowly scoped shaping documentation-PR exception; leave generated copies untouched (✓ git diff --check passed; README, domain-language guide and source rules document pointer, optional scopes and the glossary docs-PR exception; generated copies untouched).

## 3. Acceptance [depends-on: 2]

- [x] 3.1 [medium] Confirm the workflow meets the spec: record acceptance evidence for all 30 scenarios, including cross-checkout recovery, declined blockers, preexisting edits, and transfer cleanup; distinguish manual instruction walkthroughs from automated boundary coverage, then run the complete project test suite (✓ deli -- nix develop --command pnpm test passed: Node tests, typecheck, four resolver conformance suites and 111 Bats tests; all 30 scenario walkthroughs and Git rehearsal limits recorded below).
- [ ] 3.2 [easy] Confirm every release flow builds and ships its references with no project-owned glossary changes (verify: deli -- nix flake check).

## Acceptance Evidence

The following are implementation-time manual instruction walkthroughs, not
agent execution evals. Each walkthrough checks the concrete condition and
required next action against the shipped source instructions. Automated
boundary evidence and executed Git rehearsals are listed separately below.
No live issues, dependency links or Project claims were changed by rehearsals.

| # | Spec scenario | Walkthrough result and implementation evidence |
|---|---|---|
| 1 | Work spans domains | Pass: reference lookup enumerates shared plus backend/frontend ancestor and checkout files, deduplicated; both schemas and consumers load them. |
| 2 | A flat project has no scoped glossaries | Pass: reference makes absent files optional and forbids empty glossaries or forced grouping. |
| 3 | Implementation and review use the same definitions | Pass: both apply blocks reload through root.path; review prompts carry resolved paths rather than inherited session context. |
| 4 | The minimal flow has no plan review stage | Pass: minimal brainstorm/specs/apply load vocabulary; its artifact set remains brainstorm/specs/tasks. |
| 5 | A project has an established glossary | Pass: reference and docs select docs/requirements/00-glossary.md from context relative to the planning root, replacing only the shared default. |
| 6 | No replacement is declared | Pass: reference selects openspec/glossary.md; no second implicit specs-root scope. |
| 7 | The context pointer is stale | Pass: shaping, reference and planning consumers report the declared path and stop dependent work without default substitution. |
| 8 | A request uses an established term with another meaning | Pass: shaping's Session example surfaces authentication/game ambiguity before dependent packets. |
| 9 | A story packet uses the agreed concept | Pass: shaping requires subsequent packets to use the resolved concept rather than defer reconciliation. |
| 10 | A new concept is already shared by siblings | Pass: Order used by checkout and fulfillment proposes their common scope after ancestor/sibling inspection. |
| 11 | A concept is local to one capability | Pass: Checkout attempt stays local when actual use is local; hypothetical reuse does not justify promotion. |
| 12 | Meaning and scope are settled during shaping | Pass: shaping writes accepted definitions immediately and checkpoints them at confirmed phase boundaries. |
| 13 | A brainstorm settles a new definition | Pass: brainstorm writes immediately and commits a separate docs unit in the current planning change repository. |
| 14 | Candidate definitions remain unresolved | Pass: shaping issue or brainstorm ledger labels candidates tentative and keeps them out of authoritative glossaries. |
| 15 | A local meaning conflicts with an ancestor | Pass: reference prohibits a deeper Account definition from silently overriding an ancestor. |
| 16 | Sibling domains use the same word differently | Pass: reference preserves explicit identity/billing distinctions and qualifies interacting uses. |
| 17 | Another domain adopts a local concept | Pass: reference moves the definition to common scope and updates references to one source. |
| 18 | Similar names conceal different meanings | Pass: reference requires reconciling distinct concepts before treating Account as shared. |
| 19 | Code uses its language's naming convention | Pass: concrete review prompt fixtures accept CheckoutAttempt/checkout_attempt when meanings match. |
| 20 | An implementation boundary explains a different representation | Pass: reference and both review skills investigate persistence/state-machine mappings and explain non-obvious mappings. |
| 21 | A substantive code conflict is found | Pass: Order-before-payment versus every-Order-paid is a substantive contradiction; investigate and pause dependent work only. |
| 22 | Shaping changed vocabulary | Pass: glossary handoff compares owned edits/checkpoints to baseline and asks PR ownership, without reopening accepted definitions. |
| 23 | Shaping made no glossary edits | Pass: unrelated diffs do not trigger a glossary question; recovered owned checkpoints do count. |
| 24 | The user continues into build | Pass: selected story records checkpoint and owner; build preflights before claim and imports only verified glossary commits before propose. |
| 25 | The user stops after shaping | Pass: documentation PR is offered and created only on choice, with a separate assigned/In Progress Chore and user-owned merge. |
| 26 | A story PR owns the shared definitions | Pass: checkout is the single owner; user-confirmed fulfillment blocked-by link is added to fulfillment using the documented issue edit operation. |
| 27 | Shared documentation precedes independent implementations | Pass: the docs Chore owns definitions; each affected story gets a confirmed blocker and reference to the durable handoff. |
| 28 | The user declines blocker links | Pass: packets retain explicit unresolved Depends on; build preflight skips next candidates or stops a named story before claim. |
| 29 | A retired capability has surviving concepts | Pass: reference, spec writing and apply require reviewing remaining use and moving surviving definitions with references. |
| 30 | A retired capability's definition is obsolete | Pass: obsolete entries are explicitly removed after use review; whole-folder deletion is not authorized by spec retirement. |

### Automated boundaries

- Release/sync suites: 48 tests passed. The real nested reference ships in
  standard and minimal releases and installs in committed and ignored modes.
  Sync neither initializes a shared glossary nor overwrites shared, nested
  or explicitly selected project files. New reference tests first failed on
  the absent authored file.
- OpenSpec compatibility suite: 15 tests passed across both schemas.
  Glossaries do not alter full capability IDs; grouped archive preserves
  bytes; explicit retire_capabilities deletes the spec and leaves glossary
  cleanup to its author. These are existing CLI guarantees, not new runtime
  behavior. The first retirement fixture needed the CLI's explicit flag.
- Skill interfaces: 14 tests passed. New planning and review input tests
  first failed on missing links, then resolved every linked reference inside
  each published flow. These checks do not prove agent semantic judgment.

### Executed disposable Git rehearsals

- Checkpoint rehearsal: created a new glossary on a holding branch, published
  to a disposable bare remote, resumed the exact checkpoint in a second clone,
  extended it and recovered the published head in the first clone. Verified
  two glossary-only commits and no merges. Preexisting glossary edits were
  detected and preserved before writing. Unrelated files stayed untouched;
  later user edits were detected and preserved before safe baseline return.
- Transfer rehearsal: imported the recorded commit on a disposable preflight
  worktree before touching the selected branch, then imported successfully.
  Verified equivalent patch replay needs no second commit and a missing
  checkpoint fails availability checks. A conflicting target failed cherry-pick;
  abort restored its base, only the new empty branch was deleted, and an
  existing change branch survived. Claim release was a local marker simulation,
  not a live GitHub test. The first script run needed to recreate a directory
  removed by branch switching; the corrected fresh-repository run passed.
- Inspected concrete plan/code review prompts with absolute shared and four
  scoped paths for backend/checkout and frontend/checkout. Both include
  Order-before-payment semantics, harmless casing, and the domain-data trust
  boundary. No delegated semantic evaluation is claimed.

Scratch scripts and prompt fixtures are under .workspace/ and are not
release artifacts. Durable results are recorded here.

## Deviations Ledger

No design departures. Acceptance inspection found that replacing an issue
body during parent-to-story conversion or reshaping could lose checkpoint
metadata. The shaping instructions now explicitly preserve the complete
Glossary handoff record in both paths and recover it for a resumed single
issue. This closes the existing durability requirement without new scope.
