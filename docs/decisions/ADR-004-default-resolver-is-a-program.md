---
id: adr-004
date: 2026-10-21
status: accepted
title: 'ADR-004: The default resolver is a program that ships with lets, not code inside lets'
description: Architecture decision record (ADR) for making the default resolver a separate program that every lets carries and runs as a process
---

# ADR-004: The default resolver is a program that ships with lets, not code inside lets

## Context

`lets delegate` hands a review or a handoff to a resolver: a program that speaks a small JSON protocol over stdin and stdout, and that `lets` runs as a process. Under ADR-003, each harness has its own resolver program, built on a shared kit. When no installed resolver answers, a default answers last. It starts no session: for a review it tells the caller to use a subagent, and for a handoff it hands the prompt back. The default used to be a module inside `lets`, so the lookup had two kinds of resolver: commands that `lets` runs, and the built-in one that it calls. Every rule about resolvers, such as their order, their names in the config and how setup lists them, had to handle both kinds.

## Decision

The default is a resolver program, `lets-delegate-subagent`, built on the same kit as the others. Every `lets` carries it in a `contrib/` folder beside itself: the release tarball, the Nix package and the source tree. `lets` runs it as a process with its own Node, like any other resolver. If the file is missing, `lets delegate` fails with exit 4 rather than falling back to code of its own.

## Consequences

- Easier: the lookup has one kind of resolver. Because the default has a path like any other resolver, the config and setup can later list it as one more entry. This decision alone does not let the user see, move or drop it.
- Easier: the default is checked by the same conformance check as every other resolver, so it cannot drift from the protocol.
- Easier: a reader learns how the default behaves the way they learn any other resolver: from one small program.
- Harder: every way `lets` is shipped must also ship the program, at the same place beside `lets`. A packaging mistake shows up as exit 4 at run time.
- Harder: each fallback to the default costs one Node process start.

## Alternatives Considered

### Alternative 1: Keep the default inside lets
- **Pros**: nothing extra to ship, and the default can never be missing.
- **Cons**: the lookup keeps two kinds of resolver, and the config and setup must describe an entry that is not a program.
- **Why not**: the user can't list, move or drop a resolver that has no path. Every later rule about the order of resolvers would need a special case for it.

### Alternative 2: Fall back to built-in code when the program is missing
- **Pros**: reviews keep working on a broken install.
- **Cons**: the same behaviour lives in two places, and the copy inside `lets` is never checked by conformance.
- **Why not**: it keeps the special case this decision removes, and it hides a broken install that the user should fix.
