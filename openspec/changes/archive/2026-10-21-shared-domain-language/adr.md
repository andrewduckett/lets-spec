# ADR Review Manifest

- Status: completed
- Review date: 2026-10-21

## Review Summary

Reviewed each decision in design.md against the ADR test. The glossary behavior belongs in the spec. The shared reference, conventional paths, and handoff instructions use existing file, release, and Git mechanisms. They introduce no new runtime boundary, data format parser, or external dependency whose reversal would require an architectural migration.

These choices remain documented in design.md. The default path is overridable through project context, so changing that default need not migrate a consumer glossary. No new durable ADR is needed.

## In-Force ADRs Reviewed

- [ADR-001: The built-in default delegate starts no session](../../../docs/decisions/ADR-001-default-delegate-starts-no-session.md)
- [ADR-002: lets owns the delegate config](../../../docs/decisions/ADR-002-lets-owns-the-delegate-config.md)
- [ADR-003: One resolver per harness](../../../docs/decisions/ADR-003-one-resolver-per-harness.md)
- [ADR-004: The default resolver is a program](../../../docs/decisions/ADR-004-default-resolver-is-a-program.md)

## New Durable ADRs Created

None. No design decision passes both parts of the costly-reversal test.
