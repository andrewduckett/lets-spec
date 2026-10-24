## Why

Every agent in every project reads the rules block that `lets sync` writes, on every turn. Today it names a Project field that does not exist, carries OpenSpec JSON field names, and repeats one rare exception in two of its rules. The glossary sections of `lets-shape` and `lets-build` are the source of that dense prose, and `docs/domain-language.md` copies it, so all three need fixing together. The README story under epic #71 waits for this change to be released.

## What Changes

- `overlays/AGENTS.md`, the rules block:
  - Cut the glossary documentation exception from both rules that carry it (D2).
  - Name the Project fields as Kind, Priority, Size and Status (D3).
  - Shrink "Domain language" to five sentences, with no YAML example and no JSON field names (D4).
- `skills/lets-shape/SKILL.md`: rewrite "Glossary handoff" as numbered steps, one actor per step (D5).
- `skills/lets-build/SKILL.md`: rewrite "Glossary preflight" and "Import the glossary checkpoint" the same way, along with the sentences that point at them (D5).
- `skills/lets-shape/references/domain-language.md`: rewrite only the paragraph that repeats the shaping handoff (D6).
- `docs/domain-language.md`: rewrite for the project owner, in about 40 lines (D7).
- `tests/sync-rules.bats`: one test that the rules block names no "readiness" field and no OpenSpec JSON field (D9).

No skill does anything new, and none stops doing anything (D1).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. No requirement changes, so the change sets `skip_specs: true` (D8).

## Impact

- Projects see the new rules block after the next release and their next `lets sync`. This repository's own `AGENTS.md`, `CLAUDE.md` and `.agents/` copies change the same way (D10).
- No code, command, flag or file layout changes.
