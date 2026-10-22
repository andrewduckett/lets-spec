## Why

Since #58, `lets delegate review` and `lets delegate handoff` need `--model`, but the review skills and the `lets-build` handoff do not pass one, so every delegated review and handoff exits 2 (D1). The skill is the one place that knows the purpose, the author's family and the user's wishes, so it should choose the model. This change gives it what it needs to choose: what can run now, and the user's guidance for this kind of work.

## What Changes

- `lets delegate review` and `lets delegate handoff` become groups, each with two commands, `instructions` and `run` (D11, D12).
- `--for <intent>` names what a delegation is for, and is required on every `instructions` and `run` (D13). `review` takes `plan` or `code`. `handoff` takes `apply`.
- New: `lets delegate review|handoff instructions --for <intent>` prints one JSON line with the strategy, the intent, the resolver that will answer, the models it can run now, and the user's guidance (D14, D18).
- New: the delegate config may hold `delegations.<intent>.guidance`, a string of prose for the skill to follow. The config stays at version 2. Only `instructions` reads the key (D15, D16).
- `run` takes `--model` more than once, as a ranked list. When the resolver refuses a model (exit 3), `lets` tries the next one on the same resolver. Exit 3 now means every model was refused. The review's stderr line names the model that ran (D17, D19).
- The `probe` request may name the verb it is for, `run` or `start`. `lets` always sends it, and a resolver may decline a probe for a verb it would decline. The field is optional, and the protocol stays at 2 (D3, D4).
- `lets-delegate-cli` declines a probe for `start`, as it declines `start` itself (D3).
- `lets-review-code`, `lets-review-plan` and `lets-build` ask with `instructions`, rank the models, and call `run` with the ranked list (D5–D9, D20). A review whose resolver is `subagent` with no models runs its subagent step at once (D6).
- The help text, `docs/resolver-contract.md` and the README follow. The README's warning about #58 goes.

The review's stderr line already reports `model` and `independent`, so that item of the story is dropped (D2).

## Capabilities

### New Capabilities
- `delegate-instructions`: the `instructions` command, which tells a skill what can run for an intent: the strategy, the resolver that will answer, its models and the user's guidance, and where the guidance lives in the config.

### Modified Capabilities
- `delegate-config`: the commands become `review run` and `handoff run`, with `--for`. `--model` becomes a ranked list that `lets` tries in order on a refusal. The config may hold a `delegations` key.
- `delegate-default`: the scenarios name `review run --for` and `handoff run --for` instead of `review` and `handoff`. What the default does is unchanged.
- `contrib-resolvers`: the cli resolver declines a probe for `start`.

## Impact

- **Code:** `lets/src/cli.ts` (the command tree and its help text), `lets/src/delegate/config.ts`, `review.ts`, `handoff.ts`, `lookup.ts`, `protocol.ts`, and a new module for `instructions`. `lets/src/delegate/verify.ts` sends its probe for `run`. `contrib/resolver-kit/` keeps its copy of the protocol in step, and `contrib/cli-resolver/` declines a probe for `start`.
- **Skills:** `skills/lets-review-code/SKILL.md`, `skills/lets-review-plan/SKILL.md` and `skills/lets-build/SKILL.md`.
- **Tests:** `tests/lets/delegate/` (cli, config, review, handoff, lookup and protocol tests), `tests/resolver-kit/` and `tests/cli-resolver/`, and the release checks that call `lets delegate`.
- **Docs:** `README.md` (*Fresh sessions*, *Set up delegation* and *Resolvers*) and `docs/resolver-contract.md`.
