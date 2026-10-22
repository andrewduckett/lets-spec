## 1. The contract

- [x] 1.1 [medium] A `run` or `start` request at protocol 2 needs a `model` of `<family>` or `<family>/<id>`, and `parseRequest` exits 2 and names `model` when it is missing or bad. `parseModel` splits it, and `reviewers` is gone. The change goes in `lets/src/delegate/protocol.ts` and its kit copy (design D-1) (verify: node --test tests/lets/delegate/protocol.test.ts tests/resolver-kit/copies.test.ts) (✓ node --test tests/lets/delegate/protocol.test.ts tests/resolver-kit/copies.test.ts passed)
- [x] 1.2 [easy] `parseResponse('probe')` requires `options`, a list of model strings, which may be empty. The change goes in both copies (verify: node --test tests/lets/delegate/protocol.test.ts tests/resolver-kit/copies.test.ts) (✓ node --test tests/lets/delegate/protocol.test.ts tests/resolver-kit/copies.test.ts passed)
- [x] 1.3 [medium] The kit answers `probe` with the adapter's `options`, and passes the parsed model to `spawn`. `Refused`, exit 3, replaces `NoFamilyError` in both `errors.ts` copies. When `waitForResult` throws `Refused`, the kit calls `finish(handle, true)`, then exits 3. `pickFamily`, `pickReviewer`, `familiesFromExecutors` and `Available` go (design D-2, D-3, D-4) (verify: node --test tests/resolver-kit/*.test.ts) (✓ node --test tests/resolver-kit/*.test.ts passed)

## 2. The subagent resolver [depends-on: 1]

- [x] 2.1 [parallel] [easy] `lets-delegate-subagent probe` prints `{"resolver":"subagent","options":[]}`. `run` still exits 3, and `start` with any valid `model` still hands the prompt back (verify: node --test tests/subagent-resolver/*.test.ts) (✓ node --test tests/subagent-resolver/*.test.ts passed)

## 3. The T3 resolver [depends-on: 1]

- [x] 3.1 [parallel] [medium] Inside T3, `probe` lists `<family>/<model>` from the manifest: providers in key order, each default first, Gemini once without its effort suffix (design D-5) (verify: node --test tests/t3-resolver/*.test.ts) (✓ node --test tests/t3-resolver/*.test.ts passed)
- [x] 3.2 [medium] T3 `run` and `start` launch the thread on the request's model. A bare family takes the provider default. `run` adds the effort to a Gemini id, and `start` adds `-medium`. `startSelection` and `START_MODEL` go (design D-6) (verify: node --test tests/t3-resolver/*.test.ts) (✓ node --test tests/t3-resolver/*.test.ts passed)
- [ ] 3.3 [medium] T3 refusals exit 3: not running, no project, token rejected twice, a refused WebSocket or request, a `git` failure, and a run that failed with no assistant message, which also archives the thread. No reply to `launchThread` stays exit 4 (design D-3) (verify: node --test tests/t3-resolver/*.test.ts)

## 4. The cli resolver [depends-on: 1]

- [ ] 4.1 [parallel] [complex] `lets-delegate-cli probe` lists models as the spec says:
  - codex: `visibility: list` slugs;
  - agy: `gemini-*` ids, effort stripped, without duplicates;
  - claude: the bare family `claude`;
  - a listing that fails or runs past 20 seconds: the bare family, with a warning on stderr.

  The listings run in parallel (design D-5) (verify: node --test tests/cli-resolver/*.test.ts)
- [ ] 4.2 [medium] `lets-delegate-cli run` runs the given model: `-m`/`--model` with its id, no model flag for a bare family, and the effort added to a Gemini id. A CLI that cannot start, or that exits non-zero having printed nothing, is exit 3. It removes an old last-message file before it starts codex (design D-3) (verify: node --test tests/cli-resolver/*.test.ts)

## 5. lets [depends-on: 1]

- [ ] 5.1 [parallel] [medium] `lets delegate review` and `lets delegate handoff` require `--model`. They exit 2 on a missing or bad value before any resolver runs, and send the value unchanged. `handoff` passes a resolver's exit 3 through. The help text names `--model` and the new exit 3 and exit 4 (design D-7) (verify: node --test tests/lets/delegate/cli.test.ts tests/lets/delegate/review.test.ts tests/lets/delegate/handoff.test.ts)
- [ ] 5.2 [medium] `lets delegate verify` fails a `probe` answer without valid `options`. The live part tries the options in order until one run does not exit 3. It fails when every option is refused, and skips the run when `options` is empty (design D-8) (verify: node --test tests/lets/delegate/verify.test.ts)

## 6. Contract docs and the whole build [depends-on: 2, 3, 4, 5]

- [ ] 6.1 [easy] The `headless-resolver` example speaks protocol 2, as design D-9 says. `docs/resolver-contract.md` documents `options`, `model`, protocol 2 and the new exit 3 and exit 4, and drops `reviewers`. The `delegate-config` main spec's Purpose no longer mentions `reviewers` (verify: pnpm verify)
- [ ] 6.2 [easy] Every test, the type check, the verify runs, the bats tests and the flake build pass, and the release copies' `probe` matches the specs (verify: pnpm test && nix flake check)

## Deviations Ledger
