---
id: adr-003
date: 2026-10-20
status: accepted
title: 'ADR-003: One resolver program per harness, and each answers only inside its own'
description: Architecture decision record (ADR) for shipping one resolver program per harness that declines outside its own harness
---

# ADR-003: One resolver program per harness, and each answers only inside its own

## Context

`lets delegate` hands a review or a handoff to a resolver: a program that turns a request into a real session in the harness the user works in, such as T3 Code or herdr. Resolvers speak a small JSON protocol, and a resolver can decline a request with exit 75 so that `lets` asks the next one. This repository used to ship one resolver for both harnesses. It looked at the process it ran in and picked T3 Code, then herdr, at run time. So everyone installed code for both harnesses, and a reader had to follow two adapters behind one switch to understand either. Adding a harness meant editing a program that every user of the other harnesses also runs.

## Decision

Each harness gets its own resolver program, built from a shared kit that holds the protocol code. A resolver answers only when the process runs inside its own harness. Anywhere else it declines with exit 75, and it never looks for another harness. No resolver chooses between harnesses. The user does that by which resolvers they install, and the order `lets` asks them in.

## Consequences

- Easier: a user installs only the program for the harness they use. A new harness is a new program, and no existing one changes.
- Easier: each program is one adapter on the kit, small enough to read in one go.
- Easier: a harness's resolver answers where you work. Working in herdr while T3 Code also runs, the T3 resolver declines, so the session never opens in a window you are not looking at.
- Harder: a user of two harnesses installs two programs and lists both, in order.
- Harder: the release and the Nix packages ship one program per harness. Each needs its own build, check and install steps.
- Harder: anyone who installed the combined program must switch to the new names. There is no alias.

## Alternatives Considered

### Alternative 1: Keep one program that picks the harness at run time
- **Pros**: one install for every harness, and no change for existing users.
- **Cons**: every user runs every harness's code, and each new harness grows one shared program.
- **Why not**: the choice of harness belongs to the user's setup, which knows what the machine has. A program that guesses at run time hides that choice where the user cannot see or reorder it.

### Alternative 2: One program per harness that answers whenever its harness is running
- **Pros**: a review can open in T3 Code or herdr even from a plain terminal.
- **Cons**: with two harnesses running, whichever resolver comes first answers, wherever the user works.
- **Why not**: the session would open in a harness the user may not be looking at, and the order of the resolvers would decide that, not where the user works.
