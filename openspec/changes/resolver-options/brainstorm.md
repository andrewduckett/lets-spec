## Story

#58 resolver-options — a resolver reports the options its harness can run now, and runs the model it is given.
https://github.com/sidereal-io/lets-spec/issues/58

## Decisions

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | Is `model` required or optional on `run` and `start`? | Required. A request without it exits 2. There is no fallback to a first option. | User |
| D2 | What about `lets delegate review` on `main` between #58 and #59, when `lets` sends no model? | It stops working on `main` until #59 merges. No release is cut between the two. | User; Evidence: `mise.toml` pins v0.4.0, and the epic is unreleased on `main` |
| D3 | Does the protocol number move from 1 to 2? | It stays at 1. There are no users, so a bump buys nothing. | Assumption (the user had no preference) |
| D4 | Which agy models does the cli resolver list? | Only ids that start with `gemini-`. An option's family is the CLI that runs it. | User |
| D5 | Is a follow-up needed for that filter? | Yes. File a Chore to remove it once agy stops listing other makers, expected after 2 November 2026. | User |
| D6 | How do Gemini models appear in `options`? | Once each, with the effort suffix stripped, as `gemini/gemini-3.8-flash`. `run` adds the request's effort. | User |
| D7 | Which codex models does the cli resolver list? | Only those with `visibility: list` in `codex debug models`. | User |
| D8 | What does `run` do with a model it never listed? | It tries it. If the harness refuses, that is exit 3, the same as any other refusal. | User |
| D9 | Where is the line between exit 3 and exit 4? | Exit 3 for any no before the model gives output: harness not running, no project, no tokens, no such model, or a CLI failing with nothing printed. Exit 4 stays for resolver bugs, contract errors and unknown outcomes, such as no reply from T3. | User |
| D10 | What happens to a T3 thread that is refused? | The resolver archives it before it exits 3. | Evidence: #58 Scope |
| D11 | In what order does T3 list its options? | Each provider in the manifest's order, with that provider's default model first. | Assumption |
| D12 | What does the cli resolver list when a CLI is on PATH but its listing fails, for example because codex is logged out? | It leaves that family out of `options`, and says why on stderr. | Assumption |
| D13 | What does the cli resolver list for claude? | The bare family `claude`, because the claude CLI cannot list models. A bare family on `run` means that CLI's default model. | Evidence: #58 Scope |
| D14 | What does `start` do with `model`? | T3 starts the thread on that model, instead of the project default. The cli resolver still declines `start`, and subagent still hands the prompt back. | Evidence: #58 Scope; `contrib/t3-resolver/src/t3.ts` (`startSelection`) |

## Changes from the story

- Added: [#61](https://github.com/sidereal-io/lets-spec/issues/61), a standalone Chore to remove the agy `gemini-` filter once agy lists only Gemini models (D5). It is blocked by #58.

Confirmed by user: yes
