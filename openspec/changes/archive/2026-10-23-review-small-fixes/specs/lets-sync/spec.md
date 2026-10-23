## ADDED Requirements

### Requirement: A release that ships a path lets sync does not own changes nothing
When the release ships a skill or schema folder whose project path `lets sync` does not own, `lets sync` SHALL exit 1 before it writes any file, and SHALL print `error: <release> ships <path>, which lets sync does not own.` on stderr. It owns only `.agents/skills/lets-*`, `.agents/skills/openspec-*` and `openspec/schemas/lets-*`.

#### Scenario: The release ships a skill with a name lets sync does not own
- **WHEN** `lets sync` runs in a git project that has never synced, with a release that ships the skill folder `.agents/skills/other`
- **THEN** it exits 1
- **AND** stderr holds `ships .agents/skills/other, which lets sync does not own.`
- **AND** the project's files are the same as before the run, including `AGENTS.md`

#### Scenario: Check refuses the same release
- **WHEN** `lets sync --check` runs with a release that ships the skill folder `.agents/skills/other`
- **THEN** it exits 1, and stderr holds `ships .agents/skills/other, which lets sync does not own.`
