## Purpose

Keep agreed domain meanings consistent from shaping through implementation and review, while supporting shared vocabulary and narrower definitions within a project's domain and capability hierarchy.

## ADDED Requirements

### Requirement: Read the relevant vocabulary throughout the workflow

Agents SHALL read the shared glossary and applicable ancestor and affected-scope glossaries during shaping, brainstorming, spec writing, and implementation in both supported flows, and during reviews where the flow includes them. Missing optional scoped glossaries SHALL NOT require creating files or changing a flat capability layout.

#### Scenario: Work spans domains
- **WHEN** a story affects backend checkout and frontend checkout
- **THEN** the agent reads shared vocabulary and the ancestor and local glossaries for both affected capability paths before using their terms

#### Scenario: A flat project has no scoped glossaries
- **WHEN** a project uses flat capability paths and has only a shared glossary
- **THEN** the agent uses that glossary without introducing domain folders or empty scoped glossaries

#### Scenario: Implementation and review use the same definitions
- **WHEN** implementation or a review starts after the story was planned
- **THEN** the agent reads the relevant glossaries rather than assuming the earlier planning session supplied their contents

#### Scenario: The minimal flow has no plan review stage
- **WHEN** a story follows the minimal flow
- **THEN** its shaping, brainstorm, specs, and implementation use relevant vocabulary without adding a mandatory plan review stage

### Requirement: Select an existing shared glossary through project context

An explicit shared-glossary pointer in OpenSpec project context SHALL replace the default shared glossary. Agents SHALL resolve that pointer relative to the resolved planning root and continue to read applicable nested glossaries. The pointer SHALL use the existing free-text context mechanism without requiring a new configuration field or parser.

#### Scenario: A project has an established glossary
- **WHEN** project context declares `docs/requirements/00-glossary.md` as replacing the default shared glossary
- **THEN** the agent reads that file from the planning root as the shared vocabulary source and does not create a competing default glossary

#### Scenario: No replacement is declared
- **WHEN** project context contains no shared-glossary pointer
- **THEN** the agent uses the documented default glossary convention

### Requirement: Report a missing declared glossary

Agents SHALL report a missing file explicitly declared as the shared glossary rather than silently substituting another glossary.

#### Scenario: The context pointer is stale
- **WHEN** the declared shared-glossary file does not exist
- **THEN** the agent identifies the missing declared path and does not treat a default glossary as its replacement without resolving the discrepancy

### Requirement: Develop unified language before writing stories and requirements

Shaping and brainstorming SHALL use established domain meanings and actively surface ambiguous or conflicting terminology before relying on it in issue packets or requirements.

#### Scenario: A request uses an established term with another meaning
- **WHEN** a shaping discussion uses Session to mean an authentication session while the applicable glossary defines a game session
- **THEN** the agent surfaces the distinction for discussion before writing a story that relies on either meaning

#### Scenario: A story packet uses the agreed concept
- **WHEN** the user resolves the ambiguous terminology during shaping
- **THEN** subsequent issue packets use the agreed concept consistently instead of deferring reconciliation to each story's brainstorm

### Requirement: Confirm the narrowest applicable scope

Before recording a new definition, the agent SHALL propose and confirm its meaning and the narrowest scope covering its intended uses with the user. The proposal SHALL account for existing definitions in ancestors and actual uses in sibling capabilities rather than choosing solely by the introducing story or hypothetical reuse.

#### Scenario: A new concept is already shared by siblings
- **WHEN** checkout introduces Order and fulfillment uses the same concept
- **THEN** the agent proposes their common scope for the definition before recording it

#### Scenario: A concept is local to one capability
- **WHEN** Checkout attempt is used only within checkout and has no established shared meaning
- **THEN** the agent proposes checkout's scope without promoting the term solely for possible future reuse

### Requirement: Record agreed definitions immediately

Shaping and brainstorming SHALL write a definition to the appropriate project-owned glossary once the user agrees on its meaning and scope, without waiting for implementation or the end of shaping.

#### Scenario: Meaning and scope are settled during shaping
- **WHEN** the user agrees on a new definition and its scope before implementation stories start
- **THEN** shaping writes that definition immediately so subsequent stories can use it

#### Scenario: A brainstorm settles a new definition
- **WHEN** the user agrees on the meaning and scope of a term during a story's brainstorm
- **THEN** the agent updates the appropriate glossary as part of the current change

### Requirement: Keep tentative meanings out of authoritative glossaries

Agents SHALL retain unresolved terms and candidate meanings explicitly as tentative in the shaping issue or brainstorm ledger until the user agrees on meaning and scope.

#### Scenario: Candidate definitions remain unresolved
- **WHEN** the user is still choosing between two meanings of Session
- **THEN** the issue or ledger retains the candidate meanings as tentative and neither is written as an agreed glossary definition

### Requirement: Preserve explicit meaning boundaries between scopes

Nested definitions SHALL narrow scope without silently overriding an ancestor definition. Different meanings of the same term SHALL be explicitly distinguished where their scopes interact.

#### Scenario: A local meaning conflicts with an ancestor
- **WHEN** a proposed local definition of Account differs from the inherited shared definition
- **THEN** the agent surfaces the difference for resolution rather than silently treating the local definition as taking precedence

