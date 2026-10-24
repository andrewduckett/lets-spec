# ADR Review Manifest

- Status: completed
- Review date: 2026-10-23

## Review Summary

ADR review completed for this change. The design follows the in-force records, and makes no decision that is costly to reverse.

## In-Force ADRs Reviewed

- [ADR-001](../../../docs/decisions/ADR-001-default-delegate-starts-no-session.md): the default delegate starts no session
- [ADR-002](../../../docs/decisions/ADR-002-lets-owns-the-delegate-config.md): `lets` owns the delegate config
- [ADR-003](../../../docs/decisions/ADR-003-one-resolver-per-harness.md): one resolver per harness
- [ADR-004](../../../docs/decisions/ADR-004-default-resolver-is-a-program.md): the default resolver is a program
- [ADR-005](../../../docs/decisions/ADR-005-the-config-lists-the-chain.md): the config lists the chain
- [ADR-006](../../../docs/decisions/ADR-006-the-caller-chooses-the-model.md): the caller chooses the model
- [ADR-007](../../../docs/decisions/ADR-007-delegations-by-strategy-and-intent.md): delegations by strategy and intent. Recording `for` in the review line fits it.
- [ADR-008](../../../docs/decisions/ADR-008-lets-tries-the-ranked-models.md): `lets` tries the ranked models
- [ADR-009](../../../docs/decisions/ADR-009-the-kit-owns-the-contract.md): the kit owns the contract. It covers `protocol.ts` and `errors.ts` only, so `lets` keeping its own `Io` with the kit's exec fields agrees with it.

## New Durable ADRs Created

- None - no major durable architectural decisions were introduced. Each design decision is local to `lets` and can be changed by reading the code.
