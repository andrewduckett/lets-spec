---
id: adr-005
date: 2026-10-21
status: accepted
title: 'ADR-005: The config lists the resolvers to ask, in order, and lets detects nothing'
description: Architecture decision record (ADR) for lets asking only the resolvers the user's config lists, in the order listed, with no lookup on PATH and no harness detection at run time
---

# ADR-005: The config lists the resolvers to ask, in order, and lets detects nothing

## Context

`lets delegate` hands a review or a handoff to a resolver, a program for one harness that answers inside it and declines anywhere else (ADR-003). `lets` used to find the resolver to ask in four places at run time: an environment variable, one `resolver` path in the user's config, a program with a fixed name on `PATH`, and the default, `lets-delegate-subagent`, which `lets` appended to every lookup with rules of its own. So which resolver ran a review depended on what happened to be on `PATH` and on a special case in `lets`, and a user could not see or change the order. Each harness now has its own resolver. The only thing left to decide is which ones to ask, and in what order. That is a choice about the user's machine, and only the user can make it. One constraint shapes how the default is named: `lets` ships its own copy beside itself, at a path that moves with every update on Nix, and runs it with its own Node because nothing puts a Node on `PATH`.

## Decision

The user's config lists the resolvers to ask, in order: absolute paths, and the word `subagent` for the default that ships beside the running `lets`. `lets` asks the one `LETS_SPEC_RESOLVER` names, if any, then each entry in turn, and stops at the first that does not decline. It looks on `PATH` for nothing, detects no harness, and appends nothing. With no config at all, it asks the override, if any, then its own default, and nothing else.

## Consequences

- Easier: one order for every resolver, including the default, which the user places in the chain by name. A listed path is a path, whether this project or someone else wrote the program.
- Easier: the user reads the order in one file, and changes it by editing that file. What answers in a given harness follows from the order and from which resolvers decline there.
- Easier: a resolver that is missing or declines everywhere fails with a message that names the file to fix, not a guess about what should have been installed.
- Harder: a fresh machine gets a fresh session only after the user writes the file. Until then every review runs as a subagent.
- Harder: the file holds absolute paths, so an install that moves, such as a new Nix store path after an update, needs the file updated. Only the default escapes this, because `subagent` names the running `lets`'s own copy.
- Harder: nothing in `lets` can notice a resolver that is installed but not listed. A user who installs one and forgets the file sees no change.

## Alternatives Considered

### Alternative 1: Keep a fixed-name program on PATH as a fallback
- **Pros**: installing a resolver is enough, with no file to write.
- **Cons**: the order between the fallback and the listed resolvers is a rule inside `lets` that the user cannot see, and two installed resolvers compete for one name.
- **Why not**: the chain exists so that the user decides the order. A fallback that `lets` finds on its own puts a second decision maker beside the file.

### Alternative 2: Always append the shipped default to the chain
- **Pros**: a config can never end in "every resolver declined".
- **Cons**: the default needs its own rules in the lookup, and a user who wants a review to fail rather than run as a subagent cannot say so.
- **Why not**: it keeps the appending this decision removes. The user places the default in the chain by name, and a user who leaves it out gets a clear error that names the file.

### Alternative 3: Detect the harness in `lets` and pick the resolver for it
- **Pros**: no file at all, when every harness has exactly one resolver.
- **Cons**: `lets` would carry a detection rule for every harness, which is what each resolver already knows about itself, and a third-party resolver would have no way in.
- **Why not**: ADR-003 put "where am I" inside each resolver. Repeating it in `lets` means two places to update for every harness.
