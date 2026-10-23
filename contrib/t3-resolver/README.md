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

For any other terminal, install [`lets-delegate-cli`](../cli-resolver/README.md)
too. Every resolver keeps [the resolver
contract](../../docs/resolver-contract.md).

This page covers:

- [Install it](#install-it)
- [List it in your delegate config](#list-it-in-your-delegate-config)
- [Before the first review in T3 Code](#before-the-first-review-in-t3-code)
- [Check that it works](#check-that-it-works)
- [After a t3 update](#after-a-t3-update)

## Install it

Install it once for your user, not in a project. It answers "is this
process inside T3 Code?", and that is true of your machine, not of a
repository.

It runs on Linux and macOS. It needs Node 26 or later. It runs `t3` and
`git` from your `PATH`.

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

## List it in your delegate config

`lets` does not look for `lets-delegate-t3` on your `PATH`. After you
install it, add its full absolute path to `resolvers` in
`~/.config/lets-delegate/config.yaml`, before `subagent`:

```yaml
version: 2
resolvers:
  - /home/you/.nix-profile/bin/lets-delegate-t3
  - subagent
```

`command -v lets-delegate-t3` prints the path to use. `lets` does not
expand `~`. The README's
[Set up delegation](../../README.md#set-up-delegation) section explains
the file.

It declines outside T3 Code. If you also work in other terminals, list
[`lets-delegate-cli`](../cli-resolver/README.md) after it: outside T3
Code, that one answers.

## Which model runs

The caller chooses the model, and the resolver runs exactly that one:

- `probe` lists the models in T3 Code's catalog, as `<family>/<model>`.
  It takes each provider in the catalog's order, with that provider's
  default model first. It lists each Gemini model once, without its
  effort.
- A review or a handoff runs the model that `--model` names. A bare
  family, such as `claude`, runs that provider's default model.
- When T3 Code or your account says no before the model answers, the
  resolver exits 3, says why on stderr, and archives any thread it
  started. Examples are a model your account cannot run, T3 Code not
  running, and a repository with no T3 project. The caller can then try
  another model.

## Before the first review in T3 Code

Add your repository as a T3 project once:

```sh
t3 project add <path>
```

The resolver keeps a T3 token beside `lets`'s own `config.yaml`:

- in `$XDG_CONFIG_HOME/lets-delegate/t3-token` when `XDG_CONFIG_HOME` is
  set
- in `~/.config/lets-delegate/t3-token` otherwise

It issues a new token when none is stored there, or when T3 rejects the
one it has. T3 Code keeps its data in `~/.t3`. If you set `T3CODE_HOME`,
the resolver reads T3 Code's data from that folder instead, and issues
its tokens against it.

## Check that it works

From inside a project, run:

```sh
command -v lets-delegate-t3
lets delegate verify lets-delegate-t3
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
lets delegate verify --live lets-delegate-t3
printf 'Reply with the single word READY and nothing else.\n' > .workspace/p.md
lets delegate review run --for code --name smoke-review --prompt-file .workspace/p.md \
  --source-family claude --effort low --model gpt
```

Expect:

1. Every check passes, with `t3` answering.
2. A new thread from the `start` check. Close it when you are done.
3. `READY` on stdout.
4. A JSON line on stderr with `"resolver":"t3"` and `"independent":true`.
5. An archived thread for the review.

The live check spends tokens. CI never runs it.
