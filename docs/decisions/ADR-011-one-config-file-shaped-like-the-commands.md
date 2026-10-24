---
id: adr-011
date: 2026-10-24
status: accepted
title: 'ADR-011: lets has one config file, shaped like its commands'
description: Architecture decision record (ADR) for keeping every lets setting in one file under ~/.config/lets/, with one section per command group and each setting at the path of the command that reads it
---

# ADR-011: lets has one config file, shaped like its commands

> Builds on [ADR-002](ADR-002-lets-owns-the-delegate-config.md): only `lets` reads the config. This record says where the file lives and how it is laid out.

## Context

`lets` reads one user-level file, which the user writes by hand on each machine. It used to be `~/.config/lets-delegate/config.yaml`, named for the `lets delegate` command group. Its keys assumed delegation was all there is: `resolvers` at the top level, and `delegations.<intent>.guidance`, which listed the intents `plan`, `code` and `apply` side by side. In fact `plan` and `code` belong to `lets delegate review`, and `apply` belongs to `lets delegate handoff`. The next setting for another command group, such as `lets sync`, would have needed either a second file or a key in a file named for something else. The file's location and shape are a contract with every user's machine, so each change to them breaks every user's setup.

## Decision

`lets` keeps all its settings in one file, `$XDG_CONFIG_HOME/lets/config.yaml`, or `~/.config/lets/config.yaml`. Files that belong to `lets`, such as the T3 token, sit in the same folder. The file has a top-level `version` and one section per command group, named after the group: `delegate:` now, and a later `sync:` beside it. Within a section, each setting sits at the path of the command that reads it: the chain is `delegate.resolvers`, and guidance is `delegate.<strategy>.<intent>.guidance`, such as `delegate.review.code.guidance` for `lets delegate review --for code`.

## Consequences

- Easier: a new setting for any command group has an obvious home. It is a new section, or a key within one, and existing keys keep their meaning.
- Easier: a user can find a setting from the command, and the reverse. The key in an error message is the key in the file.
- Easier: the user sets up one folder per machine, and keys this `lets` does not know are ignored, so a newer file still works with an older `lets`.
- Harder: every setting is one level deeper than it would be in a file of its own, and guidance is three levels below `delegate`.
- Harder: one version number covers every section. A breaking change to one command group's settings bumps the version for the whole file.
- Harder: a new strategy or intent in `lets delegate` brings a new key path with it. The config cannot group guidance in a way the commands don't.

## Alternatives Considered

### Alternative 1: One file per command group
- **Pros**: each file can change version alone, and each command reads only its own file.
- **Cons**: the user sets up and backs up several files on each machine, and a setting shared by two groups has no clear home.
- **Why not**: `lets` is one tool to the user. One file in one folder is what they look for, and the cost of separate files is paid by every user while the benefit appears only when two groups change at once.

### Alternative 2: One file with flat keys at the top level
- **Pros**: the shortest keys, such as `resolvers`, and no reshaping of the existing delegate settings.
- **Cons**: keys from different command groups sit side by side with nothing to say which group reads them. `resolvers` already says nothing about delegation.
- **Why not**: the file would read as delegation settings with others added later. Grouping it then would be another breaking change to every user's file.

### Alternative 3: Group guidance by intent alone, as `delegate.delegations.<intent>`
- **Pros**: one flat list of the three intents, as the old file had.
- **Cons**: it hides which strategy each intent belongs to, and its key path matches no command.
- **Why not**: the commands are grouped by strategy, and each strategy takes only its own intents. A key path that follows the commands keeps that rule visible in the file.
