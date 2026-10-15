---
name: lets-spawn
description: Use when a lets-spec skill must start a fresh agent session from inside a running one, either to get an independent critique back or to hand the apply step to a new context. The session lands in the harness the parent runs in.
---

# lets-spawn

This skill's script starts a fresh agent session from inside a running one. A
review skill uses it to get a critique back from another model family, and
`lets-build` uses it to hand the apply step to a new context.

## When to apply

Other skills call the `lets-spawn` skill. You rarely run it by hand.

- **`lets-review-plan` and `lets-review-code`** run `critique`. A reviewer from another model family reads the work with no shared context, and its final message comes back.
- **`lets-build`** runs `handoff` after propose, once the user says yes. Apply starts in a fresh session on the same branch.

Do not use it for a subagent inside this session. A subagent shares this session's harness and blind spots.

## The command

Run each command from the repo root.

```bash
node .agents/skills/lets-spawn/scripts/lets-spawn.mjs detect
```

Prints the harness a spawn would use: `t3`, `herdr` or `none`.

```bash
node .agents/skills/lets-spawn/scripts/lets-spawn.mjs critique --name <name> --author <gpt|claude|gemini> \
  --effort <low|medium|high> (--prompt-file <path> | --code-review --base <ref>) [--timeout <minutes>]
```

Starts a read-only reviewer and waits for it. The default timeout is 15
minutes for `low` and `medium` and 45 for `high`.

- **stdout** holds the reviewer's final message.
- **stderr** holds one JSON line with `harness`, `family`, `model`, `independent`, `threadId`, `gitClean` and `durationSeconds`.

```bash
node .agents/skills/lets-spawn/scripts/lets-spawn.mjs handoff --name <name> --prompt "<text>" [--unattended] [--model <id>]
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
| 3 | No reviewer family is available, the author's included. |
| 4 | The harness refused the spawn. |
| 5 | The reviewer failed: its turn ended in an error, it stopped to ask a question, or its final message was empty. |
| 6 | The reviewer did not finish before the timeout. |
| 7 | The reviewer changed files outside `.workspace/`. |

## Where the session runs

The script asks each harness in turn whether this process runs inside it.
The first yes wins.

| Harness | How it knows | A critique | A handoff |
|---|---|---|---|
| `t3` | The T3 Code server is one of this process's parents. | A new thread in plan mode. The script archives it when the review succeeds. | A new thread in the sidebar on the current branch. |
| `herdr` | `HERDR_ENV` is `1` and `herdr` is on `PATH`. | A new unfocused tab running the reviewer. The result is the tab's recent terminal output, so it carries some screen chrome. The script closes the tab when the review succeeds. | A new tab running `claude --remote-control`. |
| `none` | Neither of the above. | A headless process: `codex`, `claude -p` or `agy`, read-only. | A new `gnome-terminal` window running `claude --remote-control`. With `--unattended`, `claude -p` in the background, logged to `.workspace/lets-spawn/<name>.log`. |

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
On failure it leaves the thread or tab in place and prints its id. Read it,
then fix the cause.

- **2:** fix the command line.
- **3:** install a reviewer, or enable one in t3. Any family will do; a second one makes the review independent.
- **4:** read the message. In t3, it may tell you to run `t3 project add <path>`. The script keeps its t3 token in `~/.config/lets-spawn/t3-token` and replaces it when t3 rejects it.
- **5:** read the reviewer's thread, then fix the prompt or the work.
- **6:** read the thread. Raise `--timeout` only if the reviewer was still making progress.
- **7:** inspect `git status`, undo the reviewer's changes, and find out why it wrote.

Do not run the command again until something has changed.
