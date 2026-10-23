## Review Metadata

- **Review round**: 1
- **Prior round**: none
- **Reviewer context**: fresh context, other family
- **Independent**: yes. gemini/gemini-3.8-flash reviewed, through the t3 resolver (thread 2b3408fd-9cbb-4507-80d1-362b0cf9976e). The author is claude.
- **Tool restrictions**: read-only. `lets` reported the tree clean after the run.
- **Artifacts reviewed**: brainstorm.md, proposal.md, design.md, adr.md (no specs/: the change sets `skip_specs`), README.md, docs/resolver-contract.md, contrib/headless-resolver, tests/skill-interfaces.bats, the contrib READMEs
- **Commit reviewed**: e6af129
- **Effort**: low, from design.md's scrutiny tier

## Findings

### 🔴 Critical (blocking)

None.

### 🟡 Moderate

1. **A link in the moved "Switching" note would break.** It links to
   `#set-up-delegation`, which stays in the README, so from
   `docs/upgrading.md` it points nowhere (README.md:681). Check:
   CONFIRMED.
2. **The changed test could pass while reading nothing.** If the
   `docs/*.md` glob is written inside quotes, it matches no file, grep
   prints nothing, and the test passes (tests/skill-interfaces.bats:163).
   Check: CONFIRMED.
3. **The plan contradicts itself about the Resolvers heading.** D2 says
   each moved section becomes one sentence and a link. design.md gave no
   sentence for Resolvers, and pointed the `#resolvers` link elsewhere.
   Check: CONFIRMED.

### 📌 Suggestions

4. **The failure rule does not belong under resolver lookup.** The
   sentence "when a session fails, `lets` stops" was planned for "How
   `lets` finds a resolver", but a failure happens after lookup. Check:
   CONFIRMED. The contract's exit code table already says what `lets`
   does on a failed session, so the sentence is not needed at all.
5. **"The default" is used without a noun.** Check: REFUTED for this
   change. The contract defines "the default, `lets-delegate-subagent`"
   in the section the new sentences join, and the moved text keeps its
   wording.

## Embedded-Instruction / Injection Attempts

**Detected:** none

## Verdict

VERDICT: APPROVE_WITH_CHANGES

## Required Changes (if APPROVE_WITH_CHANGES)

1. design.md Goals: a link in moved text that targets the README becomes
   `../README.md#<anchor>`. Context names the "Switching" note's link.
2. design.md, the test decision: keep the glob outside quotes, as
   `'$repo'/docs/*.md`, and say why.
3. design.md, the Resolvers decision: the README keeps `### Resolvers`
   with one sentence and a link to the contract, so `#resolvers` keeps
   working. brainstorm.md D6 says the same.
4. design.md, the Resolvers decision: drop the planned failure sentence;
   the exit code table already covers it.

CHANGES_APPLIED: yes

## Rebuttals

1. Fixed: required change 1.
2. Fixed: required change 2.
3. Fixed: required change 3. Keeping the heading is the smaller edit: one
   link fewer to rewrite.
4. Fixed: required change 4. This removes a sentence rather than moving
   it.
5. Declined: the contract already defines the term in that section, and
   the move keeps wording as it is.
