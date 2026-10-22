# lets-delegate-herdr

A resolver for herdr. When a Let's Spec skill asks `lets delegate` for a
fresh session, this resolver opens it as a herdr tab, so you can watch it
work.

| You work in | A review runs as | A handoff starts |
|---|---|---|
| herdr | A new tab, closed when the review succeeds | A new tab |
| Anything else | It declines, and the default, `lets-delegate-subagent`, answers | It declines, and the default, `lets-delegate-subagent`, answers |

It counts as inside herdr only when `HERDR_ENV` is `1` and `herdr` is on
your `PATH`. When it declines, it says
`lets-delegate-herdr: not inside herdr` on stderr.

For T3 Code, install [`lets-delegate-t3`](../t3-resolver/README.md)
instead. Every resolver keeps [the resolver
contract](../../docs/resolver-contract.md).

This page covers:

- [Install it](#install-it)
- [List it in your delegate config](#list-it-in-your-delegate-config)
- [Check that it works](#check-that-it-works)

## Install it

Install it once for your user, not in a project. It answers "is this
process inside herdr?", and that is true of your machine, not of a
repository.

It needs Node 26 or later. It runs `herdr` from your `PATH`, and the
command line tool of each model family a review can use: `codex`,
`claude` or `agy`.

### With home-manager

Add this repo as a flake input, then add the package:

```nix
home.packages = [
  inputs.lets-spec.packages.${pkgs.stdenv.hostPlatform.system}.lets-delegate-herdr
];
```

### With a Nix profile

```sh
nix profile add github:andrewduckett/lets-spec#lets-delegate-herdr
```

### With mise

The release tarball holds the resolver at `contrib/lets-delegate-herdr`,
outside `bin/`, so mise never puts it on a project's `PATH`. Link it onto
yours. Use the `lets-spec` version from your project's `mise.toml`:

```sh
ln -sf "$(mise where github:andrewduckett/lets-spec@<version>)/contrib/lets-delegate-herdr" ~/.local/bin/
```

The link names one version. After you update `lets-spec`, run it again
with the new version.

### From a checkout of this repo

To try a change to the resolver, link its dev entry instead, or set
`LETS_SPEC_RESOLVER` to its path:

```sh
ln -sf "$PWD/contrib/herdr-resolver/bin/lets-delegate-herdr" ~/.local/bin/
```

Run `pnpm install` in the checkout first.

## List it in your delegate config

`lets` does not look for `lets-delegate-herdr` on your `PATH`. After you
install it, add its full absolute path to `resolvers` in
`~/.config/lets-delegate/config.yaml`, before `subagent`:

```yaml
version: 2
resolvers:
  - /home/you/.nix-profile/bin/lets-delegate-herdr
  - subagent
```

`command -v lets-delegate-herdr` prints the path to use. `lets` does not
expand `~`. The README's
[Set up delegation](../../README.md#set-up-delegation) section explains
the file.

It declines outside herdr. If you also work in T3 Code, list the
resolver for that harness too: the one for the harness you are in
answers.

## Check that it works

From inside a project, run:

```sh
command -v lets-delegate-herdr
lets delegate conformance lets-delegate-herdr
```

Expect a path, then `The resolver keeps the contract.` The check starts
nothing. Outside herdr, the check passes because the resolver declines.

To run a real session, run this from a herdr pane in a project:

```sh
lets delegate conformance --live lets-delegate-herdr
```

It spends tokens, and opens a tab. CI never runs it.
