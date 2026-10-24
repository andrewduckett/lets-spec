## 1. The test seam

- [x] 1.1 [easy] `commandDeps({ real: { cli: adapter } })` gives the delegate commands that real adapter under its name, still recorded in `adapterCalls`, and every existing delegate test passes unchanged (verify: `node --test tests/lets/delegate/*.test.ts`) (✓ node --test tests/lets/delegate/*.test.ts: 161 passed)

## 2. The cli twins [depends-on: 1]

- [x] 2.1 [parallel] [medium] With `resolvers: [cli]`, `review instructions` lists the models each CLI on PATH reports, including inside T3 Code, and lists the bare family with a `lets delegate:` warning naming `codex` when its listing fails (verify: `node --test tests/lets/resolvers/cli/delegate.test.ts`) (✓ node --test tests/lets/resolvers/cli/delegate.test.ts: 3 passed; 2 failed with the expectations broken)
- [x] 2.2 [parallel] [medium] `cli` declines a review with no family CLI on PATH, and every handoff and handoff instructions even with every CLI on PATH, starting no process; the next name answers, or the command exits 2 (verify: `node --test tests/lets/resolvers/cli/delegate.test.ts`) (✓ node --test tests/lets/resolvers/cli/delegate.test.ts: 7 passed; the 4 new failed with the expectations broken)
- [x] 2.3 [parallel] [medium] With `resolvers: [cli]`, `review run` runs the `--model` family's CLI read-only with its model and effort, prints the final message with `family`, `model` and a `process` handle on stderr, and tries a model no listing named (verify: `node --test tests/lets/resolvers/cli/delegate.test.ts`) (✓ node --test tests/lets/resolvers/cli/delegate.test.ts: 12 passed; the 5 new failed with the expectations broken)
- [x] 2.4 [parallel] [medium] With `resolvers: [cli]`, a CLI that refuses or cannot start exits 3 (also after an earlier run with the same name), one that fails or ends empty exits 5, and one past the timeout exits 6 (verify: `node --test tests/lets/resolvers/cli/delegate.test.ts`) (✓ node --test tests/lets/resolvers/cli/delegate.test.ts: 20 passed; the 8 new failed with the expectations broken)
- [x] 2.5 [parallel] [easy] A clean `cli` review removes its last-message file, a review that changed the tree keeps it, and a claude review removes nothing; at the adapter itself, `finish` of a handle whose id is not a session name throws and removes nothing, and `handleKind` is `process` (verify: `node --test tests/lets/resolvers/cli/delegate.test.ts`) (✓ node --test tests/lets/resolvers/cli/delegate.test.ts: 25 passed; the 5 new failed with the expectations broken)

## 3. The t3 twins [depends-on: 1]

- [x] 3.1 [parallel] [medium] With `resolvers: [t3]`, `review instructions` answers `t3` with no options and a warning naming the manifest path inside T3 Code, with or without `/proc`, and exits 2 when the T3 server is not an ancestor (verify: `node --test tests/lets/resolvers/t3/delegate.test.ts`) (✓ node --test tests/lets/resolvers/t3/delegate.test.ts: 3 passed; all 3 failed with the expectations broken)
- [x] 3.2 [parallel] [medium] With `resolvers: [t3]`, `review run` exits 3 and archives the thread when T3 fails the run before any message, and exits 3 naming the repository, creating no thread, when T3 has no project for it; `handleKind` is `thread` (verify: `node --test tests/lets/resolvers/t3/delegate.test.ts`) (✓ node --test tests/lets/resolvers/t3/delegate.test.ts: 6 passed; the 3 new failed with the expectations broken)

## 4. Retire the program-level tests and move the rules [depends-on: 2, 3]

- [x] 4.1 [easy] Both `resolver.test.ts` files are deleted once every case has its twin, and nothing under `tests/lets/resolvers/t3/` or `cli/` imports `protocol.ts`, `resolver.ts`, `verbs.ts` or the `handle` fixture (verify: `! grep -rlE "kit/(protocol|resolver|verbs)\.ts|fixtures/handle\.ts" tests/lets/resolvers/t3 tests/lets/resolvers/cli`) (✓ grep found no such import; node --test tests/lets/resolvers: 183 passed)
- [x] 4.2 [easy] A rehearsed archive in a copy under `.workspace/` writes `delegate-resolvers` with the 15 requirements of the delta, leaves exactly the 7 kept requirements in `resolvers` word for word, and each moved scenario keeps its assertions but for D5 to D7 (verify: `openspec validate resolver-specs-by-command --strict`, then `openspec archive resolver-specs-by-command --yes` in the copy and `diff` each spec's requirements) (✓ validate --strict passed; rehearsed archive: + 15, - 16; delegate-resolvers equals the delta; the 7 kept requirements are word for word; every moved requirement keeps its scenario count, the two cli declines each gain the merged or default-next scenario)
- [ ] 4.3 [easy] `lets/src/` is unchanged on this branch, and the whole suite and the flake checks pass (verify: `git diff --quiet builtin-resolver-chain -- lets/src && pnpm test && nix flake check`)

## Deviations Ledger

- 2026-10-24: The twins test behaviour that already exists, since no code changes. So each task's red step is to break the new tests' expectations once and watch them fail, and then restore them.
- 2026-10-24: *probe for run answers cli* has no twin of its own: at the command level it is *review instructions answer cli with one family CLI on PATH*, as D6 merges the two rules. *a run with no model* has its twin in `tests/lets/delegate/review.test.ts`, *a bad --model is exit 2*, as D10 says.
