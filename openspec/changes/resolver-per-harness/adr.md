# ADR Review Manifest

- Status: completed
- Review date: 2026-10-20

## Review Summary

ADR review completed for this change. Of the design's decisions, one passes the test: one resolver program per harness, each answering only inside its own harness. Merging the programs back would be easy to do without knowing why, and costly to undo once setup and the config chain rely on one program per harness. The kit's package shape, the test layout, the shared bundle function and the Nix function can all be read from the code and are cheap to change, so they get no record.

## In-Force ADRs Reviewed

- [ADR-001: The built-in default delegate starts no session](../../../docs/decisions/ADR-001-default-delegate-starts-no-session.md). Not affected: this change leaves the default alone.
- [ADR-002: lets owns the delegate config, and resolvers get reviewers through the request](../../../docs/decisions/ADR-002-lets-owns-the-delegate-config.md). Not affected: each new resolver takes the reviewers from the request as before.

## New Durable ADRs Created

- [ADR-003: One resolver program per harness, and each answers only inside its own](../../../docs/decisions/ADR-003-one-resolver-per-harness.md)
