# lets-delegate-subagent

The default resolver. When no other resolver answers a `lets delegate`
request, this one does. It never declines, and it starts no session.

You do not install it. `lets` ships it and runs it for you.

| Request | What it does |
|---|---|
| A review (`run`) | Starts nothing, and exits 3. The review skill then runs the review in a subagent. |
| A handoff (`start`) | Saves the prompt to `.workspace/lets-delegate/<name>.prompt.md` in the repository, and gives back the prompt and that path, so you can start any agent with it. |
| `probe` | Answers `{"resolver":"subagent"}`. |
| `finish` | Does nothing, and prints nothing. It never issues a handle. |

To get a fresh session in another model family, install the resolver for
your harness, such as [`lets-delegate-t3`](../t3-resolver/README.md) or
[`lets-delegate-herdr`](../herdr-resolver/README.md). Every resolver keeps
[the resolver contract](../../docs/resolver-contract.md).

## Where lets finds it

`lets` runs it as the last resolver it asks, from
`contrib/lets-delegate-subagent` beside itself, with the same Node that
runs `lets`. Each way of getting `lets` carries a copy there:

| You run lets from | The copy is |
|---|---|
| The release tarball | `contrib/lets-delegate-subagent` in the release folder |
| The Nix `lets` package | `contrib/lets-delegate-subagent` in the package |
| A checkout of this repository | `lets/contrib/lets-delegate-subagent`, a link to `bin/lets-delegate-subagent` here |

If the copy is missing, or Node cannot run it, `lets delegate` exits 4
and says the `lets` install is incomplete. Reinstall `lets` to fix it.

## Develop it

The program is built on the resolver kit's verb layer, in
`../resolver-kit/`. `src/subagent.ts` holds its answers, and its tests are
in `tests/subagent-resolver/`.

```sh
node --test tests/subagent-resolver/*.test.ts
node lets/bin/lets delegate conformance contrib/subagent-resolver/bin/lets-delegate-subagent
```
