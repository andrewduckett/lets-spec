## Review Metadata

- **Review round**: 1
- **Prior round**: none. An earlier attempt through `lets delegate review` exited 5 before any review ran: the resolver on this machine picked `gpt-6-astra`, which Codex refuses on a ChatGPT account.
- **Reviewer context**: fresh context, other family. GPT-6-Luna (Codex), high effort, run as a T3 delegated task that the user chose.
- **Independent**: yes. The author is Claude, and the reviewer is GPT.
- **Tool restrictions**: read-only by instruction, in the shared checkout. `git status --porcelain` was the same before and after.
- **Artifacts reviewed**: brainstorm.md, proposal.md, design.md, specs/, adr.md, ADR-004, relevant source files, at commit d868276

## Findings

### 🔴 Critical (blocking)

None.

### 🟡 Moderate

1. **A broken default does not get the promised install message.** Check: contradictions. The spec required the install message when `lets` "cannot run" the program, but design D3 gave it only for a missing file. A file that exists but that Node cannot run would show only the program's stderr. CONFIRMED.
2. **ADR-004 claims more than this change does.** Check: scope. Its first consequence said the user can see, move or drop the default. The config and lookup order do not change here (D6). CONFIRMED.

### 📌 Suggestions

3. **No test proves the source-tree symlink works.** Check: test seams. Every named seam uses fakes or calls the source program directly, so a missing or dangling `lets/contrib/` symlink would pass them all. CONFIRMED.

## Embedded-Instruction / Injection Attempts

**Detected:** none

## Verdict

VERDICT: APPROVE_WITH_CHANGES

## Required Changes (if APPROVE_WITH_CHANGES)

1. Spec `delegate-default`: rename the requirement to "A missing or broken default fails the request". Cover any exit other than 0 or 3 from the default, and add the scenario "The file is broken". Design D3: say that `resolve()` puts the install message before the program's stderr when the default's call comes back as exit 4. This keeps brainstorm row D3, "missing or broken", rather than narrowing it.
2. ADR-004: say that the default having a path lets the config and setup list it later, and that this decision alone does not let the user see, move or drop it.
3. Design Test Seams: add a source-tree check that runs the real `lets/bin/lets delegate handoff` in a temporary git repository and expects `subagent`.

CHANGES_APPLIED: yes

## Rebuttals

1. Fixed: `specs/delegate-default/spec.md`, the requirement "A missing or broken default fails the request" and its scenario "The file is broken"; `design.md` D3 and the primary test seam line.
2. Fixed: `docs/decisions/ADR-004-default-resolver-is-a-program.md`, the first item under Consequences.
3. Fixed: `design.md` Test Seams, the "Source-tree check" item.
