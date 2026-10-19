## Purpose

The rules block is the section `lets sync` keeps in a project's `AGENTS.md`, and the skills block is the one it keeps in `.gitignore` in the ignored mode. Agents read the rules block first, so what it says about the files lets-spec puts in the project must be true.

## ADDED Requirements

### Requirement: The rules block describes the copies truthfully in both modes
The rules block SHALL say that `lets sync` rewrites the block, the skills in `.agents/skills/` and the schemas in `openspec/schemas/` on every run, and SHALL NOT describe them as links, as read-only, as living in the Nix store, or as ignored by git.

#### Scenario: Fresh sync in committed mode
- **WHEN** `lets sync` runs in a project with no `AGENTS.md` and `LETS_SPEC_SKILLS` unset
- **THEN** the rules block in `AGENTS.md` contains "rewrites this section, the skills in `.agents/skills/` and the schemas in `openspec/schemas/`" and contains neither "read-only links" nor "Nix store"

#### Scenario: Fresh sync in ignored mode
- **WHEN** `lets sync` runs in a project with no `AGENTS.md` and `LETS_SPEC_SKILLS=ignored`
- **THEN** the rules block in `AGENTS.md` is the same text as in committed mode

### Requirement: Marker lines name the current command
The BEGIN line of the rules block and of the skills block SHALL name the command as `lets sync`, and SHALL NOT contain `lets-sync`.

#### Scenario: Fresh sync writes both blocks
- **WHEN** `lets sync` runs in a project with no `AGENTS.md` and `LETS_SPEC_SKILLS=ignored`
- **THEN** the first line of the rules block in `AGENTS.md` and the first line of the skills block in `.gitignore` each contain "lets sync rewrites this block" and neither contains "lets-sync"

### Requirement: Blocks an older release wrote are recognized and rewritten once
`lets sync` SHALL treat a block whose BEGIN line starts with the marker's prefix but carries an older wording as that block, report it as updated, and leave it current for the next run.

#### Scenario: A 0.4.0 rules block
- **WHEN** `AGENTS.md` holds a rules block whose BEGIN line is `<!-- BEGIN lets-spec rules. lets-sync rewrites this block: change lets-spec, not this text. -->` and `lets sync` runs
- **THEN** it prints "updated the lets-spec rules in AGENTS.md", `AGENTS.md` holds exactly one rules block, and `lets sync --check` then exits 0

#### Scenario: A 0.4.0 skills block
- **WHEN** `.gitignore` holds a skills block whose BEGIN line is `# BEGIN lets-spec skills. lets-sync rewrites this block: change lets-spec, not this text.` and `lets sync` runs with `LETS_SPEC_SKILLS=ignored`
- **THEN** `.gitignore` holds exactly one skills block, with the new BEGIN line, and `lets sync --check` then exits 0
