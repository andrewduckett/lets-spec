# lets-delegate-subagent

The default resolver. `lets` asks it when you have no delegate config, or
where your config's `resolvers` lists `subagent`. It never declines, and it
starts no session.

You do not install it. `lets` ships it and runs it for you.

| Request | What it does |
|---|---|
| A review (`run`) | Starts nothing, and exits 3. The review skill then runs the review in a subagent. |
| A handoff (`start`) | Saves the prompt to `.workspace/lets-delegate/<name>.prompt.md` in the repository, and gives back the prompt and that path, so you can start any agent with it. |
| `probe` | Answers `{"resolver":"subagent","options":[]}`: it can run no model. |
| `finish` | Does nothing, and prints nothing. It never issues a handle. |

To get a fresh session in another model family, install a resolver, such
as [`lets-delegate-t3`](t3.md) for T3 Code or
[`lets-delegate-cli`](cli.md) for any terminal, and
list it in your delegate config before `subagent`. Every resolver keeps
[the resolver contract](../resolver-contract.md).

## Where lets finds it

`lets` runs it from `resolvers/lets-delegate-subagent` beside itself, with
the same Node that runs `lets`: with no config, after the resolver
`LETS_SPEC_RESOLVER` names, if any; or at the place in the chain where
your config lists `subagent`. A path to some other copy of the program in
the config is just another resolver to `lets`. Each way of getting `lets`
carries a copy there:

| You run lets from | The copy is |
|---|---|
| The release tarball | `resolvers/lets-delegate-subagent` in the release folder |
| The Nix `lets` package | `resolvers/lets-delegate-subagent` in the package |
| A checkout of this repository | `lets/resolvers/lets-delegate-subagent`, the dev entry itself, with no link |

If the copy is missing, or Node cannot run it, `lets delegate` exits 4
and says the `lets` install is incomplete. Reinstall `lets` to fix it.

## Develop it

The program is built on the resolver kit's verb layer, in
`lets/src/resolvers/kit/`. `lets/src/resolvers/subagent/subagent.ts` holds
its answers, and its tests are in `tests/lets/resolvers/subagent/`.

```sh
node --test tests/lets/resolvers/subagent/*.test.ts
node lets/bin/lets delegate verify lets/resolvers/lets-delegate-subagent
```
