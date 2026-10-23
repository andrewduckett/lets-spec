# ADR Review Manifest

- Status: completed
- Review date: 2026-10-23

## Review Summary

ADR review completed for this change. One decision in design.md qualifies: which package owns the resolver contract. An engineer could reverse it by copying the files back, and every contract edit would again be made twice. The other decisions are recoverable from the code.

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

- [ADR-009: The resolver kit owns the contract, and lets imports it](../../../docs/decisions/ADR-009-the-kit-owns-the-contract.md). It builds on ADR-003.
