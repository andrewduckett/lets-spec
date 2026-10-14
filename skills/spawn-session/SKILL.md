---
name: spawn-session
description: Use when a lets-spec skill must start a fresh agent session from inside a running one, either to get an independent critique back or to hand the apply step to a new context. The session lands in the harness the parent runs in.
---

# spawn-session

This skill's script starts a fresh agent session from inside a running one. A
review skill uses it to get a critique back from another model family, and
`lets-build` uses it to hand the apply step to a new context.

## When to apply

Other skills call the `spawn-session` skill. You rarely run it by hand.

- **`peer-plan-review` and `peer-code-review`** run `critique`. A reviewer from another model family reads the work with no shared context, and its final message comes back.
- **`lets-build`** runs `handoff` after propose, once the user says yes. Apply starts in a fresh session on the same branch.

Do not use it for a subagent inside this session. A subagent shares this session's harness and blind spots.

## The command

Run each command from the repo root.

```bash
node .agents/skills/spawn-session/scripts/spawn-session.mjs detect
```

Prints the harness a spawn would use: `t3`, `herdr` or `none`.

```bash
node .agents/skills/spawn-session/scripts/spawn-session.mjs critique --name <name> --author <gpt|claude|gemini> \
  --effort <low|medium|high> (--prompt-file <path> | --code-review --base <ref>) [--timeout <minutes>]
```

Starts a read-only reviewer and waits for it. The default timeout is 15
minutes for `low` and `medium` and 45 for `high`.

- **stdout** holds the reviewer's final message.
- **stderr** holds one JSON line with `harness`, `family`, `model`, `independent`, `threadId`, `gitClean` and `durationSeconds`.

```bash
node .agents/skills/spawn-session/scripts/spawn-session.mjs handoff --name <name> --prompt "<text>" [--unattended] [--model <id>]
```

Starts a session with the prompt and returns at once. stdout holds one JSON
line with `harness` and `threadId`. `threadId` is `null` when the session
opened in a terminal window.

The script turns `--name` into a valid name: lowercase, a letter first, at
most 32 characters. The name labels the thread or tab.

| Exit | Meaning |
|---|---|
| 0 | Success. |
| 2 | The command line is wrong. The usage follows the message. |
| 3 | No reviewer family is available. |
| 4 | The harness refused the spawn. |
| 5 | The reviewer failed: its turn ended in an error, it stopped to ask a question, or its final message was empty. |
| 6 | The reviewer did not finish before the timeout. |
| 7 | The reviewer changed files outside `.workspace/`. |

## Where the session runs

The script asks each harness in turn whether this process runs inside it.
The first yes wins.

| Harness | How it knows | A critique | A handoff |
|---|---|---|---|
| `t3` | The T3 Code server is one of this process's parents. | A new thread in plan mode. It is archived when the review succeeds. | A new thread in the sidebar on the current branch. |
| `herdr` | `HERDR_ENV` is `1` and `herdr` is on `PATH`. | A new unfocused tab running the reviewer. It is closed when the review succeeds. | A new tab running `claude --remote-control`. |
| `none` | Neither of the above. | A headless process: `codex`, `claude -p` or `agy`, read-only. | A new `gnome-terminal` window running `claude --remote-control`. With `--unattended`, `claude -p` in the background, logged to `.workspace/spawn-session/<name>.log`. |

Set `LETS_SPEC_HARNESS` to `t3`, `herdr` or `none` to skip detection. Use it
when detection picks the wrong harness.

Every session runs in this checkout, on its current branch. The script never
makes a worktree.

## How the reviewer is chosen

The script tries the families in the order `gpt`, `claude`, `gemini`. It
skips the author's family and takes the first one available. In t3, a family
is available when t3's model list has a current model for it, and the script
uses the first one. Outside t3, a family is available when its command is on
`PATH`, and the command's default model runs.

When only the author's family is available, the script still runs the review
in a fresh session. The JSON line then says `"independent": false`. Say so
plainly in the report: the review was not independent.

## Fail fast

The script never retries and never falls back to another harness or family.
A failure means something needs to change. On failure it leaves the thread
or tab in place and prints its id, so you can read what happened.

- **2:** fix the command line.
- **3:** install or enable another model family.
- **4:** read the message. In t3, it may tell you to run `t3 project add <path>`.
- **5:** read the reviewer's thread, then fix the prompt or the work.
- **6:** read the thread. Raise `--timeout` only if the reviewer was still making progress.
- **7:** inspect `git status`, undo the reviewer's changes, and find out why it wrote.

Do not run the command again until something has changed.

## Smoke test after a t3 update

The t3 adapter depends on t3's internal protocol and database. After each t3
update, run these from a t3 thread in a project t3 knows:

```bash
node .agents/skills/spawn-session/scripts/spawn-session.mjs detect
node .agents/skills/spawn-session/scripts/spawn-session.mjs handoff --name smoke-handoff --prompt "Say hello and stop."
printf 'Reply with the single word READY and nothing else.\n' > .workspace/p.md
node .agents/skills/spawn-session/scripts/spawn-session.mjs critique --name smoke-critique \
  --author claude --effort low --prompt-file .workspace/p.md
```

Expect `t3`, then a new thread and a JSON line with its `threadId`, then
`READY` on stdout and an archived Codex thread.

## Prerequisites

- Node 22.13 or later.
- **t3:** a running T3 Code with this repo added as a project. The script keeps a t3 token in `~/.config/spawn-session/t3-token` and issues a new one when t3 rejects it.
- **herdr:** a herdr pane, which sets `HERDR_ENV`.
- **none:** `codex`, `claude` or `agy` on `PATH`, and `gnome-terminal` for an attended handoff.
