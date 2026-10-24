# subagent

The default resolver, built into `lets`. `lets` asks it when you have no
delegate config, or where your config's `resolvers` lists `subagent`. It
never declines, and it starts no session.

You do not install it: it is part of `lets`, and needs nothing else.

| Request | What it does |
|---|---|
| A review (`run`) | Starts nothing, and exits 3. The review skill then runs the review in a subagent. |
| A handoff (`start`) | Saves the prompt to `.workspace/lets-delegate/<name>.prompt.md` in the repository, and gives back the prompt and that path, so you can start any agent with it. |
| `probe` | Answers `{"resolver":"subagent","options":[]}`: it can run no model. |
| `finish` | Does nothing, and prints nothing. It never issues a handle. |

To get a fresh session in another model family, list another resolver,
such as [`t3`](t3.md) for T3 Code or [`cli`](cli.md) for any terminal,
in your delegate config before `subagent`.

## Develop it

`lets/src/resolvers/subagent/subagent.ts` holds its answers, and its
tests are in `tests/lets/resolvers/subagent/`.

```sh
node --test tests/lets/resolvers/subagent/*.test.ts
node lets/bin/lets delegate verify lets/resolvers/lets-delegate-subagent
```
