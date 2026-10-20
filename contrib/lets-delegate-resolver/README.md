# lets-delegate-resolver

A resolver for T3 Code and herdr. When a Let's Spec skill asks
`lets delegate` for a fresh session, this resolver opens it as a T3 thread
or a herdr tab, so you can watch it work.

| You work in | A review runs as | A handoff starts |
|---|---|---|
| T3 Code | A new thread, archived when the review succeeds | A new thread in the sidebar |
| herdr | A new tab, closed when the review succeeds | A new tab |
| Anything else | It declines, and the built-in default answers | It declines, and the built-in default answers |

This page covers:

- [Install it](#install-it)
- [Check that it works](#check-that-it-works)
- [After a t3 update](#after-a-t3-update)
- [The contract](#the-contract), which every resolver keeps
- [Write your own](#write-your-own)

## Install it

Install it once for your user, not in a project. It answers "which
harness is this process in?", and that is true of your machine, not of a
repository. `lets` finds it as `lets-delegate-resolver` on your `PATH`.

It needs Node 26 or later. It runs `t3`, `herdr` and `git` from your
`PATH`.

After you install it, run `lets delegate setup --write`. It records this
resolver in your delegate config, with the models your accounts can run.
A review then runs the first of those models that T3 or herdr can start.

### With home-manager

Add this repo as a flake input, then add the package:

```nix
home.packages = [
  inputs.lets-spec.packages.${pkgs.stdenv.hostPlatform.system}.lets-delegate-resolver
];
```

### With a Nix profile

```sh
nix profile add github:andrewduckett/lets-spec#lets-delegate-resolver
```

### With mise

The release tarball holds the resolver at `contrib/lets-delegate-resolver`,
outside `bin/`, so mise never puts it on a project's `PATH`. Link it onto
yours. Use the `lets-spec` version from your project's `mise.toml`:

```sh
ln -sf "$(mise where github:andrewduckett/lets-spec@<version>)/contrib/lets-delegate-resolver" ~/.local/bin/
```

The link names one version. After you update `lets-spec`, run it again
with the new version.

### From a checkout of this repo

To try a change to the resolver, link its dev entry instead, or set
`LETS_SPEC_RESOLVER` to its path:

```sh
ln -sf "$PWD/contrib/lets-delegate-resolver/bin/lets-delegate-resolver" ~/.local/bin/
```

Run `pnpm install` in the checkout first.

### Before the first review in T3 Code

Add your repository as a T3 project once:

```sh
t3 project add <path>
```

The resolver keeps a T3 token in `~/.config/lets-delegate/t3-token`. It
issues a new one when T3 rejects it.

## Check that it works

From inside a project, run:

```sh
command -v lets-delegate-resolver
lets delegate conformance lets-delegate-resolver
```

Expect a path, then `The resolver keeps the contract.` The check starts
nothing. In a plain terminal, the first check passes because the resolver
declines.

To run a real session, see [After a t3 update](#after-a-t3-update).

## After a t3 update

The T3 half of the resolver depends on t3's internal protocol and
database: it speaks orchestration protocol 2, makes each thread with the
same `launchThread` request as the T3 UI, and reads the result from
`statev2.sqlite`. A t3 update can break it. After each update, run these
from a T3 thread in a project that T3 knows:

```sh
lets delegate conformance --live lets-delegate-resolver
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

## The contract

`lets` and a resolver talk through a small JSON protocol. This section is
its definition. The code that checks it is
[`lets/src/delegate/protocol.ts`](../../lets/src/delegate/protocol.ts).

### How `lets` finds a resolver

`lets` asks these in order. The first that does not decline answers.

1. The executable that `LETS_SPEC_RESOLVER` names, when it is set. If the
   path is missing or not executable, `lets` exits 2.
2. The resolver the user's delegate config names: `resolver` in
   `~/.config/lets-delegate/config.json`, or under `XDG_CONFIG_HOME`.
   `lets delegate setup` writes it. When the lookup reaches this
   resolver and it is missing or not executable, `lets` exits 2 and asks
   no later one.
3. `lets-delegate-resolver` on your `PATH`. When it is the same file as
   the configured resolver, it is asked once.
4. The built-in default, which never declines.

Only `lets` reads the config. A resolver learns the user's reviewers from
the `reviewers` field of the `run` request.

### How `lets` runs a resolver

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

### The request

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

This resolver walks `reviewers` in order. It runs the first reviewer from
a family other than `sourceFamily` that its harness can run, else the
first it can run at all. When it can run none, it exits 3 and names each
reviewer it skipped and why. For `gemini`, it adds the effort to the
model, as `gemini-3.8-flash-high`. Without `reviewers`, it picks the
family itself.

### The response

| Field | Value |
|---|---|
| `resolver` | The resolver's own name, such as `t3` or `herdr` |
| `text` | The session's final message. Empty is a failure. |
| `family` | The family that answered: `gpt`, `claude` or `gemini`. `lets` reports the review as independent when this differs from `sourceFamily`. |
| `model` | The model that answered. Optional, for people. |
| `handle` | `{ kind, id }` for the session, or `null`. `kind` names what it is, such as `thread`, `tab` or `process`. A resolver may add fields; `lets` passes the handle back whole. |
| `instructions` | For `start` with no handle: the exact text a person needs to start the session themselves |

### Exit codes

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

### Rules for a resolver

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
  [`lets/src/delegate/env.ts`](../../lets/src/delegate/env.ts).

## Write your own

A resolver is any executable file. Its shebang picks the language. Write
one for the harness you use, and put it on your `PATH` as
`lets-delegate-resolver`, or point `LETS_SPEC_RESOLVER` at it.

Here is a complete one in `sh`,
[`contrib/headless-resolver`](../headless-resolver). It runs `claude`
headless and read-only. It declines `start`, so the built-in default
handles handoffs.

```sh
#!/bin/sh
# A complete lets delegate resolver: run sends the prompt to claude, headless
# and read-only. It needs jq, and claude for run. It issues no handles, and
# leaves the timeout to lets, which stops it a minute after timeoutMinutes.
# The contract: contrib/lets-delegate-resolver/README.md
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
