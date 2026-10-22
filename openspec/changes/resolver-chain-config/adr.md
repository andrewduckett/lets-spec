# ADR Review Manifest

- Status: completed
- Review date: 2026-10-21

## Review Summary

ADR review completed for this change. Of the design's nine decisions, only decision 3 with decision 5 qualifies, taken together: the config lists the resolvers to ask, in order, and `lets` looks on `PATH` for nothing, detects no harness and appends no default. An engineer reading `lookup.ts` could add a fallback back, and reversing it later would put a second decision maker beside the user's file. The others can be recovered from the code: the YAML library and the strict keys (1, 2), when a path is checked (4), the `config.json` refusal (6), dropping `reviewers` now rather than later (7), deleting setup (8). Decision 9 is about this manifest.

## In-Force ADRs Reviewed

- [ADR-001: The built-in default delegate starts no session](../../../docs/decisions/ADR-001-default-delegate-starts-no-session.md). Its decision stands. Its context said the default answers "when none is installed"; a note at its top now says the default answers when there is no config, or where the config lists it.
- [ADR-002: lets owns the delegate config, and resolvers get reviewers through the request](../../../docs/decisions/ADR-002-lets-owns-the-delegate-config.md). Its first decision, that only `lets` reads the config, stands. A note at its top says the config now lists resolvers and holds no reviewers, so `lets` sends none. The reviewers contract itself is replaced by a later change, which supersedes this record.
- [ADR-003: One resolver program per harness, and each answers only inside its own](../../../docs/decisions/ADR-003-one-resolver-per-harness.md). Stands, and is the record the new one builds on: ADR-003 put "where am I" in each resolver, and ADR-005 puts "which ones, in what order" in the user's config.
- [ADR-004: The default resolver is a program that ships with lets, not code inside lets](../../../docs/decisions/ADR-004-default-resolver-is-a-program.md). Stands. Its consequence that "the config and setup can later list it as one more entry" is what this change does.

## New Durable ADRs Created

- [ADR-005: The config lists the resolvers to ask, in order, and lets detects nothing](../../../docs/decisions/ADR-005-the-config-lists-the-chain.md)
