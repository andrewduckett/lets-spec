# The resolver contract

`lets delegate` hands a fresh session to a resolver: a program that opens
the session in your harness, such as a T3 Code thread or a herdr tab. This
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
2. The resolver the user's delegate config names: `resolver` in
   `~/.config/lets-delegate/config.json`, or under `XDG_CONFIG_HOME`.
   `lets delegate setup` writes it. When the lookup reaches this
   resolver and it is missing or not executable, `lets` exits 2 and asks
   no later one.
3. `lets-delegate-resolver` on your `PATH`. When it is the same file as
   the configured resolver, it is asked once. No program by that name
   ships any more, so name your resolver in the config instead, with
   `lets delegate setup --resolver <path> --write`. Issue #49 removes
   this step.
4. The default, `lets-delegate-subagent`, which never declines. It
   ships with `lets`, which runs it from `contrib/lets-delegate-subagent`
   beside itself with its own Node, and it answers as `subagent`. When
   that file is missing or Node cannot run it, `lets` exits 4 and says
   its install is incomplete.

Only `lets` reads the config. A resolver learns the user's reviewers from
the `reviewers` field of the `run` request.

## How `lets` runs a resolver

A resolver is any executable. `lets` runs it as `<resolver> <verb>`, from
the repository root. It writes one JSON object to the resolver's stdin and
reads one JSON object from its stdout. stderr is for people: `lets` shows
it when something fails.

| Verb | `lets` sends it | Answer |
|---|---|---|
| `probe` | never; the conformance check and people do | `{ resolver }` |
| `run` | for `lets delegate review` | `{ resolver, text, family, model?, handle? }`, after the session's turn ends |
| `start` | for `lets delegate handoff` | `{ resolver, handle }`, or `{ resolver, handle: null, instructions }`. Returns at once. |
| `finish` | after a `run` that returned a handle | `{}`, or nothing |

## The request

Every request has `protocol` and `cwd`. The other fields depend on the
verb.

| Field | Sent with | Value |
|---|---|---|
| `protocol` | every verb | `1` |
| `cwd` | every verb | The absolute path of the repository root |
| `name` | `run`, `start` | A label for the session: lowercase, a letter first, at most 32 characters |
| `prompt` | `run`, `start` | The text to send |
| `sourceFamily` | `run` | The family that wrote the work: `gpt`, `claude` or `gemini` |
| `readOnly` | `run`, `start` | `true` for `run`, `false` for `start` |
| `interactive` | `run`, `start` | `false` for `run`, `true` for `start` |
| `effort` | `run` | `low`, `medium` or `high` |
| `timeoutMinutes` | `run` | A whole number. By default 15 for `low` and `medium`, and 45 for `high`. |
| `reviewers` | `run`, optional | The families and models the user allows for this effort, in their order: a list of `{ family, model }`, where `model` is a string or `null` for the tool's default. It is absent when the user has no delegate config, and may be empty. A resolver may ignore it. |
| `handle` | `finish` | A handle this resolver returned |
| `ok` | `finish` | `true` when the review succeeded, `false` when the session should stay for a person to read |

The resolvers in `contrib/` walk `reviewers` in order. Each runs the first
reviewer from a family other than `sourceFamily` that its harness can
run, else the first it can run at all. When it can run none, it exits 3
and names each reviewer it skipped and why. For `gemini`, it adds the
effort to the model, as `gemini-3.8-flash-high`. Without `reviewers`, it
picks the family itself.

## The response

| Field | Value |
|---|---|
| `resolver` | The resolver's own name, such as `t3` or `herdr` |
| `text` | The session's final message. Empty is a failure. |
| `family` | The family that answered: `gpt`, `claude` or `gemini`. `lets` reports the review as independent when this differs from `sourceFamily`. |
| `model` | The model that answered. Optional, for people. |
| `handle` | `{ kind, id }` for the session, or `null`. `kind` names what it is, such as `thread`, `tab` or `process`. A resolver may add fields; `lets` passes the handle back whole. |
| `instructions` | For `start` with no handle: the exact text a person needs to start the session themselves |

## Exit codes

| Code | Meaning | What `lets` does |
|---|---|---|
| 0 | Success | Reads stdout |
| 2 | The request is malformed, or its protocol or verb is unknown | Exits 4 and shows the resolver's stderr |
| 3 | No family is available, not even the source's | Exits 3 |
| 4 | The harness refused to start the session | Exits 4 |
| 5 | The session failed: an error, a stop to ask a question, or an empty message | Exits 5 |
| 6 | The session did not finish within `timeoutMinutes` | Exits 6 |
| 75 | Decline: this resolver does not handle this request here | Asks the next resolver |
| Any other | A bug in the resolver | Exits 4 and shows the resolver's stderr |

## Rules for a resolver

- **Decline before you start anything.** Exit 75 with nothing on stdout.
  A resolver that prints a response and then declines is a failure.
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
one for the harness you use, then name it in your delegate config:

```sh
lets delegate setup --resolver <path> --write
```

To try one without changing the config, point `LETS_SPEC_RESOLVER` at it.

Here is a complete one in `sh`,
[`contrib/headless-resolver`](../contrib/headless-resolver). It runs `claude`
headless and read-only. It declines `start`, so the default,
`lets-delegate-subagent`, handles handoffs.

```sh
#!/bin/sh
# A complete lets delegate resolver: run sends the prompt to claude, headless
# and read-only. It needs jq, and claude for run. It issues no handles, and
# leaves the timeout to lets, which stops it a minute after timeoutMinutes.
# The contract: docs/resolver-contract.md
# Check it with: lets delegate conformance contrib/headless-resolver

request=$(cat)
if ! printf '%s' "$request" | jq -e '.protocol == 1' >/dev/null 2>&1; then
  echo "headless-resolver: not a protocol 1 request" >&2; exit 2
fi
field() { printf '%s' "$request" | jq -r ".$1"; }

case "$1" in
  probe) echo '{"resolver":"headless-sh"}' ;;
  run)
    command -v claude >/dev/null || { echo "headless-resolver: claude is not on PATH" >&2; exit 3; }
    cd "$(field cwd)" || exit 2
    # The new session must not think it is a child of the one that called lets.
    unset CLAUDECODE CLAUDE_CODE_CHILD_SESSION CLAUDE_CODE_SESSION_ID CLAUDE_CODE_BRIDGE_SESSION_ID \
      CLAUDE_CODE_MESSAGING_SOCKET CLAUDE_CODE_MESSAGING_TOKEN CLAUDE_CODE_ENTRYPOINT CLAUDE_PID CLAUDE_EFFORT
    text=$(field prompt | claude -p --permission-mode plan --effort "$(field effort)") || exit 5
    [ -n "$text" ] || { echo "headless-resolver: claude gave an empty answer" >&2; exit 5; }
    jq -cn --arg text "$text" '{resolver: "headless-sh", family: "claude", text: $text}' ;;
  start) echo "headless-resolver: this resolver only runs headless" >&2; exit 75 ;;
  finish) ;; # It issues no handles, so it has nothing to finish.
  *) echo "headless-resolver: unknown verb $1" >&2; exit 2 ;;
esac
```

It leaves out one rule: it does not stop `claude` at `timeoutMinutes`.
Yours should.

Run the conformance check against yours until it passes:

```sh
lets delegate conformance <your resolver>
```

It sends requests that start nothing. Add `--live` to also run a short
session and start another. That spends tokens, and may open a thread or a
tab.
