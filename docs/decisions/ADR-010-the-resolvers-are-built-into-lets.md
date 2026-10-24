---
id: adr-010
date: 2026-10-24
status: accepted
title: 'ADR-010: The resolvers are built into lets, and the config names them'
description: Architecture decision record (ADR) for running the t3, cli and subagent resolvers inside lets, chosen by name in the delegate config, in place of separate programs that speak a JSON protocol
---

# ADR-010: The resolvers are built into lets, and the config names them

## Context

`lets delegate` hands a review or a handoff to a resolver, which turns it into a real session in the user's harness. There are three: `t3` opens a T3 Code thread, `cli` runs a family's command-line tool headless, and `subagent`, the default, starts nothing and sends the work back to the caller. Until now each was a separate program. `lets` ran it as a child process and spoke a JSON protocol with it over stdin and stdout. Users installed the programs themselves and listed their absolute paths in the delegate config. `lets` carried its own copy of `subagent` in a folder beside itself.

Separate programs were chosen for three reasons: anyone could write a resolver, in any language; resolvers would install per user, not per project; and the lookup would have one kind of resolver, a program at a path. None held. Nobody outside this repository has written a resolver, and none is expected. The same person who pins `lets` runs the harness, so per-user installs only added a step. And a list of names is one kind of resolver too. Meanwhile the protocol cost a lot: a request and response format, exit codes for each failure, a conformance checker, bundles and packages for each program, and a path in the config that breaks whenever a Nix store path changes.

Each resolver is already a small adapter behind one interface inside the `lets` package. The programs are a thin wrapper that turns protocol messages into calls on that interface.

## Decision

`lets` calls the adapters in process, through their shared interface. The delegate config lists the chain by name, `t3`, `cli` and `subagent`, and with no config the chain is `subagent`. A path, or any other name, is a usage error. There is no way to add a resolver from outside `lets`, and no environment variable that points at one.

This supersedes ADR-003 (one resolver program per harness), ADR-004 (the default is a program beside `lets`) and ADR-009 (the resolver kit owns the contract between `lets` and the programs). Each harness still has its own adapter, which declines outside it, as ADR-003 said.

## Consequences

- Easier: a user gets fresh-session reviews by listing names. There is nothing to install, and nothing breaks when `lets` moves.
- Easier: a change to delegation touches one interface in one program, with no protocol to keep in step and no conformance check to run.
- Easier: tests pass fake adapters to `lets`, in place of a fake program run through an environment variable.
- Harder: a third resolver, such as one for a new harness, needs a change to `lets` and a release. Nobody can add one on their own machine.
- Harder: an adapter that hangs or crashes is no longer contained by a process. `lets` relies on each adapter's own deadline, and turns an unexpected error inside an adapter into "the outcome is unknown".
- Harder: users who listed paths must rewrite their config once, and remove the programs they installed.

## Alternatives Considered

### Alternative 1: Keep the programs, and let the config name them
- **Pros**: no path in the config, and anyone could still write a program.
- **Cons**: the protocol, the bundles, the packages and the conformance check all stay, and `lets` must find each program by name somewhere.
- **Why not**: it keeps every cost of the protocol for an extension point that nobody uses, and finding programs by name brings back the lookup on `PATH` that the config was made to replace.

### Alternative 2: Built-in adapters, plus an environment variable for an outside program
- **Pros**: tests and experiments could still plug in a program.
- **Cons**: one hypothetical program keeps the whole protocol alive, with its parsing, exit codes and checker.
- **Why not**: tests can pass fake adapters directly, so the variable would serve no one but a user who does not exist.

### Alternative 3: A plugin registry that loads adapters at run time
- **Pros**: outside adapters without a protocol.
- **Cons**: a loader, a discovery rule and a versioned interface for outside code.
- **Why not**: it is new machinery for the same unused extension point, and it gives outside code a way into `lets`'s own process.
