# Upgrading

Some releases change something you set up yourself. Read the note for
each release after the one you have, up to the one you are moving to.
The newest release comes first, and each heading names the release that
made the change.

The steps to move the pin itself are in
[Updating](../README.md#-updating).

## 0.6: the resolvers' dev entries moved

The resolvers' source now lives in the `lets` package. A release, the
Nix packages and mise installs are unchanged. Only a link into a checkout
of this repository changes.

| You installed it with | Do this |
|---|---|
| A checkout of this repo | Link `lets/resolvers/lets-delegate-t3` or `lets/resolvers/lets-delegate-cli` instead |

## 0.5: the default resolver answers as `subagent`

The JSON line that `lets delegate handoff run` prints has `"resolver":"subagent"`.
Before 0.5 it said `"default"`, so update any script that
matches on it.

## 0.5: `lets-delegate-resolver` is gone

`lets-delegate-resolver`, which served both harnesses, is gone, and `lets`
no longer looks on your `PATH` for it. Install the resolver for your
harness in its place, then list its path in your
[delegate config](../README.md#set-up-delegation). Until you do, reviews fall to the
default, `lets-delegate-subagent`.

| You installed it with | Do this |
|---|---|
| home-manager | Change `lets-delegate-resolver` to `lets-delegate-t3` or `lets-delegate-cli` in `home.packages` |
| A Nix profile | Run `nix profile remove lets-delegate-resolver`, then `nix profile add github:sidereal-io/lets-spec#lets-delegate-t3`, or `#lets-delegate-cli` |
| mise | Remove the `lets-delegate-resolver` link from `~/.local/bin`, and link `contrib/lets-delegate-t3` or `contrib/lets-delegate-cli` from the release folder |
| A checkout of this repo | Link `contrib/t3-resolver/bin/lets-delegate-t3` or `contrib/cli-resolver/bin/lets-delegate-cli` instead |

## 0.3: `lets-sync` is now `lets sync`

Version 0.1 had a command named `lets-sync`. It is now `lets sync`, and it
needs Node 26.

With mise, change these two lines in your project's `mise.toml` when you
move the pin:

```toml
node = "26"           # was "24"
enter = "lets sync"   # was "lets-sync"
```

Until you change the hook, entering the project fails with "command not
found", and nothing is synced.

With Nix and the flake module, change nothing but the pin. If your own
shell hook or CI runs `lets-sync`, change it to `lets sync`.

## 0.1: from a version that linked the skills

Older versions of Let's Spec linked the skills into the project, and had
git ignore the links. The first run of this version:

- replaces each link with a copy of the files
- removes the section the old version kept in git's local exclude file
- asks you to commit

That first commit is large. Later updates change only what changed.

`openspec/config.yaml` must name your flow's schema, the one the release
you installed ships as its default. If it does not, `lets sync` warns with
the value to set.
