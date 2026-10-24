## Context

The kit in `contrib/resolver-kit/` turns protocol verbs into calls on one
`Adapter`. Two adapters use it: cli (`contrib/cli-resolver/src/cli.ts`)
and t3 (`contrib/t3-resolver/src/t3.ts`). The subagent resolver answers
verbs on its own, through `runProgram`, and does not use `Adapter`.

Today `resolver.ts` does this for `run`:

1. `adapter.spawn(...)` with `kind: 'run'` and `readOnly: true`.
2. `adapter.waitForResult(session, { timeoutMs })`.
3. Rejects an empty text.
4. On any error, appends `(<kind> <id>)` to the message. On `Refused`,
   calls the kit's own `finish` with `ok: true` first.

For `start`, it calls `spawn` with `kind: 'start'`, `effort: null` and
`readOnly: false`, and returns the handle. It declines a verb that is not
in `adapter.verbs`, which defaults to both.

The constraint is that nothing on the wire changes: requests, responses,
exit codes and the spec stay as they are.

## Goals / Non-Goals

**Goals:**

- Each adapter method does one whole job, so a new adapter has nothing
  to fake.
- Less code in the kit and in cli.

**Non-Goals:**

- Any change to the protocol, exit codes or spec.
- Changes to the subagent or headless resolvers.
- Reworking t3's thread launch or result polling beyond moving them into
  `run` and `start`.

## Test Seams

- **Primary test seam:** each program end to end through
  `tests/resolver-kit/fixtures/handle.ts`: a verb and a request in, the
  exit code, stdout and stderr out. `tests/cli-resolver/resolver.test.ts`
  and `tests/t3-resolver/resolver.test.ts` already drive the real
  adapters this way, on a fake io. These tests prove nothing a caller
  sees has changed.
- **Existing seams reused:** `tests/resolver-kit/resolver.test.ts`, whose
  fake adapter moves to the new interface; the adapter-level tests in
  `tests/cli-resolver/cli.test.ts` and `tests/t3-resolver/t3.test.ts`,
  which call `run` and `start` in place of `spawn` and `waitForResult`.

## Scrutiny Tier & Blast Radius

- **Tier:** medium
- **Blast radius:** the `Adapter` interface in the kit, the kit's
  adapter layer (`resolver.ts`), and the two adapters that implement it.
  No other package imports `adapter.ts`. The wire protocol is untouched.

## Decisions

### The new interface

```ts
// The request for a read-only session. A null model is the harness's
// default for the family.
export type RunRequest = { name: string; prompt: string; cwd: string; family: Family; model: string | null; effort: Effort };
// The request for an interactive session.
export type StartRequest = Omit<RunRequest, 'effort'>;

export type Adapter = {
  name, program, harness, handleKind, detect, whyDeclined?, options, finish, // as now
  run(request: RunRequest, options: { timeoutMs: number }): Promise<{ handle: Handle; text: string }>;
  start?(request: StartRequest): Promise<Handle>;
};
```

`SpawnRequest`, `Session`, `spawn`, `waitForResult` and `verbs` go.

Alternatives: keep `spawn` and `waitForResult` and only tighten the
types. That leaves cli faking a spawn. A single `session(kind, ...)`
method keeps the nullable effort. Two methods are the smallest shape that
fits both adapters.

### The kit's adapter layer

- `takes(adapter, verb)` becomes: `run` is always taken, and `start` is
  taken when `adapter.start` is defined. The decline messages stay word
  for word.
- `start`: `return { resolver, handle: await adapter.start!({ name, prompt, cwd, ...modelOf(model) }) }`.
- `run`: call `adapter.run`, then reject an empty text with
  `SessionFailed('empty final message (<kind> <id>)')`, then answer as
  now. The try/catch, the `where` suffix and the call to `finish` on
  `Refused` go.

### Who names the session in an error

Only the adapter knows the handle when `run` throws. t3 wraps its wait in
a try/catch that appends ` (thread <id>)` to any kit error, as the kit
did. cli appends nothing: its handle's id is the session name, which the
caller sent. Tests that match cli's stderr by pattern still pass; any
that expect `(process <name>)` drop it.

### t3's `run` and `start`

Both share one private `launchThread(request, { readOnly, effort })`,
which is today's `spawn` body with `kind === 'start'` replaced by
`!readOnly`. Today's `waitForResult` body becomes a private
`waitForText(handle, timeoutMs)`.

`run` is: launch with `readOnly: true`; wait; on `Refused`, archive the
thread with the same `dispatch` call `finish` makes. If archiving throws,
append `; could not archive it: <why>` to the refusal's message. Then
append ` (thread <id>)` and rethrow. The exit stays 3, and stderr names
the thread, as the spec requires.

`start` is: launch with `readOnly: false` and a null effort, and return
the handle. `t3ModelSelection` keeps its nullable effort: that is t3's
own rule for gemini on a start, not part of the interface.

### cli's `run`

Today's `waitForResult` body, taking the request directly. The fake
`spawn`, the `CliSession` type, its cast and `effort!` go. It returns
`{ handle: { kind: 'process', id: name }, text }`. It has no `start`, and
no `verbs` field.

On a refusal cli does no cleanup. It already removes an old result file
before it runs, so a refusal leaves at most an empty file in
`.workspace/lets-delegate/`, which is scratch space.

### No ADR

The interface is internal to this repository and easy to change again.
Nothing here is costly to reverse.

## Risks / Trade-offs

- [A behavior change slips in, such as a different exit code or a
  missing thread archive] → The end-to-end tests in
  `tests/t3-resolver/resolver.test.ts` and
  `tests/cli-resolver/resolver.test.ts` stay and must pass unchanged in
  what they assert about exit codes and archiving.
- [t3 no longer has the kit's warning line when an archive fails; the
  reason moves into the error message] → The spec asks only that the
  exit stays 3 and stderr names the thread. Both hold.
- [cli's stderr loses `(process <name>)`] → The name is the request's own
  `name`, so nothing is lost for the caller.

## Migration & Rollback

N/A. Nothing persistent changes shape. Rolling back is a revert of the
code commits.
