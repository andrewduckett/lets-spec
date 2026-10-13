## 1. Setup & Shared Contracts (Sequential)

<!-- 5–12 tasks total across the plan. Slice if larger. -->
<!-- TDD rhythm: write failing test depicting intent → verify failure → implement minimal code → verify pass. -->
<!-- Tag complexity [easy|medium|complex] to guide subagent/model assignment. -->

- [ ] 1.1 [easy] <!-- Task description with verification command (verify: <command>) -->
- [ ] 1.2 <!-- Task description with verification command -->

## 2. Workstream A: Core Engine [depends-on: 1]

<!-- Tasks marked [parallel] can run concurrently with other independent streams -->
- [ ] 2.1 [parallel] [medium] <!-- Task description (verify: <command>) -->
- [ ] 2.2 [parallel] [medium] <!-- Task description (verify: <command>) -->

## 3. Workstream B: Surface UI / Client [depends-on: 1]

<!-- Tasks marked [parallel] can run concurrently with other independent streams -->
- [ ] 3.1 [parallel] [medium] <!-- Task description (verify: <command>) -->
- [ ] 3.2 [parallel] [easy] <!-- Task description (verify: <command>) -->

## 4. Integration & System Verification [depends-on: 2, 3]

- [ ] 4.1 [complex] <!-- Full system verification test (verify: <command>) -->

## Deviations Ledger

<!-- Tick = Evidence discipline: A box is ticked only with its inline verification evidence. -->
<!-- Append dated deviations below during apply. Stop and surface material divergences. -->