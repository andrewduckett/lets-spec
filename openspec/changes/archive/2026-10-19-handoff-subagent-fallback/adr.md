# ADR Review Manifest

- Status: completed
- Review date: 2026-10-19

## Review Summary

ADR review completed for this change. Of design.md's decisions, only the boundary in D-1, D-3 and D-4 qualifies: the built-in default starts no session and chooses no family. Reversing it means putting a family choice back into `lets`. The rest (the exit code's meaning, the instruction text, keeping `finish`, skill wording) can be recovered from the code and is cheap to change.

## In-Force ADRs Reviewed

- None - `docs/decisions/` had no records before this change.

## New Durable ADRs Created

- [ADR-001: The built-in default delegate starts no session](../../../docs/decisions/ADR-001-default-delegate-starts-no-session.md)
