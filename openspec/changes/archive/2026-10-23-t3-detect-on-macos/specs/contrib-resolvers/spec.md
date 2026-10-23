## MODIFIED Requirements

### Requirement: T3 Code has its own resolver
The repository SHALL ship `lets-delegate-t3`, which answers only for T3 Code. Inside T3 Code, it SHALL answer `probe` with `resolver` `t3` and its `options`. It SHALL find the process's parents both on a system with `/proc`, such as Linux, and on one without, such as macOS. The repository SHALL NOT ship a resolver for herdr.

#### Scenario: probe inside T3 Code
- **WHEN** `lets-delegate-t3 probe` runs in a process whose ancestor is the running T3 server, and T3 has no model manifest
- **THEN** it exits 0 and prints `{"resolver":"t3","options":[]}`

#### Scenario: probe inside T3 Code on a system with no /proc
- **WHEN** `lets-delegate-t3 probe` runs on a system with no `/proc`, where `ps -o ppid= -p <pid>` shows that the running T3 server is the process's ancestor, and T3 has no model manifest
- **THEN** it exits 0 and prints `{"resolver":"t3","options":[]}`
