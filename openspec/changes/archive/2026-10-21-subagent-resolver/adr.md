# ADR Review Manifest

- Status: completed
- Review date: 2026-10-21

## Review Summary

ADR review completed for this change. One decision in design.md qualifies: the default resolver becomes a program that ships with `lets` (D1, D2, D3 together). The kit's verb layer (D4), the package layout (D5) and the test routing (D6) can be read from the code and are cheap to change, so they get no record.

## In-Force ADRs Reviewed

- [ADR-001: The built-in default delegate starts no session](../../../docs/decisions/ADR-001-default-delegate-starts-no-session.md). It still holds: the program starts no session and picks no family.
- [ADR-002: lets owns the delegate config, and resolvers get reviewers through the request](../../../docs/decisions/ADR-002-lets-owns-the-delegate-config.md). Unaffected.
- [ADR-003: One resolver program per harness, and each answers only inside its own](../../../docs/decisions/ADR-003-one-resolver-per-harness.md). ADR-004 builds on it.

## New Durable ADRs Created

- [ADR-004: The default resolver is a program that ships with lets, not code inside lets](../../../docs/decisions/ADR-004-default-resolver-is-a-program.md)
