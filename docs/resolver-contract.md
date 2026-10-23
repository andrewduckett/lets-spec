# The resolver contract

`lets delegate` hands a fresh session to a resolver: a program that opens
the session, such as a T3 Code thread or a headless child process. This
page defines how `lets` and a resolver talk, for anyone who writes or
checks a resolver.

This page covers:

- [How `lets` finds a resolver](#how-lets-finds-a-resolver)
- [How `lets` runs a resolver](#how-lets-runs-a-resolver)
- [The request](#the-request)
- [The response](#the-response)
- [Exit codes](#exit-codes)
- [Rules for a resolver](#rules-for-a-resolver)
- [Write your own](#write-your-own)

The code that checks the contract is
[`lets/src/delegate/protocol.ts`](../lets/src/delegate/protocol.ts).

## How `lets` finds a resolver

`lets` asks these in order. The first that does not decline answers.

1. The executable that `LETS_SPEC_RESOLVER` names, when it is set. If the
   path is missing or not executable, `lets` exits 2.
2. Each resolver in the chain: the `resolvers` list in the user's
   delegate config, `~/.config/lets-delegate/config.yaml`, or under
   `XDG_CONFIG_HOME`. Each entry is an absolute path, or the word
   `subagent` for the default. When the lookup reaches a path that is
   missing or not an executable file, `lets` exits 2 and asks no later
   one.

With no config, the default takes the place of the chain. The default,
`lets-delegate-subagent`, never declines. It ships with `lets`, which runs
it from `contrib/lets-delegate-subagent` beside itself with its own Node,
and it answers as `subagent`. When that file is missing or Node cannot run
it, `lets` exits 4 and says its install is incomplete.

`lets` asks nothing it finds on `PATH`. When every resolver declines,
`lets` exits 2 and names the config file.

Only `lets` reads the config. The caller chooses the model: `lets` sends
each value of `--model` unchanged as the `model` of a `run` or `start`
request. A resolver runs that model, and never chooses one. It reports
the models it can run in its `probe` answer, so the caller can choose.

The caller may give `--model` more than once, best first. `lets` sends
the first model to the resolver the lookup finds. Each time that resolver
refuses with exit 3, `lets` sends the next model to the same resolver. A
refusal is an answer, not a decline, so no later resolver is asked.

## How `lets` runs a resolver

A resolver is any executable. `lets` runs it as `<resolver> <verb>`, from
the repository root. It writes one JSON object to the resolver's stdin and
reads one JSON object from its stdout. stderr is for people: `lets` shows
it when something fails.

| Verb | `lets` sends it | Answer |
|---|---|---|
| `probe` | for `lets delegate review instructions` and `lets delegate handoff instructions`, and the verify check | `{ resolver, options }` |
| `run` | for `lets delegate review run`, once for each model until one is not refused | `{ resolver, text, family, model?, handle? }`, after the session's turn ends |
| `start` | for `lets delegate handoff run`, once for each model until one is not refused | `{ resolver, handle }`, or `{ resolver, handle: null, instructions }`. Returns at once. |
| `finish` | after a `run` that returned a handle | `{}`, or nothing |

## The request

Every request has `protocol` and `cwd`. The other fields depend on the
verb.

| Field | Sent with | Value |
|---|---|---|
| `protocol` | every verb | `2` |
| `cwd` | every verb | The absolute path of the repository root |
| `verb` | `probe` | Optional. The session verb the probe is for: `run` for a review, `start` for a handoff. `lets` always sends it. Any other value is malformed: the resolver exits 2. |
| `name` | `run`, `start` | A label for the session: lowercase, a letter first, at most 32 characters |
| `prompt` | `run`, `start` | The text to send |
| `sourceFamily` | `run` | The family that wrote the work: `gpt`, `claude` or `gemini` |
| `readOnly` | `run`, `start` | `true` for `run`, `false` for `start` |
| `interactive` | `run`, `start` | `false` for `run`, `true` for `start` |
| `effort` | `run` | `low`, `medium` or `high` |
| `timeoutMinutes` | `run` | A whole number. By default 15 for `low` and `medium`, and 45 for `high`. |
| `model` | `run`, `start` | The model to run, as `<family>` or `<family>/<model>`, such as `gpt/gpt-6-luna`. The family is `gpt`, `claude` or `gemini`. The model part is everything after the first `/`, and has no spaces. A bare family, such as `claude`, means the harness's own default model for that family. |
| `handle` | `finish` | A handle this resolver returned |
| `ok` | `finish` | `true` when the review succeeded, `false` when the session should stay for a person to read |

A request without a valid `model` is malformed: the resolver exits 2.

The resolvers in `contrib/` run exactly the `model` they are given, even
one they did not list in `options`. When the harness cannot run it, they
exit 3. For `gemini`, `run` adds the effort to the model, as
`gemini-3.8-flash-high`. `start` has no effort, so the T3 resolver adds
`medium`.

## The response

| Field | Value |
|---|---|
| `resolver` | The resolver's own name, such as `t3` or `cli` |
| `options` | For `probe`: the models this resolver can run now, each as `<family>` or `<family>/<model>`, in its harness's own order. It may be empty, for a resolver that runs no model. A bare family means the harness can run that family's default model, but cannot list its models. |
| `text` | The session's final message. Empty is a failure. |
| `family` | The family that answered: `gpt`, `claude` or `gemini`. `lets` reports the review as independent when this differs from `sourceFamily`. |
| `model` | The model that answered. Optional, for people. |
| `handle` | `{ kind, id }` for the session, or `null`. `kind` names what it is, such as `thread` or `process`. A resolver may add fields; `lets` passes the handle back whole. |
| `instructions` | For `start` with no handle: the exact text a person needs to start the session themselves |

## Exit codes

| Code | Meaning | What `lets` does |
|---|---|---|
| 0 | Success | Reads stdout |
| 2 | The request is malformed, or its protocol or verb is unknown | Exits 4 and shows the resolver's stderr |
| 3 | A refusal: the harness or the account said no before the model gave any output. The harness is not running or not set up, there are no tokens left, or it cannot run the model. stderr says why. | Sends the next model the caller gave to the same resolver. Exits 3, naming each model, when none is left. Asks no later resolver. |
| 4 | A bug, a broken contract, or an outcome the resolver cannot know, such as no reply from the harness | Exits 4 |
| 5 | The session failed: an error, a stop to ask a question, or an empty message | Exits 5 |
| 6 | The session did not finish within `timeoutMinutes` | Exits 6 |
| 75 | Decline: this resolver does not handle this request here | Asks the next resolver |
| Any other | A bug in the resolver | Exits 4 and shows the resolver's stderr |

## Rules for a resolver

- **Decline before you start anything.** Exit 75 with nothing on stdout.
  A resolver that prints a response and then declines is a failure.
- **Decline a probe for a verb you would decline.** A resolver that never
  handles `start` declines a `probe` whose `verb` is `start`, so the
  resolver that will really answer the handoff lists the models.
- **Answer every model the same way.** Once you have answered a request,
  do not decline the same request for a later model. `lets` treats that
  as a broken contract and exits 4.
- **Keep `run` read-only.** When `readOnly` is `true`, the session must
  not write files. `lets` checks the tree anyway, and exits 7 if a file
  outside `.workspace/` changed.
- **Honour `timeoutMinutes` in `run`.** `lets` waits one minute more, then
  stops the resolver. Every other verb gets five minutes.
- **Never retry, and never fall back.** If you cannot do the thing, fail,
  and leave the session in place so a person can read it.
- **Accept `finish` for every handle you return.** Never fail it because
  the session is already gone. For a handle you never issued, exit 0 or 4
  and print nothing.
- **Do not pass on the caller's session markers.** A session you start
  must not think it is a child of the one that called `lets`. The list is
  `SESSION_MARKERS` in
  [`lets/src/delegate/env.ts`](../lets/src/delegate/env.ts).

## Write your own

A resolver is any executable file. Its shebang picks the language. Write
one for the harness you use, then add its absolute path to `resolvers` in
your delegate config, before `subagent`:

```yaml
version: 2
resolvers:
  - /home/you/bin/my-resolver
  - subagent
```

To try one without changing the config, point `LETS_SPEC_RESOLVER` at it.

Here is a complete one in `sh`,
[`contrib/headless-resolver`](../contrib/headless-resolver). It runs `claude`
headless and read-only. It declines `start`, and it declines a probe
for `start`, so the default, `lets-delegate-subagent`, handles handoffs.

```sh
#!/bin/sh
# A complete lets delegate resolver: run sends the prompt to claude, headless
# and read-only. It needs jq, and claude for run. It issues no handles, and
# leaves the timeout to lets, which stops it a minute after timeoutMinutes.
# The contract: docs/resolver-contract.md
# Check it with: lets delegate verify contrib/headless-resolver

request=$(cat)
if ! printf '%s' "$request" | jq -e '.protocol == 2' >/dev/null 2>&1; then
  echo "headless-resolver: not a protocol 2 request" >&2; exit 2
fi
field() { printf '%s' "$request" | jq -r ".$1"; }

case "$1" in
  probe)
    # It declines start, so it declines a probe for start too, and the
    # handoff probes the next resolver in the chain.
    [ "$(field verb)" = start ] && { echo "headless-resolver: this resolver only runs headless" >&2; exit 75; }
    echo '{"resolver":"headless-sh","options":["claude"]}' ;;
  run)
    model=$(field model)
    case "$model" in
      claude) id='' ;;
      claude/?*) id=${model#claude/} ;;
      gpt | gpt/?* | gemini | gemini/?*) echo "headless-resolver: this resolver runs only claude, not $model" >&2; exit 3 ;;
      *) echo "headless-resolver: the request's model must be <family> or <family>/<model>, got $model" >&2; exit 2 ;;
    esac
    command -v claude >/dev/null || { echo "headless-resolver: claude is not on PATH" >&2; exit 3; }
    cd "$(field cwd)" || exit 2
    # The new session must not think it is a child of the one that called lets.
    unset CLAUDECODE CLAUDE_CODE_CHILD_SESSION CLAUDE_CODE_SESSION_ID CLAUDE_CODE_BRIDGE_SESSION_ID \
      CLAUDE_CODE_MESSAGING_SOCKET CLAUDE_CODE_MESSAGING_TOKEN CLAUDE_CODE_ENTRYPOINT CLAUDE_PID CLAUDE_EFFORT
    # A bare family passes no --model, so claude runs its default.
    if ! text=$(field prompt | claude -p --permission-mode plan --effort "$(field effort)" ${id:+--model "$id"}); then
      # Nothing printed: claude said no before the model answered.
      [ -n "$text" ] || { echo "headless-resolver: claude refused $model" >&2; exit 3; }
      exit 5
    fi
    [ -n "$text" ] || { echo "headless-resolver: claude gave an empty answer" >&2; exit 5; }
    jq -cn --arg text "$text" --arg model "$id" \
      '{resolver: "headless-sh", family: "claude", model: (if $model == "" then null else $model end), text: $text}' ;;
  start) echo "headless-resolver: this resolver only runs headless" >&2; exit 75 ;;
  finish) ;; # It issues no handles, so it has nothing to finish.
  *) echo "headless-resolver: unknown verb $1" >&2; exit 2 ;;
esac
```

It leaves out one rule: it does not stop `claude` at `timeoutMinutes`.
Yours should.

Run the verify check against yours until it passes:

```sh
lets delegate verify <your resolver>
```

It sends requests that start nothing. Add `--live` to also run a short
session and start another. That spends tokens, and may open a thread. A
resolver that only runs headless may decline `start` with exit 75 and
nothing on stdout: the check passes it, and says the next resolver in the
chain answers handoffs.
