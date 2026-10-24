# ADR Review Manifest

- Status: completed
- Review date: 2026-10-23

## Review Summary

None of the design's decisions needs a new record. They name a folder and one path constant, which a reader can see in the code, and each is cheap to reverse. The durable decision this change touches, that the default is a program shipped beside `lets`, already has ADR-004. The design amends ADR-004 in place, as an implementation task, to say the folder is `resolvers/` and that a checkout needs no link (D10). The parent epic, #103, records "no new ADR" in its Won't list.

## In-Force ADRs Reviewed

- [ADR-001](../../../docs/decisions/ADR-001-default-delegate-starts-no-session.md): the default delegate starts no session. Unaffected.
- [ADR-002](../../../docs/decisions/ADR-002-lets-owns-the-delegate-config.md): `lets` owns the delegate config. Unaffected.
- [ADR-003](../../../docs/decisions/ADR-003-one-resolver-per-harness.md): one resolver program per harness. Kept: each resolver stays its own program.
- [ADR-004](../../../docs/decisions/ADR-004-default-resolver-is-a-program.md): the default resolver is a program that ships beside `lets`. Kept, and amended in place by this change's tasks: the folder is `resolvers/`.
- [ADR-005](../../../docs/decisions/ADR-005-the-config-lists-the-chain.md): the config lists the chain. Kept: no lookup on `PATH` and no new config words.
- [ADR-006](../../../docs/decisions/ADR-006-the-caller-chooses-the-model.md): the caller chooses the model. Unaffected.
- [ADR-007](../../../docs/decisions/ADR-007-delegations-by-strategy-and-intent.md): delegations by strategy and intent. Unaffected.
- [ADR-008](../../../docs/decisions/ADR-008-lets-tries-the-ranked-models.md): `lets` tries the ranked models. Unaffected.
- [ADR-009](../../../docs/decisions/ADR-009-the-kit-owns-the-contract.md): the kit owns the contract. Unaffected.

## New Durable ADRs Created

- None. No new durable architectural decision was introduced.
