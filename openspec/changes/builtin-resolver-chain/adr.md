# ADR Review Manifest

- Status: completed
- Review date: 2026-10-24

## Review Summary

Design decisions 1 to 5 together carry one costly fork: whether the resolvers stay separate programs behind a protocol or become part of `lets`. That fork gets one new record. The other decisions (the `Deps` record, the exception-based chain, the `start` return type, the words) follow from it and can be read from the code. The new record supersedes three records and amends one.

## In-Force ADRs Reviewed

- [ADR-001](../../../docs/decisions/ADR-001-default-delegate-starts-no-session.md): the default starts no session. Stands.
- [ADR-002](../../../docs/decisions/ADR-002-lets-owns-the-delegate-config.md): only `lets` reads the delegate config. Stands.
- [ADR-003](../../../docs/decisions/ADR-003-one-resolver-per-harness.md): one resolver program per harness. Superseded by ADR-010.
- [ADR-004](../../../docs/decisions/ADR-004-default-resolver-is-a-program.md): the default is a program beside `lets`. Superseded by ADR-010.
- [ADR-005](../../../docs/decisions/ADR-005-the-config-lists-the-chain.md): the config lists the chain. Amended in place: entries are names.
- [ADR-006](../../../docs/decisions/ADR-006-the-caller-chooses-the-model.md): the caller chooses the model. Stands.
- [ADR-007](../../../docs/decisions/ADR-007-delegations-by-strategy-and-intent.md): delegations by strategy and intent. Stands.
- [ADR-008](../../../docs/decisions/ADR-008-lets-tries-the-ranked-models.md): `lets` tries the ranked models. Stands.
- [ADR-009](../../../docs/decisions/ADR-009-the-kit-owns-the-contract.md): the kit owns the contract. Superseded by ADR-010.

## New Durable ADRs Created

- [ADR-010: The resolvers are built into lets, and the config names them](../../../docs/decisions/ADR-010-the-resolvers-are-built-into-lets.md)
