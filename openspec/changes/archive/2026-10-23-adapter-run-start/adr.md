# ADR Review Manifest

- Status: completed
- Review date: 2026-10-23

## Review Summary

ADR review completed for this change. No decision in design.md needs a
new record.

## In-Force ADRs Reviewed

- [ADR-001](../../../docs/decisions/ADR-001-default-delegate-starts-no-session.md): the built-in default delegate starts no session.
- [ADR-002](../../../docs/decisions/ADR-002-lets-owns-the-delegate-config.md): lets owns the delegate config.
- [ADR-003](../../../docs/decisions/ADR-003-one-resolver-per-harness.md): one resolver program per harness, each an adapter on the kit. This change keeps that shape.
- [ADR-004](../../../docs/decisions/ADR-004-default-resolver-is-a-program.md): the default resolver is a program.
- [ADR-005](../../../docs/decisions/ADR-005-the-config-lists-the-chain.md): the config lists the resolvers to ask.
- [ADR-006](../../../docs/decisions/ADR-006-the-caller-chooses-the-model.md): the caller chooses the model.
- [ADR-007](../../../docs/decisions/ADR-007-delegations-by-strategy-and-intent.md): delegations by strategy and intent.
- [ADR-008](../../../docs/decisions/ADR-008-lets-tries-the-ranked-models.md): lets tries the ranked models.
- [ADR-009](../../../docs/decisions/ADR-009-the-kit-owns-the-contract.md): the kit owns the contract. The `Adapter` interface is not part of that contract: lets never imports it.

## New Durable ADRs Created

- None. The `Adapter` interface is internal to this repository, only two
  adapters implement it, and reversing the change is a small refactor.
  Reading the code says what the interface is, and nothing about it is
  costly to change.
