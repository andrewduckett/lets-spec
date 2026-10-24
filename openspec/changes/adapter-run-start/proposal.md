## Why

A resolver author reads the kit's `Adapter` interface first, and today it
splits each session into `spawn` and `waitForResult`. That split fits T3
Code but not the cli resolver. cli's `spawn` starts nothing: it packs the
request into a loose `Session` object, and `waitForResult` casts it back.
That is why `Session` accepts any field and why cli asserts that the
effort is not null. Every new adapter would copy the same shape. The kit
now owns the contract (#78), so this is the moment to fix it.

## What Changes

- An adapter has `run(request, { timeoutMs })`, which returns the handle
  and the final text, and an optional `start(request)`, which returns the
  handle (D2, D4).
- `spawn`, `waitForResult`, `Session` and its open index signature go.
  `SpawnRequest` gives way to one request type for `run`, with an effort
  that is never null, and one for `start`, with no effort (D3).
- The `verbs` field on `Adapter` goes. An adapter takes `start` only when
  it has a `start` method (D4).
- The kit still rejects an empty final message, and names the handle in
  that error (D5).
- The kit no longer calls `finish` when a run is refused. t3 archives a
  refused thread inside its own `run`; cli does no cleanup (D6, D7).
- An adapter names its own session in an error thrown after the session
  starts. t3 adds `(thread <id>)`; cli adds nothing (D8).
- The cli adapter loses its fake spawn, its cast and its `effort!`
  assertion.
- Tests follow the new interface.

Nothing a caller sees changes: requests, responses, exit codes and the
spec stay the same (D1).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is a refactor with no change in behavior, so the change sets
`skip_specs`.

## Impact

- Code: `contrib/resolver-kit/src/adapter.ts`,
  `contrib/resolver-kit/src/resolver.ts`, `contrib/cli-resolver/src/cli.ts`,
  `contrib/t3-resolver/src/t3.ts`.
- Tests: `tests/resolver-kit/`, `tests/cli-resolver/`,
  `tests/t3-resolver/`.
- The `Adapter` interface is internal to this repository. No published
  API, dependency or wire format changes.
