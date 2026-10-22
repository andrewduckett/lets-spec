## MODIFIED Requirements

### Requirement: Each resolver passes the conformance check
`lets delegate conformance` SHALL pass for `lets-delegate-t3`, `lets-delegate-herdr`, `lets-delegate-subagent` and `contrib/headless-resolver`, each checked on its own.

#### Scenario: Checking the T3 resolver outside T3 Code
- **WHEN** `lets delegate conformance` runs against `lets-delegate-t3` outside T3 Code
- **THEN** it exits 0

#### Scenario: Checking the herdr resolver outside herdr
- **WHEN** `lets delegate conformance` runs against `lets-delegate-herdr` outside herdr
- **THEN** it exits 0

#### Scenario: Checking the subagent resolver
- **WHEN** `lets delegate conformance` runs against `lets-delegate-subagent` outside any harness
- **THEN** it exits 0

### Requirement: The release folder ships each resolver
The release folder's `contrib/` SHALL hold exactly `headless-resolver`, `lets-delegate-herdr`, `lets-delegate-subagent` and `lets-delegate-t3`, each executable. `lets-delegate-herdr`, `lets-delegate-subagent` and `lets-delegate-t3` SHALL each run with Node and no `node_modules` beside them.

#### Scenario: Listing the release folder
- **WHEN** a user lists the release folder's `contrib/`
- **THEN** it holds `headless-resolver`, `lets-delegate-herdr`, `lets-delegate-subagent` and `lets-delegate-t3`, and nothing else

#### Scenario: Running a release copy alone
- **WHEN** the release folder's `contrib/lets-delegate-t3` is copied into an empty directory and run as `probe` outside T3 Code
- **THEN** it exits 75, and its stderr is `lets-delegate-t3: not inside T3 Code`

#### Scenario: Running the subagent copy alone
- **WHEN** the release folder's `contrib/lets-delegate-subagent` is copied into an empty directory and run as `probe`
- **THEN** it exits 0 and prints `{"resolver":"subagent"}`
