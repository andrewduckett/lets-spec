---
id: adr-006
date: 2026-10-22
status: accepted
title: 'ADR-006: A resolver reports the models it can run, and the caller chooses one'
description: Architecture decision record (ADR) for resolvers listing the models their harness can run, running exactly the one the caller names, and refusing with exit 3
---

# ADR-006: A resolver reports the models it can run, and the caller chooses one

## Context

`lets delegate` hands a session to a resolver, a program that knows one harness, such as T3 Code or the family CLIs on `PATH`. Until now, the resolver also chose the model: from a list of reviewers the caller sent, or by its own rule when there was none. Neither knew enough. A stored model name went stale: T3 listed a model the account could not run, and the review failed while other models were free. The resolver's own rule knew nothing of the work's purpose or the user's wishes. Only the resolver can see what its harness lists now. Only the caller, the skill that wrote the prompt, knows the purpose, the author's family and what the user asked for. This decision replaces the second decision of ADR-002, under which `lets` sent a list of reviewers and the resolver chose from it.

## Decision

A resolver answers `probe` with the models its harness can run now, as `family[/model]` strings. `run` and `start` take one required `model` in the same form, and the resolver runs exactly that model. It never chooses or falls back. When the harness or the account says no before the model gives any output, the resolver exits 3 with the reason, and the caller tries another option.

## Consequences

- Easier: a choice has one owner. The caller can weigh the purpose, the author's family and the user's guidance, which no resolver sees.
- Easier: nothing about models is stored, so nothing goes stale. Each call asks the harness.
- Easier: a resolver gets smaller. It lists and runs, and its contract has no ordering rules for a reviewer list.
- Harder: every caller must probe, choose and pass a model, and handle exit 3 by trying the next option.
- Harder: `probe` now runs the harness's listing commands, so it can be slow, and it depends on output those commands do not promise to keep.
- Harder: exit 3 now covers setup problems too, such as a harness with no project for the repository. A caller may try several options before the precise reason ends the attempt.

## Alternatives Considered

### Alternative 1: The resolver chooses from a list the caller sends
- **Pros**: the resolver can skip a model its harness lacks without a round trip.
- **Cons**: the list has to come from somewhere. Stored in the config, it goes stale. Built per call, it needs the same probe as this decision. Either way, the choosing rule is copied into every resolver.
- **Why not**: this was the earlier design, and it failed in practice. A listed model the account could not run ended the review, because the resolver could not tell "listed" from "runnable".

### Alternative 2: The resolver chooses by its own rule
- **Pros**: the caller passes nothing, and the contract stays small.
- **Cons**: the resolver cannot see the work's purpose or the user's wishes, so it cannot rank the models it has.
- **Why not**: the review would run on a model nobody asked for, and the user would have no way to say otherwise.

### Alternative 3: The model is optional, and the resolver runs its first option without one
- **Pros**: an older caller keeps working.
- **Cons**: an implicit fallback stays in the contract, and a caller that forgets the model gets a silent choice.
- **Why not**: a fallback is the hidden choice this decision removes. A missing model is a request error, exit 2.
