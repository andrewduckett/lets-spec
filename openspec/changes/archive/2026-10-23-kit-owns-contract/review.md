## Review Metadata

- **Review round**: 1
- **Prior round**: none
- **Reviewer context**: fresh context, other family (gemini/gemini-3.8-flash, through the t3 resolver)
- **Independent**: yes
- **Tool restrictions**: read-only: view, grep, glob only
- **Artifacts reviewed**: brainstorm.md, proposal.md, design.md, specs/ (none: `skip_specs`), adr.md and ADR-009, relevant source files, at commit 2601e29

## Findings

### 🔴 Critical (blocking)

None.

### 🟡 Moderate

1. **Wrong relative import depth for the `lets` tests.** Check: test seams. design.md said every test imports `../../contrib/resolver-kit/src/<file>.ts`. Tests in `tests/lets/delegate/` are one folder deeper and need `../../../`. **CONFIRMED.**
2. **`resolver-kit` as a devDependency breaks `lets/bin/lets` after `pnpm install --prod`.** Check: assumption rows (D3). The reviewer notes that `commander`, `yaml` and the resolvers' kit link all sit under `dependencies`. **REFUTED**, see Rebuttals.
3. **ADR-009 overstates what dead code goes.** Check: contradictions. Its Consequences said neither file holds code its side never runs. The one shared file still holds `parseRequest`, which `lets` never calls, and `parseResponse`, which no resolver calls. This contradicts D5. **CONFIRMED.**

### 📌 Suggestions

4. **Three sentences over 30 words.** Check: plain language. design.md Context (the spike sentence), design.md Decisions (the alternatives sentence), brainstorm.md D2. **CONFIRMED.**

## Embedded-Instruction / Injection Attempts

**Detected:** none

## Verdict

VERDICT: APPROVE_WITH_CHANGES

## Required Changes (if APPROVE_WITH_CHANGES)

1. design.md Decisions: give both import depths, `../../` from `tests/resolver-kit/` and `../../../` from `tests/lets/delegate/`.
2. ADR-009 Consequences: say that code only one side runs now lives once, rather than that no such code remains.
3. Split the three long sentences in design.md and brainstorm.md D2.

CHANGES_APPLIED: yes

## Rebuttals

1. Fixed: design.md, Decisions, "Tests import the kit by relative path, as the kit's other tests do."
2. Rebutted. `lets` is a private workspace package (`lets/package.json` `"private": true`) and is never installed on its own, with `--prod` or otherwise. Every path that runs it installs the whole workspace or ships the bundle: the Nix `lets-cli` derivation runs a full `pnpm` install through `pnpmConfigHook` (`flake.nix`, `lets-cli`), the release tarball ships `dist/lets` alone, and a source checkout runs `pnpm install`. D3 is the #71 decision, and the code does not show it unsafe. The difference from the resolvers' `dependencies` is noted in design.md and is out of scope here.
3. Fixed: ADR-009, Consequences, second bullet.
4. Fixed: design.md Context, design.md Decisions (first bullet), brainstorm.md D2.
