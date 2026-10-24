## MODIFIED Requirements

### Requirement: The release folder ships each resolver
The release folder's `resolvers/` SHALL hold exactly `headless-resolver`, `lets-delegate-cli`, `lets-delegate-subagent` and `lets-delegate-t3`, each executable. `lets-delegate-cli`, `lets-delegate-subagent` and `lets-delegate-t3` SHALL each run with Node and no `node_modules` beside them.

#### Scenario: Listing the release folder
- **WHEN** a user lists the release folder's `resolvers/`
- **THEN** it holds `headless-resolver`, `lets-delegate-cli`, `lets-delegate-subagent` and `lets-delegate-t3`, and nothing else

#### Scenario: Running a release copy alone
- **WHEN** the release folder's `resolvers/lets-delegate-t3` is copied into an empty directory and run as `probe` outside T3 Code
- **THEN** it exits 75, and its stderr is `lets-delegate-t3: not inside T3 Code`

#### Scenario: Running the cli copy alone
- **WHEN** the release folder's `resolvers/lets-delegate-cli` is copied into an empty directory and run as `probe` with none of `codex`, `claude` or `agy` on `PATH`
- **THEN** it exits 75, and its stderr is `lets-delegate-cli: none of codex, claude or agy is on PATH`

#### Scenario: Running the subagent copy alone
- **WHEN** the release folder's `resolvers/lets-delegate-subagent` is copied into an empty directory and run as `probe`
- **THEN** it exits 0 and prints `{"resolver":"subagent","options":[]}`
