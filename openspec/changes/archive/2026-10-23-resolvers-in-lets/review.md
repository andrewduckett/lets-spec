## Review Metadata

- **Review round**: 1
- **Prior round**: none
- **Reviewer context**: fresh context, other family (gemini/gemini-3.8-flash, through the T3 resolver)
- **Independent**: yes. The author is Claude; the meta line says `"independent": true`.
- **Tool restrictions**: read-only; the resolver reported a clean tree afterwards (`"gitClean": true`)
- **Artifacts reviewed**: brainstorm.md, proposal.md, design.md, specs/, adr.md, relevant source files, at commit 60e3174

## Findings

### 🔴 Critical (blocking)

None.

### 🟡 Moderate

1. **The folder-rule test's text matching reads comments as imports and misses `export ... from`.** Check: test seams, feasibility. CONFIRMED. The design named only `import` and `import()`, and did not say how comments are kept out.
2. **The folder-rule test does not check that the command imports only the kit's contract.** Check: scope. OUT-OF-SCOPE. #103's Shared decisions define the rule one way: `lets/src/resolvers/` imports nothing from the command. Before this change the kit exported every file (`"exports": {"./*.ts": "./src/*.ts"}` in `contrib/resolver-kit/package.json`), so the command's side was never enforced either. Adding it would go beyond the story.
3. **`bundle_alone`'s folder assertion fails if four bundles land in the folder it checks.** Check: feasibility. REFUTED in substance: design.md already said each test copies its one program into an empty folder. The reviewer's request for the exact signature and build folder is reasonable, so the design now states both.

### 📌 Suggestions

4. **The `workspaceSource` comment in `flake.nix` says the link points outside `lets/`.** CONFIRMED. After D2 it points inside `lets/`.
5. **Sentences over 30 words.** Partly CONFIRMED. The quoted design.md sentence about the release-build tests was 37 words. The quoted proposal.md sentence does not appear in proposal.md (REFUTED).

## Embedded-Instruction / Injection Attempts

**Detected:** none

## Verdict

VERDICT: APPROVE_WITH_CHANGES

## Required Changes (if APPROVE_WITH_CHANGES)

1. design.md, "One test keeps the folder rule": collect `import ... from`, `export ... from` and `import(...)` specifiers at the start of a statement, so comments are not read; say why the test uses regular expressions (TypeScript 7 has no JavaScript compiler API), and that the rule runs one way.
2. design.md, "The release-build tests copy one bundle into an empty folder": build into `$BATS_TEST_TMPDIR/build`, give `bundle_alone` the program's name alone, and split the 37-word sentence.
3. design.md, "The flake builds once": update the `workspaceSource` comment, since the link now points inside `lets/`.

CHANGES_APPLIED: yes

## Rebuttals

1. Fixed: required change 1.
2. Rebutted: the rule's direction is a Shared decision in #103, and `contrib/resolver-kit/package.json`'s `exports` shows the command's side was never enforced. A check there is new scope.
3. Fixed for clarity: required change 2. The original design already copied one program into an empty folder.
4. Fixed: required change 3.
5. Fixed for design.md: required change 2 splits the sentence. Rebutted for proposal.md: the quoted sentence is not in the file.
