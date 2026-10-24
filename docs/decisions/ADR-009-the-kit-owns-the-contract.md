---
id: adr-009
date: 2026-10-23
status: superseded by ADR-010
title: 'ADR-009: The resolver kit owns the contract, and lets imports it'
description: Architecture decision record (ADR) for keeping the resolver protocol and its errors only in the resolver kit, which lets depends on
---

# ADR-009: The resolver kit owns the contract, and lets imports it

> Superseded by [ADR-010](ADR-010-the-resolvers-are-built-into-lets.md): the resolvers are built into `lets`, and the config names them. There is no protocol between `lets` and separate programs left to own.

## Context

This builds on ADR-003: each resolver program is a small adapter on a shared kit, `lets/src/resolvers/kit/`. `lets` and every resolver must agree on the contract: the requests, the responses, the exit codes and the errors behind them. Two TypeScript files hold it, `protocol.ts` and `errors.ts`.

Until now, `lets` kept the originals and the kit kept exact copies, so the kit depended on nothing in `lets`. A test failed when the copies differed. Every edit to the contract was made twice. Each copy also held code that only the other side ran: `lets` never parses a request, and a resolver never parses a response.

`lets` ships as one bundled file that runs with no `node_modules`. The kit and the resolvers live in the `lets` package, under `lets/src/resolvers/`, and esbuild bundles the kit into `lets` and each resolver, under Nix too.

## Decision

The kit holds the only copy of `protocol.ts` and `errors.ts`. The rest of `lets` imports them by relative path from `lets/src/resolvers/kit/`. esbuild bundles the kit's code into `lets`. The kit owns the contract through a folder rule inside one package: nothing under `lets/src/resolvers/` imports from the rest of `lets`, or any package but Node's own. A unit test, `tests/lets/resolvers/folder-rule.test.ts`, checks the rule.

## Consequences

- Easier: a contract edit is made once, and `lets` and every resolver build from the same code.
- Easier: no copies test. Code that only one side runs, such as parsing a request or a response, lives once in the shared file, and no test stops anyone tidying it.
- Easier: the protocol tests live beside the kit, with the code they test.
- Harder: `lets` cannot build without the kit. A change to the names it exports can break `lets`.
- Harder: someone who reads only `lets/` sees the contract's names but not their code. They must follow the import into `lets/src/resolvers/kit/`.
- Unchanged: the release still ships `lets` as one file with no `node_modules`, and each resolver still installs on its own.

## Alternatives Considered

### Alternative 1: Keep two copies and a test that compares them
- **Pros**: the kit and `lets` stay independent packages; neither needs the other to build.
- **Cons**: every contract edit is made twice, and each copy carries about 100 lines its side never runs, which the test forbids removing.
- **Why not**: the independence buys nothing. Both packages live in one workspace and ship in one release, so they never differ in practice.

### Alternative 2: `lets` owns the contract, and the kit imports it
- **Pros**: the command that defines the contract also holds its code.
- **Cons**: every resolver would then depend on `lets`, including its command-line and config code, through the kit.
- **Why not**: a resolver needs the contract, not the command. The kit is the smaller package with the narrower purpose.

### Alternative 3: A third package that holds only the contract
- **Pros**: neither `lets` nor the kit owns the other's code; each depends on the contract package alone.
- **Cons**: one more package, folder, build entry and workspace link to keep.
- **Why not**: a build of `lets` inside the Nix sandbox showed the kit already bundles cleanly into `lets`. A separate package solves no problem the kit leaves.

## Amendments

- 2026-10-23: one package replaced the kit package. The kit was its own workspace package, `resolver-kit`, which `lets` listed as a devDependency. It is now the folder `lets/src/resolvers/kit/` inside the `lets` package, with the three resolvers beside it (#104). Ownership is unchanged; a folder rule and its test now keep the kit apart from the command.
