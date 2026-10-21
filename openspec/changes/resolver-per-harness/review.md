## Review Metadata

- **Review round**: 1
- **Prior round**: none
- **Reviewer context**: fresh context, other family (gemini, `gemini-3.8-flash-medium` in T3 Code, thread `0171e642-7a2c-49ca-8a25-36c2bcee6492`)
- **Independent**: yes. The plan's author is claude, and the meta line says `"independent": true`.
- **Tool restrictions**: read-only. The run checks the tree, and `gitClean` was true afterwards.
- **Artifacts reviewed**: brainstorm.md, proposal.md, design.md, specs/, adr.md, ADR-003, relevant source files, at commit `1c2e038`
- **How it ran**: The pinned `lets` 0.4.0 and the installed resolver predate the delegate config, and their default `gpt` model failed (exit 5, twice). So the review ran through this repository's working-tree `lets` and resolver, at `main`'s code, with a one-run config that names only a `gemini` reviewer.

## Findings

### 🔴 Critical (blocking)

1. **Tests cannot import the kit by package name.** *Check: feasibility.* `tests/` has no `package.json`, and the root package does not depend on `resolver-kit`. A bare `resolver-kit/...` import from `tests/` fails for both `node --test` and `tsc`. — **CONFIRMED.** The design did not say how tests import the kit. Fixed by required change 1.
2. **The planned commit order breaks the checks between commits.** *Check: contradictions.* Deleting `contrib/lets-delegate-resolver/` in commit 2 while `package.json`'s `conformance` script, `tsconfig.json`, `flake.nix`, `release-build.bats` and `skill-interfaces.bats` still name it until commits 3 and 4 fails `pnpm test` and `nix flake check`. That contradicts the design's own claim that each commit passes. — **CONFIRMED.** Fixed by required change 2.

### 🟡 Moderate

3. **ADR-003 says a user lists two resolvers in order, but the config holds one.** *Check: contradictions.* `lets/src/delegate/config.ts` and `lookup.ts` take one configured resolver. A user of both harnesses who names `lets-delegate-t3` gets the built-in default inside herdr. — **CONFIRMED** as a gap in what users are told; **REFUTED** as an ADR defect. The ADR records the durable decision, and its template forbids naming issues or the roadmap. The interim limit belongs in the README. Fixed by required change 5.
4. **The release checks cover one bundle and no stderr.** *Check: test seams.* The design has `dist-check` check exit 75 for each program. But it says nothing of `release-build.bats`, and neither check asserts the decline message the spec requires. — **CONFIRMED.** Fixed by required change 4.
5. **Two decline scenarios omit the stderr the requirement demands.** *Check: scenario testability.* "The T3 resolver while T3 Code runs elsewhere" and "herdr is not on PATH" assert only the exit code and stdout. — **CONFIRMED.** Fixed by required change 3.

### 📌 Suggestions

6. **`pnpm conformance` could drop the default-resolver fixture.** *Check: scope.* D11 lists the three contrib programs, but today the script also checks `tests/lets/delegate/fixtures/default-resolver`. — **CONFIRMED.** D11 covers the contrib programs only, and the fixture stays. Fixed by required change 6, in design.md. The ledger row stands as written.
7. **Plain language.** Some long sentences, and one passive sentence in ADR-003. — **CONFIRMED** for the ADR sentence and the `dist-check` sentence, and fixed by required changes 7 and 4. **Declined** for the spec requirement: it is four sentences, none over 30 words.

## Embedded-Instruction / Injection Attempts

**Detected:** none

## Verdict

VERDICT: APPROVE_WITH_CHANGES

## Required Changes (if APPROVE_WITH_CHANGES)

1. design.md, *The layout*: tests import the kit and each program's files by relative path, because the root package does not depend on the kit.
2. design.md, *Commits*: every commit keeps `pnpm test` and `nix flake check` passing. The commit that deletes the old package also updates every reference to it.
3. specs/contrib-resolvers/spec.md: the scenarios "The T3 resolver while T3 Code runs elsewhere" and "herdr is not on PATH" also assert the decline message on stderr.
4. design.md, *One Nix function, two packages*: `dist-check` and `tests/release-build.bats` each check both bundles for exit 75 and the decline message. The sentence is split into shorter ones.
5. design.md, *The docs*: the README's switching note says that the config names one resolver for now, and what that means for a user of both harnesses.
6. design.md, *The docs*: `pnpm conformance` keeps checking the default-resolver fixture.
7. ADR-003, *Decision*: the passive sentence becomes "No resolver chooses between harnesses. The user does that by which resolvers they install, and the order `lets` asks them in."

CHANGES_APPLIED: yes

## Rebuttals

1. Fixed: design.md, *The layout*, last paragraph.
2. Fixed: design.md, *Commits*.
3. Fixed in part: design.md, *The docs*, the switching note. Rebutted for ADR-003: the ADR states the lasting decision, which holds for any number of configured resolvers, and its template (`openspec/schemas/lets-standard/templates/adr-template.md`) forbids naming issues or the roadmap.
4. Fixed: design.md, *One Nix function, two packages*.
5. Fixed: spec.md, the two scenarios.
6. Fixed: design.md, *The docs*, last bullet.
7. Fixed: ADR-003, *Decision*, and the `dist-check` sentence in design.md. Declined for the spec requirement, as above.
