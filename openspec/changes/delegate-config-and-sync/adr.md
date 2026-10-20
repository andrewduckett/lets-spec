# ADR Review Manifest

- Status: completed
- Review date: 2026-10-20

## Review Summary

ADR review completed for this change. Of the design's nine decisions, only decision 7 qualifies: `lets` reads the config and sends the reviewers in the request. It sets a contract boundary that resolvers written by others depend on. The others can be recovered from the code, or are cheap to change.

## In-Force ADRs Reviewed

- [ADR-001: The built-in default delegate starts no session](../../../docs/decisions/ADR-001-default-delegate-starts-no-session.md). This change keeps it: the default still chooses no family, and the choice stays with the resolver and the user's setup.

## New Durable ADRs Created

- [ADR-002: lets owns the delegate config, and resolvers get reviewers through the request](../../../docs/decisions/ADR-002-lets-owns-the-delegate-config.md)