#### Scenario: Sibling domains use the same word differently
- **WHEN** identity and billing use Account for distinct concepts in a story spanning both domains
- **THEN** the agent preserves their explicit scoped meanings and qualifies the term where necessary to distinguish the concepts

### Requirement: Promote shared definitions without duplication

When a local concept becomes shared, agents SHALL move its definition to the appropriate common scope and update references rather than leave competing copies. Differing meanings SHALL be reconciled before treating them as one shared definition.

#### Scenario: Another domain adopts a local concept
- **WHEN** a second domain adopts the same concept previously defined in a local glossary
- **THEN** the definition moves to the common scope and local references point to that single definition

#### Scenario: Similar names conceal different meanings
- **WHEN** sibling glossaries define Account differently
- **THEN** the agent resolves whether these are distinct concepts before promoting either as a shared Account definition

### Requirement: Preserve domain meaning across code representations

Vocabulary checks SHALL evaluate semantic consistency rather than require identical English spelling or implementation structure. Agents SHALL prefer recognizable domain names where practical and explain non-obvious mappings rather than impose a blanket ban on synonyms.

#### Scenario: Code uses its language's naming convention
- **WHEN** Checkout attempt is represented as `CheckoutAttempt` or `checkout_attempt` with the agreed meaning
- **THEN** the naming difference alone produces no glossary-conflict finding

#### Scenario: An implementation boundary explains a different representation
- **WHEN** a persistence model or state machine represents the agreed concept differently
- **THEN** the agent investigates the mapping before judging it inconsistent and explains a non-obvious mapping when needed

### Requirement: Resolve semantic conflicts before continuing affected work

When a later workflow step discovers an apparent semantic conflict, agents SHALL investigate and surface it for discussion before continuing work that depends on the unresolved meaning. Existing code SHALL NOT silently redefine an agreed concept; unrelated work can continue.

#### Scenario: A substantive code conflict is found
- **WHEN** the glossary allows an Order before payment but code treats every Order as a completed payment and investigation does not explain the difference
- **THEN** the agent surfaces the contradiction and pauses work dependent on that meaning until it is resolved, without blocking unrelated work

### Requirement: Ask about glossary ownership only when shaping made glossary edits

At shaping's glossary handoff, the agent SHALL ask how to carry forward glossary edits made during that run. When the run made no glossary edits, the agent SHALL retain the existing handoff without a glossary-specific PR question. Unrelated working-tree changes SHALL NOT trigger that question.

#### Scenario: Shaping changed vocabulary
- **WHEN** shaping ends with glossary edits made during the run
- **THEN** the agent asks which branch and PR will carry those edits without asking again whether the definitions are accepted

#### Scenario: Shaping made no glossary edits
- **WHEN** shaping ends without glossary edits, even though unrelated files have changes
- **THEN** the agent uses the existing handoff without asking about a glossary PR

### Requirement: Carry glossary edits forward through the selected PR

For a single story, the glossary handoff SHALL offer to carry glossary edits into that story's build branch and PR, or open a documentation PR if the user stops after shaping. The glossary handoff SHALL record where the edits live for a later build session. It SHALL NOT publish them directly to the default branch or merge a PR without the user's instruction.

#### Scenario: The user continues into build
- **WHEN** the user chooses to build the single shaped story
- **THEN** the glossary edits travel with that story's branch and PR and their location is recorded for the build session

#### Scenario: The user stops after shaping
- **WHEN** the user chooses to stop after shaping with glossary edits present
- **THEN** the agent offers a documentation PR and follows the user's choice rather than automatically creating or merging it

### Requirement: Choose one owner for vocabulary shared by several stories

When several shaped stories share new definitions, the glossary handoff SHALL ask whether a selected story's PR carries the glossary edits or a separate documentation PR lands first. It SHALL record the selected owner so other stories can reference the definitions without copying them into competing PRs or automatically stacking independent stories. Agents SHALL seek user confirmation for blocker links to the owner and keep dependent stories unready until that prerequisite is resolved.

#### Scenario: A story PR owns the shared definitions
- **WHEN** the user selects checkout's PR to carry definitions also needed by fulfillment and confirms the blocker link
- **THEN** the glossary handoff records that ownership and fulfillment's issue records checkout's issue as its blocker

#### Scenario: Shared documentation precedes independent implementations
- **WHEN** the user selects a documentation PR for the shared definitions and confirms blocker links for both stories
- **THEN** the glossary handoff records that PR as their owner and both stories record the documentation issue as their blocker

#### Scenario: The user declines blocker links
- **WHEN** the user declines blocker links while a story still needs definitions from an unmerged owner PR
- **THEN** the issue packet retains that unresolved prerequisite and build selection does not claim the story until it is resolved

### Requirement: Review glossary definitions when retiring a capability

The change retiring a capability SHALL review its scoped definitions, move those still used elsewhere to the appropriate remaining scope, and remove obsolete definitions. Removing a spec SHALL NOT by itself delete its glossary.

#### Scenario: A retired capability has surviving concepts
- **WHEN** checkout retires but fulfillment still uses a definition owned by checkout's glossary
- **THEN** the retiring change moves the definition to the appropriate remaining scope and updates references

#### Scenario: A retired capability's definition is obsolete
- **WHEN** a definition in the retired scope is no longer used
- **THEN** the retiring change removes it after reviewing its use rather than deleting the whole glossary merely because the spec was removed
