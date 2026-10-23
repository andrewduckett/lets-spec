---
id: adr-009
date: 2026-10-23
status: accepted
title: 'ADR-009: The resolver kit owns the contract, and lets imports it'
description: Architecture decision record (ADR) for keeping the resolver protocol and its errors only in the resolver kit, which lets depends on
---

# ADR-009: The resolver kit owns the contract, and lets imports it

## Context

This builds on ADR-003: each resolver program is a small adapter on a shared kit, `contrib/resolver-kit/`. `lets` and every resolver must agree on the contract: the requests, the responses, the exit codes and the errors behind them. Two TypeScript files hold it, `protocol.ts` and `errors.ts`.

Until now, `lets` kept the originals and the kit kept exact copies, so the kit depended on nothing in `lets`. A test failed when the copies differed. Every edit to the contract was made twice. Each copy also held code that only the other side ran: `lets` never parses a request, and a resolver never parses a response.

`lets` ships as one bundled file that runs with no `node_modules`. The resolvers already depend on the kit through the pnpm workspace, and esbuild bundles it into each of them, under Nix too.

## Decision

The kit holds the only copy of `protocol.ts` and `errors.ts`. `lets` lists `resolver-kit` as a workspace devDependency and imports `resolver-kit/protocol.ts` and `resolver-kit/errors.ts`. esbuild bundles the kit's code into `lets`. The kit never imports anything from `lets`.

## Consequences

- Easier: a contract edit is made once, and `lets` and every resolver build from the same code.
- Easier: no copies test, and no code in either file that its side never runs.
- Easier: the protocol tests live beside the kit, with the code they test.
- Harder: `lets` cannot build without the kit. A change to the kit's `exports` map, or to the names it exports, can break `lets`.
- Harder: someone who reads only `lets/` sees the contract's names but not their code. They must follow the import into `contrib/resolver-kit/`.
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
