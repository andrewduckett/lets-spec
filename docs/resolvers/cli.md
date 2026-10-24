# cli

A resolver for any terminal, built into `lets`. When a Let's Spec skill asks `lets delegate`
for a review, this resolver runs it headless with the command line tool
(CLI) of another model family: `codex`, `claude` or `agy`. It works in a
plain terminal, or inside another harness.

| Where you work | A review runs as | A handoff |
|---|---|---|
| Anywhere with `codex`, `claude` or `agy` on your `PATH` | A child process of that CLI, in its read-only mode | It declines, and the next resolver in your config answers |
| Anywhere with none of them | It declines, and the next resolver in your config answers | It declines, and the next resolver in your config answers |

This page covers:

- [Which models it lists](#which-models-it-lists)
- [How a review runs](#how-a-review-runs)
- [List it in your delegate config](#list-it-in-your-delegate-config)
- [Check that it works](#check-that-it-works)

## Which models it lists

`probe` lists the models each CLI on your `PATH` reports, in the order
`gpt`, `claude`, `gemini`:

| Family | Listed from | What it lists |
|---|---|---|
| `gpt` | `codex debug models` | `gpt/<model>` for each model codex shows, not the hidden ones |
| `claude` | nothing: `claude` cannot list its models | the bare family `claude`, which runs claude's default model |
| `gemini` | `agy models` | `gemini/<model>` for each Gemini model, once, without its effort |

Each listing gets 20 seconds. When one fails, for example because codex
is signed out, `probe` lists the bare family instead, such as `gpt`, and
says why on stderr.

A `probe` for `start`, which `lets delegate handoff instructions` sends,
declines at once and runs no listing, because this resolver never starts
a handoff.

## How a review runs

It runs the CLI of the family that `--model` names, in the repository,
and waits for its final message:

| Family | Command | The prompt goes | The answer comes from |
|---|---|---|---|
| `gpt` | `codex exec -s read-only` | on stdin | `.workspace/lets-delegate/<name>.last-message.md` |
| `claude` | `claude -p --permission-mode plan` | on stdin | stdout |
| `gemini` | `agy --mode plan … -p <prompt>` | in the arguments | stdout |

Each command gets the review's effort, and the model that `--model` names,
with `-m` for codex and `--model` for the others. A Gemini model also
gets the effort, as `gemini-3.8-flash-high`. A bare family passes no
model, so the CLI runs its default. It tries a model it did not list, too.
When the review succeeds, `finish` removes the
session's files in `.workspace/lets-delegate/`. When it fails, they stay,
so you can read them.

A review that runs past its time limit is stopped. Each failure has its
own exit code:

| What happened | Exit |
|---|---|
| The CLI cannot start | 3 |
| The CLI exits non-zero having printed nothing, such as for a model it cannot run | 3 |
| The CLI prints and then exits non-zero, or ends with an empty message | 5 |
| The CLI runs past the time limit | 6 |

Exit 3 is a refusal: the caller can try another model.

## List it in your delegate config

There is nothing to install: `cli` is part of `lets`. It needs at least
one of `codex`, `claude` or `agy` on your `PATH`.

Add `cli` to `resolvers` in `~/.config/lets-delegate/config.yaml`. List
it after the resolvers for your harnesses, and before `subagent`:

```yaml
version: 2
resolvers:
  - t3
  - cli
  - subagent
```

The README's [Set up delegation](../../README.md#set-up-delegation)
section explains the file.

It declines every handoff, so keep `subagent` after it: a handoff then
falls through to the default, which gives you the prompt to start any
agent with.

## Check that it works

From inside a project, run:

```sh
lets delegate review instructions --for code
```

Expect one JSON line with `"resolver":"cli"`, and a model for each CLI
on your `PATH` in `options`. It starts nothing.

To run a real review, run this in a project:

```sh
printf 'Reply with the single word READY and nothing else.\n' > .workspace/p.md
lets delegate review run --for code --name smoke-review --prompt-file .workspace/p.md \
  --source-family claude --effort low --model gpt
```

Expect `READY` on stdout, and a JSON line on stderr with
`"resolver":"cli"`. It spends tokens. CI never runs it.
