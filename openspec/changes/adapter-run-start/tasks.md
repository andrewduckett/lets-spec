<!-- The cli and t3 adapters do not type-check against the new interface
     until sections 2 and 3 are done. node --test strips types, so each
     task's own tests still run. The full type check is task 4.1. -->

## 1. The kit's adapter interface

- [x] 1.1 [medium] The kit answers `run` with one call to `adapter.run`, passing a `RunInput` and `timeoutMs`, and answers with the handle and text it returns. It rejects an empty text with `empty final message (<kind> <id>)`, exit 5. It no longer appends the handle to a thrown error, and no longer calls `finish` on `Refused`. `Session`, `SpawnRequest`, `spawn` and `waitForResult` are gone from `adapter.ts`; the fake adapter in the kit's tests follows. (verify: node --test tests/resolver-kit/resolver.test.ts) (✓ node --test tests/resolver-kit/resolver.test.ts passed)
- [x] 1.2 [easy] The kit answers `start` with one call to `adapter.start`, passing a `StartInput` with no effort. An adapter with no `start` method has `start`, and a probe for `start`, declined with the same message as today. The `verbs` field is gone. (verify: node --test tests/resolver-kit/resolver.test.ts) (✓ node --test tests/resolver-kit/resolver.test.ts passed)

## 2. The cli adapter [depends-on: 1]

- [x] 2.1 [parallel] [medium] cli's `run` runs the family's CLI and returns a `process` handle named after the session, with the final text. It has no `start`, no `verbs`, no fake `spawn`, no `CliSession` cast and no `effort!`. Every end-to-end cli test keeps its exit code and stdout; any that expected `(process <name>)` on stderr drops it. (verify: node --test tests/cli-resolver/cli.test.ts tests/cli-resolver/resolver.test.ts) (✓ node --test tests/cli-resolver/cli.test.ts tests/cli-resolver/resolver.test.ts passed)

## 3. The t3 adapter [depends-on: 1]

- [x] 3.1 [parallel] [medium] t3's `start` launches a default-mode thread on the request's model, with no effort option, and returns its handle. It shares one private launch helper with `run`. (verify: node --test tests/t3-resolver/t3.test.ts) (✓ node --test tests/t3-resolver/t3.test.ts passed)
- [ ] 3.2 [parallel] [medium] t3's `run` launches a plan-mode thread and returns its handle with the final text. An error before the thread exists, such as no T3 project, passes through unchanged: exit 3, no archive, no thread named. (verify: node --test tests/t3-resolver/t3.test.ts tests/t3-resolver/resolver.test.ts)
- [ ] 3.3 [parallel] [medium] When t3's `run` is refused while it waits, it archives the thread and exits 3 with ` (thread <id>)` on stderr. When archiving fails too, the exit is still 3 and the message adds `; could not archive it: <why>`. (verify: node --test tests/t3-resolver/t3.test.ts tests/t3-resolver/resolver.test.ts)
- [ ] 3.4 [parallel] [easy] Any other kit error from t3's wait, such as a timeout or a session that stopped to ask, keeps its exit code and ends with ` (thread <id>)`. (verify: node --test tests/t3-resolver/t3.test.ts)

## 4. Integration [depends-on: 2, 3]

- [ ] 4.1 [easy] The whole suite passes: the Node tests, the type check with no `Session` or `SpawnRequest` left anywhere, every resolver's verify check, and the bats tests. (verify: pnpm test)
- [ ] 4.2 [easy] The flake builds every resolver and the release folder. (verify: nix flake check)

## Deviations Ledger

<!-- Dated notes on small departures from the plan, written during apply. Stop and ask the user about a large one. -->
