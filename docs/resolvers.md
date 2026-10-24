# The resolvers

A resolver is the part of `lets` that turns a review or a handoff into a
real session in one harness. `lets` has three, and you choose them by name
under `delegate.resolvers` in your `lets` config. There is nothing to install. The README's
[Set up delegation](../README.md#set-up-delegation) section explains the
config file.

| Name | It answers | It needs | A review runs as | A handoff |
|---|---|---|---|---|
| [`t3`](#t3) | Inside T3 Code | T3 Code running | A new thread, archived when the review succeeds | Starts a new thread in the sidebar |
| [`cli`](#cli) | In any terminal | `codex`, `claude` or `agy` on your `PATH` | A child process of that CLI, in its read-only mode | Declines, so the next resolver answers |
| [`subagent`](#subagent) | Anywhere | nothing | Nothing: the skill runs the review in a subagent | Gives back the prompt to start any agent with |

Each one declines where it cannot work, and the next in your config is
asked. List them in this order, and leave out any you do not use:

```yaml
version: 3
delegate:
  resolvers:
    - t3
    - cli
    - subagent
```

## `t3`

`t3` opens each fresh session as a T3 Code thread, so you can watch it
work. It runs on Linux and macOS, and runs `t3` and `git` from your
`PATH`.

It counts as inside T3 Code only when the running T3 server started
`lets`, through any number of parent processes. A terminal outside T3
Code declines, even while T3 Code runs. If you also work in other
terminals, list `cli` after it.

### Which model runs

The caller chooses the model, and `t3` runs exactly that one:

- `lets delegate review instructions` and `handoff instructions` list
  the models in T3 Code's catalog, as `<family>/<model>`. They take each
  provider in the catalog's order, with that provider's default model
  first. They list each Gemini model once, without its effort.
- A review or a handoff runs the model that `--model` names. A bare
  family, such as `claude`, runs that provider's default model.
- When T3 Code or your account says no before the model answers, `t3`
  refuses: the command exits 3, says why on stderr, and archives any
  thread it started. Examples are a model your account cannot run, T3
  Code not running, and a repository with no T3 project. The caller can
  then try another model.

### Before the first review in T3 Code

Add your repository as a T3 project once:

```sh
t3 project add <path>
```

`t3` keeps a T3 token beside the `lets` config:

- in `$XDG_CONFIG_HOME/lets/t3-token` when `XDG_CONFIG_HOME` is
  set and not empty
- in `~/.config/lets/t3-token` otherwise

It issues a new token when none is stored there, or when T3 rejects the
one it has. T3 Code keeps its data in `~/.t3`. If you set `T3CODE_HOME`,
`t3` reads T3 Code's data from that folder instead, and issues its tokens
against it.

### After a t3 update

`t3` depends on T3 Code's internal protocol and database: it speaks
orchestration protocol 2, makes each thread with the same `launchThread`
request as the T3 UI, and reads the result from `statev2.sqlite`. A T3
Code update can break it. After each update, run these from a T3 thread
in a project that T3 knows:

```sh
printf 'Reply with the single word READY and nothing else.\n' > .workspace/p.md
lets delegate review run --for code --name smoke-review --prompt-file .workspace/p.md \
  --source-family claude --effort low --model gpt
```

Expect:

1. `READY` on stdout.
2. A JSON line on stderr with `"resolver":"t3"` and `"independent":true`.
3. An archived thread for the review.

The review spends tokens. CI never runs it.

## `cli`

`cli` runs each review headless with the command line tool (CLI) of a
model family: `codex`, `claude` or `agy`. It works in a plain terminal,
or inside another harness. It declines when none of the three is on your
`PATH`.

It never starts a handoff, so it declines every one, without running
anything. Keep `subagent` after it: a handoff then falls through to the
default, which gives you the prompt to start any agent with.

### Which models it lists

`lets delegate review instructions` lists the models each CLI on your
`PATH` reports, in the order `gpt`, `claude`, `gemini`:

| Family | Listed from | What it lists |
|---|---|---|
| `gpt` | `codex debug models` | `gpt/<model>` for each model codex shows, not the hidden ones |
| `claude` | nothing: `claude` cannot list its models | the bare family `claude`, which runs claude's default model |
| `gemini` | `agy models` | `gemini/<model>` for each Gemini model, once, without its effort |

Each listing gets 20 seconds. When one fails, for example because codex
is signed out, the bare family is listed instead, such as `gpt`, and a
line on stderr says why.

### How a review runs

`cli` runs the CLI of the family that `--model` names, in the repository,
and waits for its final message:

| Family | Command | The prompt goes | The answer comes from |
|---|---|---|---|
| `gpt` | `codex exec -s read-only` | on stdin | `.workspace/lets-delegate/<name>.last-message.md` |
| `claude` | `claude -p --permission-mode plan` | on stdin | stdout |
| `gemini` | `agy --mode plan … -p <prompt>` | in the arguments | stdout |

Each command gets the review's effort, and the model that `--model`
names, with `-m` for codex and `--model` for the others. A Gemini model
also gets the effort, as `gemini-3.8-flash-high`. A bare family passes no
model, so the CLI runs its default. `cli` also tries a model it did not
list. When the review succeeds, the session's files in
`.workspace/lets-delegate/` are removed. When it fails, they stay, so you
can read them.

A review that runs past its time limit is stopped. Each failure has its
own exit code:

| What happened | Exit |
|---|---|
| The CLI cannot start | 3 |
| The CLI exits non-zero having printed nothing, such as for a model it cannot run | 3 |
| The CLI prints and then exits non-zero, or ends with an empty message | 5 |
| The CLI runs past the time limit | 6 |

Exit 3 is a refusal: the caller can try another model.

## `subagent`

`subagent` is the default. `lets` asks it when your config lists no
`delegate.resolvers`, or where that list has `subagent`. It never declines, it can
run no model, and it starts no session.

| Request | What it does |
|---|---|
| A review | Starts nothing, and the command exits 3. The review skill then runs the review in a subagent. |
| A handoff | Saves the prompt to `.workspace/lets-delegate/<name>.prompt.md` in the repository, and gives back the prompt and that path, so you can start any agent with it. |
| `instructions` | Lists no models. |

To get a fresh session in another model family, list `t3` or `cli` before
`subagent` in `delegate.resolvers`.
