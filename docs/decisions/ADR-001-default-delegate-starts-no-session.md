---
id: adr-001
date: 2026-10-19
status: accepted
title: 'ADR-001: The built-in default delegate starts no session'
description: Architecture decision record (ADR) for the built-in default delegate starting no session
---

# ADR-001: The built-in default delegate starts no session

> Amended by ADR-005: the default answers when the user has no config, or where the config lists it. Nothing is installed or found on `PATH` any more; the chain in the config decides.

## Context

`lets delegate` hands a review or a build to a fresh session through a resolver. A resolver is a program the user installs for their machine, such as one for T3 Code or herdr. When none is installed, a built-in default answers. A resolver that starts a session must choose a model family, and often a model, and only the user's setup knows which ones the account can run. A default that guesses ends up running a family CLI the account cannot use, or a model that fails.

## Decision

The built-in default starts no session and chooses no family. For a review it exits 3, and the calling skill runs the review in a subagent of its own harness. For a handoff it returns the prompt, so the user can carry on by hand. Every session that `lets` starts comes from an installed resolver.

## Consequences

- Easier: the default works the same on every machine, and needs nothing on `PATH`. Choosing a family or a model has one home: the resolver, and the setup that installs it.
- Easier: a failing review always comes from a resolver the user chose, never from a guess inside `lets`.
- Harder: with no resolver installed, every review comes from the author's own family, and is recorded as not independent. Cross-family reviews need a resolver.
- Harder: a user who relied on the default running `codex`, `claude` or `agy` headless has to install a resolver to keep that.

## Alternatives Considered

### Alternative 1: The default runs another family's CLI headless
- **Pros**: cross-family reviews with nothing to install, when a second CLI is on `PATH`.
- **Cons**: the default picks the family and the model with no record of what the account can run. The CLIs differ in flags and permissions, and each change to them breaks the default.
- **Why not**: the choice belongs to the user's setup. A guess in the default fails in ways the user cannot see or change without editing `lets`.

### Alternative 2: The default runs the build in a subagent too
- **Pros**: the build loop carries on with no resolver and no manual step.
- **Cons**: a build writes code, commits and pushes. Running it inside the planning session, with nothing to watch it, mixes the two sessions' work in one checkout.
- **Why not**: a build should start where the user can see and drive it. Handing back the prompt keeps the user in charge of where it runs.
