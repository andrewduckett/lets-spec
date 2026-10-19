## 1. The rules block and its markers

- [x] 1.1 [easy] The BEGIN lines of the rules and skills markers say "lets sync rewrites this block" and not "lets-sync", and a block whose BEGIN line carries the 0.4.0 wording still reads as stale (verify: node --test tests/lets/sync/block.test.ts) (✓ node --test tests/lets/sync/block.test.ts passed)
- [x] 1.2 [easy] A fresh `lets sync` writes a rules block whose text says `lets sync` rewrites the section, the skills in `.agents/skills/` and the schemas in `openspec/schemas/` on every run, with no "read-only links" and no "Nix store" (verify: bats tests/sync-rules.bats) (✓ bats tests/sync-rules.bats passed)
- [x] 1.3 [easy] An `AGENTS.md` holding the 0.4.0 rules block is rewritten once with "updated the lets-spec rules in AGENTS.md", holds one block after, and `lets sync --check` then exits 0 (verify: bats tests/sync-rules.bats) (✓ bats tests/sync-rules.bats passed)
- [x] 1.4 [easy] In ignored mode, a `.gitignore` holding the 0.4.0 skills block is rewritten once to the new BEGIN line, holds one block after, and `lets sync --check` then exits 0 (verify: bats tests/sync-skills.bats) (✓ bats tests/sync-skills.bats passed)
- [x] 1.5 [easy] The README's skills block example shows the new BEGIN line, and the paragraph saying the marker keeps the old name is gone (verify: ! grep -q 'lets-sync rewrites' README.md) (✓ ! grep -q 'lets-sync rewrites' README.md passed)
- [x] 1.6 [easy] Every check passes with the markers the tests pin updated (verify: pnpm test) (✓ pnpm test passed: 205 node, 93 bats)
