# lets-delegate-cli

A resolver for any terminal. When a Let's Spec skill asks `lets delegate`
for a review, this resolver runs it headless with the command line tool
(CLI) of another model family: `codex`, `claude` or `agy`. It works in a
plain terminal, in herdr, or inside another harness.

| Where you work | A review runs as | A handoff |
|---|---|---|
| Anywhere with `codex`, `claude` or `agy` on your `PATH` | A child process of that CLI, in its read-only mode | It declines, and the next resolver in your config answers |
| Anywhere with none of them | It declines, and the next resolver in your config answers | It declines, and the next resolver in your config answers |

When none of the three is on your `PATH`, it says
`lets-delegate-cli: none of codex, claude or agy is on PATH` on stderr.
When it declines a handoff, it says
`lets-delegate-cli: this resolver only runs headless`.

Every resolver keeps [the resolver
contract](../../docs/resolver-contract.md).

This page covers:

- [How a review runs](#how-a-review-runs)
- [Install it](#install-it)
- [List it in your delegate config](#list-it-in-your-delegate-config)
- [Check that it works](#check-that-it-works)

## How a review runs

It picks a family whose CLI is on your `PATH`, from another family than
the author's when it can. It runs that CLI in the repository, and waits
for its final message:

| Family | Command | The prompt goes | The answer comes from |
|---|---|---|---|
| `gpt` | `codex exec -s read-only` | on stdin | `.workspace/lets-delegate/<name>.last-message.md` |
| `claude` | `claude -p --permission-mode plan` | on stdin | stdout |
| `gemini` | `agy --mode plan … -p <prompt>` | in the arguments | stdout |

Each command gets the review's effort, and the reviewer's model when
`lets` names one. When the review succeeds, `finish` removes the
session's files in `.workspace/lets-delegate/`. When it fails, they stay,
so you can read them.

A review that runs past its time limit is stopped. Each failure has its
own exit code:

| What happened | Exit |
|---|---|
| The CLI cannot start | 4 |
| The CLI exits non-zero, or ends with an empty message | 5 |
| The CLI runs past the time limit | 6 |

## Install it

Install it once for your user, not in a project. Which CLIs are on your
`PATH` is a fact about your machine, not about a repository.

It needs Node 26 or later, and at least one of `codex`, `claude` or `agy`
on your `PATH`.

### With home-manager

Add this repo as a flake input, then add the package:

```nix
home.packages = [
  inputs.lets-spec.packages.${pkgs.stdenv.hostPlatform.system}.lets-delegate-cli
];
```

### With a Nix profile

```sh
nix profile add github:andrewduckett/lets-spec#lets-delegate-cli
```

### With mise

The release tarball holds the resolver at `contrib/lets-delegate-cli`,
outside `bin/`, so mise never puts it on a project's `PATH`. Link it onto
yours. Use the `lets-spec` version from your project's `mise.toml`:

```sh
ln -sf "$(mise where github:andrewduckett/lets-spec@<version>)/contrib/lets-delegate-cli" ~/.local/bin/
```

The link names one version. After you update `lets-spec`, run it again
with the new version.

### From a checkout of this repo

To try a change to the resolver, link its dev entry instead, or set
`LETS_SPEC_RESOLVER` to its path:

```sh
ln -sf "$PWD/contrib/cli-resolver/bin/lets-delegate-cli" ~/.local/bin/
```

Run `pnpm install` in the checkout first.

## List it in your delegate config

`lets` does not look for `lets-delegate-cli` on your `PATH`. After you
install it, add its full absolute path to `resolvers` in
`~/.config/lets-delegate/config.yaml`. List it after the resolvers for
your harnesses, and before `subagent`:

```yaml
version: 2
resolvers:
  - /home/you/.nix-profile/bin/lets-delegate-t3
  - /home/you/.nix-profile/bin/lets-delegate-cli
  - subagent
```

`command -v lets-delegate-cli` prints the path to use. `lets` does not
expand `~`. The README's
[Set up delegation](../../README.md#set-up-delegation) section explains
the file.

It declines every handoff, so keep `subagent` after it: a handoff then
falls through to the default, which gives you the prompt to start any
agent with.

## Check that it works

From inside a project, run:

```sh
command -v lets-delegate-cli
lets delegate verify lets-delegate-cli
```

Expect a path, then `The resolver keeps the contract.` The check starts
nothing.

To run a real review, run this in a project:

```sh
lets delegate verify --live lets-delegate-cli
```

It spends tokens. The handoff check passes with a note that the next
resolver answers handoffs. CI never runs it.
