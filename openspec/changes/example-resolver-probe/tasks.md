## 1. The sh example declines a probe for start

- [x] 1.1 [easy] `contrib/headless-resolver probe` with `"verb":"start"` exits 75, prints nothing on stdout, and prints `headless-resolver: this resolver only runs headless` on stderr; with `"verb":"run"` or no `verb` it still prints `{"resolver":"headless-sh","options":["claude"]}`. Test it in a new `tests/lets/delegate/headless-resolver.test.ts` (verify: node --test tests/lets/delegate/headless-resolver.test.ts) (✓ node --test tests/lets/delegate/headless-resolver.test.ts passed)
- [x] 1.2 [easy] The contract's embedded copy of the script matches the script again, and the prose before it says the example declines `start` and a probe for `start` (verify: bats tests/skill-interfaces.bats) (✓ bats tests/skill-interfaces.bats passed)
- [x] 1.3 [medium] With a delegate config that lists the absolute path of `contrib/headless-resolver`, then `subagent`, `lets delegate handoff instructions --for apply` prints a JSON line with `"resolver":"subagent"` (verify: node --test tests/lets/delegate/cli.test.ts) (✓ node --test tests/lets/delegate/cli.test.ts passed)

## 2. verify checks the probe for start

- [x] 2.1 [medium] `lets delegate verify` sends a second probe, with `"verb":"start"`, and reports it on its own line: `ok` when it exits 75 with nothing on stdout, or exits 0 with a `resolver` and valid `options`; `FAIL` naming `options` for `{"resolver":"x"}`, and `FAIL` for a 75 that prints. The fake resolver fixture gains a setting keyed on the probe's `verb`, such as `FAKE_RESOLVER_EXIT_PROBE_START`, so a test can answer the two probes differently (verify: node --test tests/lets/delegate/verify.test.ts) (✓ node --test tests/lets/delegate/verify.test.ts passed)
- [x] 2.2 [medium] With `--live`, the line `a resolver that declines start also declines its probe` fails when `start` exits 75 and the probe for `start` exited 0, and passes when both decline or both answer; without `--live` the line does not print. The existing test of a declined live `start` also declines the probe for `start`, and still exits 0 (verify: node --test tests/lets/delegate/verify.test.ts) (✓ node --test tests/lets/delegate/verify.test.ts passed)
- [ ] 2.3 [easy] With `--live`, the `start` request names the first option from the probe for `start`, and `claude` when that probe was declined, failed its check or listed none (verify: node --test tests/lets/delegate/verify.test.ts)

## 3. Contract and integration

- [ ] 3.1 [easy] The contract's paragraph on `lets delegate verify` says it probes for `start` as well as `run`, and that `--live` fails a resolver that declines `start` but answers its probe; the embedded script stays identical to `contrib/headless-resolver` (verify: bats tests/skill-interfaces.bats)
- [ ] 3.2 [easy] `lets delegate verify` passes for all four shipped resolvers, and the whole suite passes (verify: pnpm test)
- [ ] 3.3 [easy] The flake builds every flow and the release folder with the changed script (verify: nix flake check)
