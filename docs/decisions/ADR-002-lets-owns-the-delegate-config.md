---
id: adr-002
date: 2026-10-20
status: accepted
title: 'ADR-002: lets owns the delegate config, and resolvers get reviewers through the request'
description: Architecture decision record (ADR) for lets owning the delegate config and sending the reviewer list to resolvers
---

# ADR-002: lets owns the delegate config, and resolvers get reviewers through the request

> Superseded in part. The first decision stands: only `lets` reads the config, which now lists resolvers in order (ADR-005). The second no longer holds: the config stores nothing about models, so `lets` sends no `reviewers`. ADR-006 replaces it: a resolver reports the models it can run, and the caller chooses one.

## Context

`lets delegate` hands a review to a resolver, a program the user installs for their harness, such as T3 Code or herdr. Anyone can write a resolver, and `lets` talks to it through a small JSON protocol. Under ADR-001, choosing a family and a model belongs to the resolver and the setup that installs it. But a resolver alone can't know which models the user's account can run, and the user had nowhere to say which family and model they prefer. A user-level config now records that, as an ordered list of reviewers. Something has to read that file, and every resolver has to act on it.

## Decision

Only `lets` reads the delegate config. For a review, `lets` picks out the reviewers that serve the review's effort and sends them in the `run` request as an optional `reviewers` field. The resolver takes the first reviewer its harness can run, preferring one from a family other than the author's. A resolver never reads the config file.

## Consequences

- Easier: the file format has one reader. It can grow, for example with a new version, without changing any resolver.
- Easier: every resolver gets the user's choice through the contract it already speaks, including resolvers written by others. A resolver that ignores the field keeps working.
- Easier: the resolver still decides what its harness can run, which only it knows.
- Harder: the protocol carries one more field, and every resolver that honours it must walk the list the same way: the first reviewer from another family, else the first it can run, else exit 3.
- Harder: anything that reaches a resolver without going through `lets` gets no reviewers.

## Alternatives Considered

### Alternative 1: Each resolver reads the config file
- **Pros**: the protocol doesn't change.
- **Cons**: the file's path, format and version rules become part of every resolver's contract. A change to the file breaks resolvers that `lets` can't update.
- **Why not**: resolvers are written and installed apart from `lets`, so a file shared with them is much harder to change than one field in a protocol that already has a conformance check.

### Alternative 2: lets picks one reviewer and sends only that
- **Pros**: the resolver no longer chooses at all.
- **Cons**: `lets` can't see what the harness can run. T3 may lack a provider that the CLI on `PATH` has, and the reverse.
- **Why not**: a pick made without the harness's view fails in exactly the harness where it matters. With the list, the resolver can skip a reviewer it can't run and take the next one.
