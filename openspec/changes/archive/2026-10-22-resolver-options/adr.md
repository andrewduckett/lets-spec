# ADR Review Manifest

- Status: completed
- Review date: 2026-10-22

## Review Summary

One of the design's decisions passes the test: D-1 with D-2, where the caller chooses the model and the resolver reports and runs. A later engineer could easily move the choice back into the resolver, and doing so would change every resolver and every caller. The other decisions can be recovered from the code or the specs. Examples are the error mapping (D-3), the listing rules (D-5) and the `--model` flag (D-7).

## In-Force ADRs Reviewed

- [ADR-001: The built-in default delegate starts no session](../../../docs/decisions/ADR-001-default-delegate-starts-no-session.md)
- [ADR-002: lets owns the delegate config, and resolvers get reviewers through the request](../../../docs/decisions/ADR-002-lets-owns-the-delegate-config.md). Its second decision is replaced by ADR-006, and its note now says so.
- [ADR-003: One resolver program per harness, and each answers only inside its own](../../../docs/decisions/ADR-003-one-resolver-per-harness.md)
- [ADR-004: The default resolver is a program that ships with lets, not code inside lets](../../../docs/decisions/ADR-004-default-resolver-is-a-program.md)
- [ADR-005: The config lists the resolvers to ask, in order, and lets detects nothing](../../../docs/decisions/ADR-005-the-config-lists-the-chain.md)

## New Durable ADRs Created

- [ADR-006: A resolver reports the models it can run, and the caller chooses one](../../../docs/decisions/ADR-006-the-caller-chooses-the-model.md)
