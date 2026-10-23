# ADR Review Manifest

- Status: completed
- Review date: 2026-10-22

## Review Summary

ADR review completed for this change. Two of design.md's decisions qualify: the command tree (D-1, D-2) and the retry living in `lets` (D-4). The others can be recovered from the code or the specs, or are cheap to change. That includes the probe's `verb` field (D-8), which `docs/resolver-contract.md` describes as part of the protocol.

## In-Force ADRs Reviewed

- [ADR-001: The built-in default delegate starts no session](../../../docs/decisions/ADR-001-default-delegate-starts-no-session.md)
- [ADR-002: lets owns the delegate config](../../../docs/decisions/ADR-002-lets-owns-the-delegate-config.md). Its first decision still stands, and this change adds `delegations` to the config that only `lets` reads.
- [ADR-003: One resolver program per harness](../../../docs/decisions/ADR-003-one-resolver-per-harness.md)
- [ADR-004: The default resolver is a program that ships with lets](../../../docs/decisions/ADR-004-default-resolver-is-a-program.md)
- [ADR-005: The config lists the resolvers to ask, in order](../../../docs/decisions/ADR-005-the-config-lists-the-chain.md)
- [ADR-006: A resolver reports the models it can run, and the caller chooses one](../../../docs/decisions/ADR-006-the-caller-chooses-the-model.md)

## New Durable ADRs Created

- [ADR-007: lets delegate is organized by strategy, and every call names its intent](../../../docs/decisions/ADR-007-delegations-by-strategy-and-intent.md)
- [ADR-008: The skill ranks the models, and lets tries them in order](../../../docs/decisions/ADR-008-lets-tries-the-ranked-models.md), which builds on ADR-006
