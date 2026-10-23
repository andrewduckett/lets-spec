## 1. The rules block

- [x] 1.1 [easy] Add a test to `tests/sync-rules.bats`: the synced rules block has no "readiness", no `planningHome.root`, no `root.path` and no "narrow exception", and it names "Kind, Priority, Size and Status" and `.agents/skills/lets-shape/references/domain-language.md`. It fails against today's block. (verify: `! bats tests/sync-rules.bats --filter 'plain'`) (✓ `! bats tests/sync-rules.bats --filter 'plain'` passed: the test fails on "readiness")
- [x] 1.2 [easy] In `overlays/AGENTS.md`, cut the glossary documentation exception from the OpenSpec rule and the backlog rule, and name the fields Kind, Priority, Size and Status, as design.md Decision 1 says. (verify: `bats tests/sync-rules.bats`) (✓ `bats tests/sync-rules.bats`: 16 of 17 passed; the plain test fails only on `planningHome.root`, which 1.3 removes. See the ledger.)
- [x] 1.3 [easy] In `overlays/AGENTS.md`, replace "Domain language" with the five sentences in design.md Decision 1. The test from 1.1 passes. (verify: `bats tests/sync-rules.bats --filter 'plain'`) (✓ `bats tests/sync-rules.bats --filter 'plain'` passed; the whole file passes too)

## 2. The skills [depends-on: 1]

- [x] 2.1 [complex] Rewrite `lets-shape`'s "Glossary handoff" as numbered steps with one actor each, under the same heading. Keep every obligation S1 to S18 in design.md's behaviour inventory. (verify: `bats tests/skill-interfaces.bats`) (✓ `bats tests/skill-interfaces.bats` passed; steps 1–18 map one-to-one to S1–S18)
- [x] 2.2 [complex] Rewrite `lets-build`'s "Glossary preflight" and "Import the glossary checkpoint" as numbered steps with one actor each, under the same headings. Keep every obligation B2 to B8. (verify: `bats tests/skill-interfaces.bats`) (✓ `bats tests/skill-interfaces.bats` passed; B2–B8 checked step by step)
- [x] 2.3 [easy] Rewrite the preflight sentence in `lets-build`'s "Find the source of demand" (B1) and the import exception in "Rules" (B9) to match 2.2, with the same meaning. (verify: `bats tests/skill-interfaces.bats`) (✓ `bats tests/skill-interfaces.bats` passed)
- [x] 2.4 [easy] In `skills/lets-shape/references/domain-language.md`, replace the paragraph that starts "Shaping follows its checkpoint" with the three sentences design.md Decision 3 describes. (verify: `bats tests/skill-interfaces.bats`) (✓ `bats tests/skill-interfaces.bats` passed)

## 3. The project owner's page [depends-on: 2]

- [x] 3.1 [medium] Rewrite `docs/domain-language.md` for the project owner, in about 40 lines under the four headings in design.md Decision 4, with a working link to the reference. (verify: `test -f skills/lets-shape/references/domain-language.md && grep -q '](../skills/lets-shape/references/domain-language.md)' docs/domain-language.md`) (✓ verify command passed; 48 lines with blanks)

## 4. Checks [depends-on: 3]

- [x] 4.1 [medium] Run the project's full checks, and fix what they report. (verify: `pnpm test && nix flake check`) (✓ `pnpm test` and `nix flake check` passed, nothing to fix)

## Deviations Ledger

- 1.2: its verify command runs the whole of `tests/sync-rules.bats`, which includes the test from 1.1. That test can only pass after 1.3, so 1.2 was ticked with 16 of 17 passing, and the one failure on a 1.3 term.
