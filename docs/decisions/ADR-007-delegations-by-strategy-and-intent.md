---
id: adr-007
date: 2026-10-22
status: accepted
title: 'ADR-007: lets delegate is organized by strategy, and every call names its intent'
description: Architecture decision record (ADR) for organizing lets delegate commands by strategy, with the intent as a required --for flag
---

# ADR-007: lets delegate is organized by strategy, and every call names its intent

> Amended by [ADR-011](ADR-011-one-config-file-shaped-like-the-commands.md): the guidance key follows the strategy as well as the intent, `delegate.<strategy>.<intent>.guidance`, such as `delegate.review.code.guidance`. The commands, their grouping and the required `--for` still hold.

## Context

`lets delegate` runs a prompt in a fresh session for three kinds of work: a plan review, a code review, and handing a planned change to a new session to build it. A delegation has three independent parts. The **command** says what `lets` does: report what can run (`instructions`), or start the session (`run`). The **strategy** says what kind of session it is. A `review` is read-only and waits for the final message. A `handoff` is interactive and returns at once. The **intent** says what the work is for: `plan`, `code` or `apply`.

The strategy decides everything mechanical: the options, the output, the exit codes, and the protocol verb sent to the resolver (`run` for a review, `start` for a handoff). The intent decides only which of the user's guidance applies. Plan reviews and code reviews share a strategy but need different guidance. When one word names two of these parts, the interface gains names that mean two things.

## Decision

Commands are grouped by strategy: `lets delegate review instructions|run` and `lets delegate handoff instructions|run`. Every `instructions` and `run` takes a required `--for <intent>`, even when the strategy has only one intent, as `handoff --for apply` does. Each strategy accepts only its own intents. The intent is also the key for the user's guidance in the delegate config: `delegations.<intent>.guidance`.

## Consequences

- Easier: each strategy's help text holds all of its options, outputs and exit codes, because they never vary by intent.
- Easier: a new intent is a new `--for` value and a new guidance key. No command is added, and no resolver changes.
- Easier: a call always says both how it runs and what it is for, so a log or a skill reads without guessing.
- Harder: every call is longer, and `handoff` callers name an intent that has only one value today.
- Harder: `run` is both a `lets` command and a protocol verb, and `handoff run` sends the protocol verb `start`. The resolver contract has to explain the mapping.
- Harder: a new strategy, such as a session that may write files headless, is a new command group with its own options, and a new protocol shape.

## Alternatives Considered

### Alternative 1: One command per intent
- **Pros**: the shortest calls, such as `lets delegate run code`, with no flag.
- **Cons**: the options and the output follow the strategy, not the intent, so `run code` and `run apply` would take different options and print different shapes under one command name.
- **Why not**: the command name would stop telling the caller what it gets back, and plan and code would duplicate every review option.

### Alternative 2: Verb first, strategy second
- **Pros**: matches tools such as `kubectl get pods`, where a few verbs apply evenly to many nouns.
- **Cons**: the review options would sit under `run review`, and the review query under `instructions review`, so no single place describes a review.
- **Why not**: here the verbs mean the same across strategies, and the options differ by strategy. That is the case where the noun should come first.

### Alternative 3: The intent as the command's name, with a query flag
- **Pros**: one name per intent, such as `review plan --options` beside `review plan --model x`.
- **Cons**: one command would have two modes, with different required options, outputs and exit codes.
- **Why not**: a caller could not tell from the command alone what it would print, and the help text would have to describe two commands in one.

### Alternative 4: Keep `review` and `handoff` as actions, and add a separate query with `--for`
- **Pros**: no breaking change for callers of `review` and `handoff`.
- **Cons**: the intent would appear only on the query, and the action would not say what it was for. The guidance keys would use names that match no command.
- **Why not**: it keeps the inconsistency this decision removes: `--for` would exist on one command only.
