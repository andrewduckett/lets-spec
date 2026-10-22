---
id: adr-008
date: 2026-10-22
status: accepted
title: 'ADR-008: The skill ranks the models, and lets tries them in order'
description: Architecture decision record (ADR) for lets trying a caller's ranked list of models in turn when the resolver refuses one
---

# ADR-008: The skill ranks the models, and lets tries them in order

## Context

This builds on ADR-006: a resolver reports the models it can run, runs exactly the one it is given, and exits 3 when the harness or the account refuses it. The caller then tries another model.

Three skills start sessions through `lets delegate`: a plan review, a code review, and the handoff that starts a build. Each must choose a model by the user's guidance and the author's family, and each must try the next model when one is refused. The choosing needs judgment that only the skill has. The trying is the same mechanical loop every time.

## Decision

The skill ranks the models and passes all of them to `run`, in order, as repeated `--model` values. `lets` sends the first model to the resolver that answers. While that resolver refuses, `lets` sends it the next model. It stops at the first answer that is not a refusal. A refusal never moves the request to a later resolver in the chain. When every model is refused, `run` exits 3 and names each model with its refusal.

## Consequences

- Easier: the retry is tested code in one place, not the same loop written in prose in three skills.
- Easier: one call per delegation, with one exit code and one metadata line, which names the model that ran.
- Easier: a resolver stays as ADR-006 left it. It runs one model per request and never chooses.
- Harder: the skill must rank every option it might accept before it calls, and cannot change its mind after seeing the first refusal's reason.
- Harder: exit 3 now means every listed model was refused. A caller that passes one model sees the old meaning.

## Alternatives Considered

### Alternative 1: The skill calls once per model
- **Pros**: the skill sees each refusal's reason before choosing the next model.
- **Cons**: each of the three skills carries the same loop, its stopping rules and its error handling, in prose an agent must follow exactly.
- **Why not**: a loop in prose is followed loosely, and differs between skills. A refusal's reason rarely changes which model to try next, so seeing it gains little.

### Alternative 2: The resolver tries the models
- **Pros**: no extra process start for each refused model.
- **Cons**: the ranked list goes back into the resolver contract, and every resolver must carry the loop.
- **Why not**: ADR-006 removed choice and fallback from resolvers on purpose. A list in the request is the design it replaced.

### Alternative 3: A refusal moves to the next resolver in the chain
- **Pros**: a second harness might run a model the first refused.
- **Cons**: the chain says which harness is in use. A refusal means the harness answered and said no, which is not the same as not applying here.
- **Why not**: a review would run in a harness the user did not expect. The chain's order would stop meaning "the first that applies answers".
