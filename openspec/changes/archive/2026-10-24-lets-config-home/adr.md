# ADR Review Manifest

- Status: completed
- Review date: 2026-10-24

## Review Summary

One of design.md's decisions qualifies: where the config file lives and how it is laid out. It is a contract with every user's machine, so it is costly to reverse, and without a record someone could add a second file or a flat key. The record also amends ADR-007, whose guidance key changes. The other decisions can be recovered from the code and cost little to change: the shared folder function, the parsed config's shape, the version check order and the test edits.

## In-Force ADRs Reviewed

- [ADR-001](../../../docs/decisions/ADR-001-default-delegate-starts-no-session.md): the built-in default starts no session (amended by ADR-005)
- [ADR-002](../../../docs/decisions/ADR-002-lets-owns-the-delegate-config.md): `lets` owns the delegate config. ADR-011 builds on it.
- [ADR-005](../../../docs/decisions/ADR-005-the-config-lists-the-chain.md): the config lists the chain (amended by ADR-010). It still holds; the chain moves to `delegate.resolvers`.
- [ADR-006](../../../docs/decisions/ADR-006-the-caller-chooses-the-model.md): a resolver reports models, and the caller chooses
- [ADR-007](../../../docs/decisions/ADR-007-delegations-by-strategy-and-intent.md): commands by strategy, with a required intent. Now amended by ADR-011 for the guidance key.
- [ADR-008](../../../docs/decisions/ADR-008-lets-tries-the-ranked-models.md): the skill ranks models, and `lets` tries them in order
- [ADR-010](../../../docs/decisions/ADR-010-the-resolvers-are-built-into-lets.md): the resolvers are built into `lets`, and the config names them

ADR-003, ADR-004 and ADR-009 were read too. ADR-010 supersedes them.

## New Durable ADRs Created

- [ADR-011](../../../docs/decisions/ADR-011-one-config-file-shaped-like-the-commands.md): `lets` has one config file, shaped like its commands
