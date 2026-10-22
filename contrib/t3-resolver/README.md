# lets-delegate-t3

A resolver for T3 Code. When a Let's Spec skill asks `lets delegate` for a
fresh session, this resolver opens it as a T3 thread, so you can watch it
work.

| You work in | A review runs as | A handoff starts |
|---|---|---|
| T3 Code | A new thread, archived when the review succeeds | A new thread in the sidebar |
| Anything else | It declines, and the default, `lets-delegate-subagent`, answers | It declines, and the default, `lets-delegate-subagent`, answers |

It counts as inside T3 Code only when the running T3 server started it,
through any number of parent processes. A terminal outside T3 Code
declines, even while T3 Code runs. When it declines, it says
`lets-delegate-t3: not inside T3 Code` on stderr.

For herdr, install [`lets-delegate-herdr`](../herdr-resolver/README.md)
instead. Every resolver keeps [the resolver
contract](../../docs/resolver-contract.md).

This page covers:

- [Install it](#install-it)
- [Name it in your delegate config](#name-it-in-your-delegate-config)
- [Before the first review in T3 Code](#before-the-first-review-in-t3-code)
- [Check that it works](#check-that-it-works)
- [After a t3 update](#after-a-t3-update)

## Install it

Install it once for your user, not in a project. It answers "is this
process inside T3 Code?", and that is true of your machine, not of a
repository.

It needs Node 26 or later. It runs `t3` and `git` from your `PATH`.

### With home-manager

Add this repo as a flake input, then add the package:

```nix
home.packages = [
  inputs.lets-spec.packages.${pkgs.stdenv.hostPlatform.system}.lets-delegate-t3
];
```

### With a Nix profile

```sh
nix profile add github:andrewduckett/lets-spec#lets-delegate-t3
```

### With mise

The release tarball holds the resolver at `contrib/lets-delegate-t3`,
outside `bin/`, so mise never puts it on a project's `PATH`. Link it onto
yours. Use the `lets-spec` version from your project's `mise.toml`:

```sh
ln -sf "$(mise where github:andrewduckett/lets-spec@<version>)/contrib/lets-delegate-t3" ~/.local/bin/
```

The link names one version. After you update `lets-spec`, run it again
with the new version.

### From a checkout of this repo

To try a change to the resolver, link its dev entry instead, or set
`LETS_SPEC_RESOLVER` to its path:

```sh
ln -sf "$PWD/contrib/t3-resolver/bin/lets-delegate-t3" ~/.local/bin/
```

Run `pnpm install` in the checkout first.

## Name it in your delegate config

`lets` does not look for `lets-delegate-t3` on your `PATH`. Name it in your
delegate config after you install it:

```sh
lets delegate setup --resolver "$(command -v lets-delegate-t3)" --write
```

This records the resolver, with the models your accounts can run. A review
then runs the first of those models that T3 Code can start.

Pass `--resolver` again each time you run setup with `--write`. Setup does
not find `lets-delegate-t3` by itself yet, so without the flag it writes a config
with no resolver, and reviews fall to the default, `lets-delegate-subagent`.

The config names one resolver. If you also work in herdr, name the
resolver for the harness you review from most. Reviews in the other
harness fall to the default, `lets-delegate-subagent`.

## Before the first review in T3 Code

Add your repository as a T3 project once:

```sh
t3 project add <path>
```

The resolver keeps a T3 token in `~/.config/lets-delegate/t3-token`. It
issues a new one when T3 rejects it.

## Check that it works

From inside a project, run:

```sh
command -v lets-delegate-t3
lets delegate conformance lets-delegate-t3
```

Expect a path, then `The resolver keeps the contract.` The check starts
nothing. In a plain terminal, the check passes because the resolver
declines.

To run a real session, see [After a t3 update](#after-a-t3-update).

## After a t3 update

The resolver depends on t3's internal protocol and database: it speaks
orchestration protocol 2, makes each thread with the same `launchThread`
request as the T3 UI, and reads the result from `statev2.sqlite`. A t3
update can break it. After each update, run these from a T3 thread in a
project that T3 knows:

```sh
lets delegate conformance --live lets-delegate-t3
printf 'Reply with the single word READY and nothing else.\n' > .workspace/p.md
lets delegate review --name smoke-review --prompt-file .workspace/p.md \
  --source-family claude --effort low
```

Expect:

1. Every check passes, with `t3` answering.
2. A new thread from the `start` check. Close it when you are done.
3. `READY` on stdout.
4. A JSON line on stderr with `"resolver":"t3"` and `"independent":true`.
5. An archived thread for the review.

The live check spends tokens. CI never runs it.
