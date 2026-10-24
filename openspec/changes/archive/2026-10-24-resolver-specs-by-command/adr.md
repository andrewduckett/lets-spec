# ADR Review Manifest

- Status: completed
- Review date: 2026-10-24

## Review Summary

ADR review completed for this change. Its three design decisions are test layout choices that are cheap to change and plain from the code: an option on a test fixture, where two test files live, and the repository path the tests use. None is a costly fork, so none gets a record. The move of the rules to `delegate-resolvers` follows epic #110's capability decision, which [ADR-010](../../../docs/decisions/ADR-010-the-resolvers-are-built-into-lets.md) already covers.

## In-Force ADRs Reviewed

- [ADR-001](../../../docs/decisions/ADR-001-default-delegate-starts-no-session.md): the built-in default delegate starts no session.
- [ADR-002](../../../docs/decisions/ADR-002-lets-owns-the-delegate-config.md): lets owns the delegate config.
- [ADR-005](../../../docs/decisions/ADR-005-the-config-lists-the-chain.md): the config lists the resolvers to ask, in order.
- [ADR-006](../../../docs/decisions/ADR-006-the-caller-chooses-the-model.md): a resolver reports the models it can run, and the caller chooses one.
- [ADR-007](../../../docs/decisions/ADR-007-delegations-by-strategy-and-intent.md): lets delegate is organized by strategy and intent.
- [ADR-008](../../../docs/decisions/ADR-008-lets-tries-the-ranked-models.md): lets tries the ranked models in order.
- [ADR-010](../../../docs/decisions/ADR-010-the-resolvers-are-built-into-lets.md): the resolvers are built into lets, and the config names them.

## New Durable ADRs Created

- None - no major durable architectural decisions were introduced.
