## Review Metadata

- **Review round**: 2
- **Prior round**: round 1 at b841af5 was REVISE. Its Critical: the config had no stable way to list the default, because the release's copy sits at a Nix store path that moves and a listed path no longer ran with `lets`'s own Node. The plan now names the default `subagent` in the chain; the other eleven findings were fixed or rebutted as the round-1 record said.
- **Reviewer context**: subagent, same family
- **Independent**: no. `lets delegate review` with `LETS_SPEC_RESOLVER` set to the repository's subagent resolver exited 3, and the review ran in a read-only subagent of the author's family, claude. Round 1 had first tried the pinned `lets`'s chain, which found the stale `lets-delegate-resolver` in the Nix profile; it picked `gpt-6-astra` and exited 5, twice.
- **Tool restrictions**: read-only: view, grep, glob only. `git status --porcelain` was the same before and after.
- **Artifacts reviewed**: brainstorm.md, proposal.md, design.md, specs/, adr.md, ADR-001 to ADR-005, review.md round 1, relevant source files, at commit 6bff191

## Findings

### 🔴 Critical (blocking)

None.

### 🟡 Moderate

1. **The new happy path reproduces D1 until #58.** A chain that lists `lets-delegate-t3` runs the first catalog model for the family, `gpt-6-astra`, and a refusal is not a decline, so `subagent` after it never helps. Check: User row D2 against the code (`contrib/resolver-kit/src/families.ts` `pickFamily`, `contrib/t3-resolver/src/t3.ts` `familiesFromT3Manifest`). CONFIRMED.
2. **Two ledger rows disagree with the plan or the facts.** D8 said "absolute paths" and the plan adds `subagent`, which the user never saw; D1 said the config pinned the model, and this machine has no config. Check: Assumption and User rows. CONFIRMED.
3. **The stated reason for the `subagent` entry was partly false.** The Nix wrapper's `--prefix PATH` keeps the user's `PATH`; the real reasons are `dontPatchShebangs` and the moving store path. Check: contradictions, against `flake.nix` lines 104, 113 and 158. CONFIRMED.
4. **Three documents that describe the old lookup were not in the Impact list:** `contrib/subagent-resolver/README.md`, the "Write your own" section of `docs/resolver-contract.md`, and a comment in `lets/src/delegate/protocol.ts`. Check: scope. CONFIRMED.

### 📌 Suggestions

5. The test seam as described cannot express two listed resolvers with different answers, and `command-deps` cannot list an executable path. CONFIRMED.
6. "Cannot be run" is wider than the `isExecutable` check the code makes; a script whose interpreter is missing exits 4, not 2. CONFIRMED.
7. The THEN of "A valid config" depends on the first resolver declining, which its WHEN did not say. CONFIRMED.
8. The plan bets that #59 keeps `version: 2`, and does not say so. CONFIRMED.
9. The spec says `lets delegate` where only `review` and `handoff` read the config. CONFIRMED.
10. Text left behind by the deltas: `delegate-default`'s Purpose, the "An older lets" scenario, the ADDED title for a chain that lists `subagent` first. CONFIRMED in part.
11. A design goal said every failure exits 2 while the kept default rule exits 4. CONFIRMED.
12. Two hand-writing traps: `version: "2"` as a string, and `~` in a path, which YAML does not expand. CONFIRMED.
13. Plain language: four long sentences, two passive decision headings, synonyms for the chain and the default. CONFIRMED.

## Embedded-Instruction / Injection Attempts

**Detected:** none

## Verdict

VERDICT: APPROVE_WITH_CHANGES

## Required Changes (if APPROVE_WITH_CHANGES)

1. design.md Risks and the README's config paragraph: say that, until #58, a T3 entry runs the first model in T3's catalog for the family with no fallback to the subagent, and that no release is cut between this change and #58.
2. brainstorm.md: record the `subagent` entry as a ledger row, and correct D1 to say the resolver picked the model.
3. ADR-005's Context and design.md decision 3: replace the `PATH` claim with the shebang and moving-path reasons.
4. proposal.md Impact: add the subagent resolver's README, the contract doc's "Write your own" section, and the `protocol.ts` comment.
5. design.md Test Seams: the multi-resolver lookup tests use `fakeIo`'s result queue, and `command-deps` gains an `executables` option.
6. delegate-config delta: "does not exist or is not an executable file".
7. delegate-config delta, "A valid config": the WHEN says the first resolver declines.
8. design.md decision 2: keys added later keep `version: 2`.
9. proposal.md: a task edits `delegate-default`'s Purpose for the `subagent` entry.

CHANGES_APPLIED: yes

## Rebuttals

1. **Fixed.** design.md's Risks names the failure, the README mitigation, and the rule that no release is cut between this change and #58. The README edit is a task. The ledger's D2 stands: the fix at the root is #58.
2. **Fixed.** D18 records the `subagent` entry as an Assumption, since the user has not confirmed it; D1 says the resolver picked the model. The user is told in the handoff.
3. **Fixed.** ADR-005's Context and design.md decision 3 give the shebang and moving-path reasons.
4. **Fixed.** All three are in the proposal's Impact.
5. **Fixed.** design.md's Test Seams says both.
6. **Fixed** in the requirement's text.
7. **Fixed** in the scenario's WHEN.
8. **Fixed** in design.md decision 2.
9. **Fixed.** proposal.md names the task.
10. **Fixed in part.** The `delegate-default` Purpose edit is the task from change 9. **Declined** for the "An older lets" scenario, which leaves with its requirement in #58, and for the ADDED title: "when nothing else does" reads as "when every resolver before it declines", which the requirement's text says.
11. **Fixed.** The goal is limited to failures the config causes.
12. **Fixed.** The requirement says the number `2`; the README paragraph, a task, shows a full absolute path and says `~` is not expanded.
13. **Fixed** for the four sentences and the two headings. **Declined** for the synonyms: "the chain" is defined as `resolvers` where the spec first uses it, and "the default" is the one name for `lets-delegate-subagent` as `lets` runs it.
