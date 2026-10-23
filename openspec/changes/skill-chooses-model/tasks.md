## 1. Shared contracts

- [x] 1.1 [medium] A `probe` request may carry `verb`, `run` or `start`. `buildRequest('probe', { cwd, verb })` sets it, `parseRequest` rejects any other value with a usage error that names `verb`, the kit's copy of the protocol matches, and `lets delegate verify` sends `verb: 'run'` on its probe (design D-8) (verify: node --test tests/lets/delegate/protocol.test.ts tests/resolver-kit/copies.test.ts tests/subagent-resolver/subagent.test.ts tests/lets/delegate/verify.test.ts) (✓ node --test tests/lets/delegate/protocol.test.ts tests/resolver-kit/copies.test.ts tests/subagent-resolver/subagent.test.ts tests/lets/delegate/verify.test.ts passed)
- [x] 1.2 [medium] `guidanceFor(config, intent, path)` returns the string at `delegations.<intent>.guidance`, or `null` when any level is missing. It throws a usage error that names the file and the bad key when `delegations`, the intent's entry or its `guidance` has the wrong type, and it ignores other intents' entries. `parseConfig` keeps `delegations` unchecked (design D-6) (verify: node --test tests/lets/delegate/config.test.ts) (✓ node --test tests/lets/delegate/config.test.ts passed)
- [x] 1.3 [easy] `STRATEGIES` in `lets/src/delegate/strategies.ts` maps `review` to the intents `plan` and `code` and the verb `run`, and `handoff` to the intent `apply` and the verb `start` (design D-7) (verify: node --test tests/lets/delegate/strategies.test.ts) (✓ node --test tests/lets/delegate/strategies.test.ts passed)

## 2. Resolvers [depends-on: 1]

- [x] 2.1 [parallel] [medium] An adapter may declare the session verbs it takes. `adapterAnswer` declines a `probe` whose `verb` the adapter does not take, and declines that `run` or `start` the same way. `lets-delegate-cli` takes only `run`, so it declines a probe for `start` without running a listing command, and still declines `start` with `this resolver only runs headless` (design D-9) (verify: node --test tests/resolver-kit/resolver.test.ts tests/cli-resolver/resolver.test.ts tests/cli-resolver/cli.test.ts) (✓ node --test tests/resolver-kit/resolver.test.ts tests/cli-resolver/resolver.test.ts tests/cli-resolver/cli.test.ts passed)

## 3. lets delegate [depends-on: 1]

- [ ] 3.1 [complex] `resolveWithModels` sends the first model to the resolver the chain picks. On each exit 3 it sends the next model to the same resolver, and it stops at the first answer that is not exit 3. When every model is refused, it returns exit 3 with one stderr line per model. It never asks a later resolver after a refusal, and it treats a decline after the first answer as exit 4 (design D-4) (verify: node --test tests/lets/delegate/lookup.test.ts)
- [ ] 3.2 [medium] A review run takes a ranked list of models through `resolveWithModels`, and its stderr JSON line names as `model` the resolver's model, or the model sent when the resolver reports none or `null` (design D-5) (verify: node --test tests/lets/delegate/review.test.ts)
- [ ] 3.3 [medium] A handoff run takes a ranked list of models through `resolveWithModels`, and exits 3 when every model is refused (verify: node --test tests/lets/delegate/handoff.test.ts)
- [ ] 3.4 [medium] `instructions` probes with the strategy's verb from `STRATEGIES`, and prints one JSON line `{ strategy, for, resolver, options, guidance }` from the resolver that answers. It fails as `run` does when a listed resolver is missing or every resolver declines, and exits 2 on bad guidance (design D-7) (verify: node --test tests/lets/delegate/instructions.test.ts)
- [ ] 3.5 [medium] The command tree is `lets delegate review|handoff instructions|run` beside `verify`. Each takes a required `--for`, with the strategy's intents from `STRATEGIES` as its choices, and `run` takes `--model` one or more times. The help text names the commands, the intents and the exit codes (design D-1 to D-3) (verify: node --test tests/lets/delegate/cli.test.ts)

## 4. Skills [depends-on: 3]

- [ ] 4.1 [parallel] [medium] `lets-review-plan` and `lets-review-code` ask with `lets delegate review instructions --for plan|code`. They rank by the guidance, then other families, then the order given, and pass the ranked list to `review run`. With no options from any resolver, they take the subagent step. On exit 3, they take the subagent step. The guidance only ranks and filters models (design D-10) (verify: bats tests/skill-interfaces.bats)
- [ ] 4.2 [parallel] [easy] `lets-build`'s handoff asks with `lets delegate handoff instructions --for apply`, ranks by the guidance, then the order given, and passes the ranked list to `handoff run --for apply`. With no options, it passes the agent's own family. On exit 3, it shows stderr and stops (design D-10) (verify: bats tests/skill-interfaces.bats)

## 5. Docs and release [depends-on: 2, 3, 4]

- [ ] 5.1 [medium] The README's *Fresh sessions*, *Set up delegation* and *Resolvers* sections, and `docs/resolver-contract.md`, describe the strategies, `--for`, `instructions`, the ranked `--model`, `delegations.<intent>.guidance` and the probe's `verb`. The README's warning about #58 is gone (verify: bats tests/skill-interfaces.bats)
- [ ] 5.2 [easy] The `flake.nix` release checks call `lets delegate handoff run --for apply`, and the whole suite and the flake checks pass (verify: pnpm test && nix flake check)

## Deviations Ledger

<!-- Dated notes on small departures from the plan, written during apply. Stop and ask the user about a large one. -->
