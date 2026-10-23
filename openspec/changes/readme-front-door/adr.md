# ADR Review Manifest

- Status: completed
- Review date: 2026-10-23

## Review Summary

No decision in design.md needs a record. The change restructures documentation only. Each choice is cheap to reverse: revert the commits.

ADR-007 names the strategies and intents. The README stops using those two words, but the command names and `--help` keep them, so ADR-007 still holds unchanged.

## In-Force ADRs Reviewed

- [ADR-001](../../../docs/decisions/ADR-001-default-delegate-starts-no-session.md)
- [ADR-002](../../../docs/decisions/ADR-002-lets-owns-the-delegate-config.md)
- [ADR-003](../../../docs/decisions/ADR-003-one-resolver-per-harness.md)
- [ADR-004](../../../docs/decisions/ADR-004-default-resolver-is-a-program.md)
- [ADR-005](../../../docs/decisions/ADR-005-the-config-lists-the-chain.md)
- [ADR-006](../../../docs/decisions/ADR-006-the-caller-chooses-the-model.md)
- [ADR-007](../../../docs/decisions/ADR-007-delegations-by-strategy-and-intent.md)
- [ADR-008](../../../docs/decisions/ADR-008-lets-tries-the-ranked-models.md)

## New Durable ADRs Created

- None. No decision in this change is costly to reverse.
