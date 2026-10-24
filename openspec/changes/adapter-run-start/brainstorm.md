## Story

#83 adapter-run-start — an adapter runs or starts a session in one call.
https://github.com/sidereal-io/lets-spec/issues/83

## Decisions

Andrew handed every choice in this brainstorm to the agent. Rows marked
`User` are the agent's recommendation, which Andrew accepted in advance.
The rule was: take the option that removes code, and never change the
wire protocol.

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | Does anything a caller sees change? | No. Requests, responses, exit codes and the spec stay the same. Only the kit's `Adapter` interface and the two adapters change. | Evidence: #83 scope; `openspec/specs/contrib-resolvers/spec.md` |
| D2 | What does an adapter offer in place of `spawn` and `waitForResult`? | `run(request, { timeoutMs })` returns `{ handle, text }`, and `start(request)` returns a handle. `spawn`, `waitForResult`, `Session` and `SpawnRequest` go. | User |
| D3 | What does each call get? | `run` gets name, prompt, cwd, family, model and an effort that is never null. `start` gets the same fields without effort. The `kind` and `readOnly` fields go: the call itself says which. | User |
| D4 | How does the kit know which verbs an adapter takes? | `run` is required and `start` is optional. An adapter takes `start` only when it has one. The `verbs` field goes. | User |
| D5 | Who rejects an empty final message? | The kit, as now. Its message still names the session's handle, as `(<kind> <id>)`. | Evidence: #83 scope |
| D6 | Who cleans up after a refusal? | The adapter, inside its own `run`. t3 archives the thread. If archiving fails, the error still exits 3 and names the thread. The kit no longer calls `finish` on a refusal. | Evidence: #83 scope; spec "The T3 resolver archives a refused thread" |
| D7 | Does the cli adapter clean up after a refusal? | No. It already removes an old result file before each run, so a refusal can leave at most an empty file in `.workspace/`. That folder is scratch space. | User |
| D8 | Who names the session in an error thrown after it starts? | The adapter, since only it knows the handle then. t3 adds `(thread <id>)` so a person can find the thread. cli adds nothing: its handle's id is the session name, which the caller already has. | User |

## Changes from the story

- Added: the `verbs` field on `Adapter` goes too (D4). Whether the adapter has a `start` method already says the same thing.
- Added: the cli adapter stops cleaning up after a refusal (D7). The kit used to do this for it by calling `finish`.

Confirmed by user: yes
