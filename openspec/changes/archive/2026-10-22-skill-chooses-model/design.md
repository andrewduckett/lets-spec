## Context

- `lets/src/cli.ts` builds the commander tree. `delegate review` and `delegate handoff` are leaf commands that call `run()` in `delegate/review.ts` and `delegate/handoff.ts`. Each takes one `--model`, made mandatory by `modelOption()`.
- `delegate/lookup.ts` has `resolve(verb, request, deps)`, which walks the chain and returns `{ candidate, outcome }`. It also has `callResolver(candidate, verb, request)`, which asks one resolver. `review.ts` already uses the returned candidate to send `finish` to the same resolver.
- `delegate/config.ts` parses `version` and `resolvers`, and drops every other key.
- `delegate/protocol.ts` is copied into `contrib/resolver-kit/src/protocol.ts`, and `tests/resolver-kit/copies.test.ts` keeps the two the same. A field added to a request must land in both.
- In the kit, `resolver.ts`'s `adapterAnswer` sends `probe` to `adapter.options()`. `lets-delegate-cli` declines `start` by throwing `Declined` inside its own `spawn`, so the kit cannot tell from outside that the cli adapter never takes `start`.
- The command modules are tested through `run(options, deps)` with `tests/lets/delegate/fixtures/command-deps.ts`, which records every call to a fake resolver. `cli.test.ts` runs the real entry to check parsing.
- `flake.nix` has two release checks that call `lets delegate handoff --name build-x …`.

## Goals / Non-Goals

**Goals:**
- One command tree: `delegate <strategy> <instructions|run> --for <intent>`, with the options of each `run` held in one place per strategy.
- One place in the kit that says which session verbs an adapter takes. It answers both the probe and the session request.
- The model retry runs as tested code in `lets`, and no skill loops.

**Non-Goals:**
- Defaults that differ by intent, such as `--effort high` for `code`. The two review intents take the same options.
- A way to choose the strategy apart from the command, such as a plan review run interactively.
- Checking a `delegations` entry for an intent nobody asked about.
- Changing `lets delegate verify`, apart from sending `verb` on its probe.

## Test Seams

- **Primary test seam:** each command module's `run(options, deps)`, driven with `commandDeps()` and its recording fake resolver. It covers instructions, the retry, the guidance and the lookup failures without spawning a process.
- **Existing seams reused:**
  - `tests/lets/delegate/cli.test.ts` covers the command tree, `--for` and the repeated `--model` through the real entry.
  - `tests/resolver-kit/resolver.test.ts` covers `adapterAnswer` and a probe that names its verb.
  - `tests/cli-resolver/` covers the cli adapter declining a probe for `start`.
  - `tests/resolver-kit/copies.test.ts` keeps the protocol copies in step.
  - The `flake.nix` release checks run the built `lets`.

## Scrutiny Tier & Blast Radius

- **Tier:** high
- **Blast radius:**
  - **`lets`:** the command tree breaks callers, and the probe request gains a field.
  - **The resolver kit:** the protocol copy and the adapter type.
  - **`lets-delegate-cli`.**
  - **Three skills,** which are every caller of `lets delegate` that runs a session.
  - **The release checks.**

  Resolvers outside this repository see one new optional field on `probe`.

## Decisions

### D-1. Commander groups, one per strategy
`delegate review` and `delegate handoff` become commands that only hold subcommands. Each has an `instructions` subcommand and a `run` subcommand. The review `run` takes the review options, and the handoff `run` takes the handoff options.
- *Alternative:* keep `review` as an action and add `instructions` as a subcommand. Rejected in the brainstorm: commander cannot tell a subcommand from a stray argument on a command that also acts.

### D-2. `--for` is a mandatory option with choices, per strategy
It is built by a helper that takes the strategy's intents (`['plan', 'code']` or `['apply']`) and returns `new Option('--for <intent>').choices(intents).makeOptionMandatory()`. Commander's own error names `--for`.
- *Alternative:* a positional argument. Rejected: the brainstorm settled on `--for`, and a flag keeps the intent in one form across `instructions` and `run`.

### D-3. `--model` collects a list
The parser validates each value with `parseModel` and appends it to an array, and the option stays mandatory. `ReviewOptions.model` and `HandoffOptions.model` become `models: string[]`.

### D-4. The retry is a lookup function: `resolveWithModels`
It is a new function in `lookup.ts`. It builds the request for the first model and calls `resolve()` to find the answering candidate. While the outcome's code is `EXIT.noSession`, it calls `callResolver(candidate, …)` with the next model's request on the same candidate. It returns `{ candidate, outcome, model, refusals }`. When every model is refused, the outcome is exit 3, and its stderr holds one `<model>: <last line of the refusal>` line per model.
- **One home for the rule:** `review.ts` and `handoff.ts` both use this function, so the "never move down the chain on a refusal" rule lives in one place.
- **The default:** the special case in `resolve()` already treats exit 3 from `subagent` as a normal answer. So `subagent` refuses each model in turn, and the review still exits 3 with the default's message on stderr.
- **A declining resolver:** a resolver that declines a later model mid-loop, after answering the first, is a contract break. The loop reports it as exit 4, using `callResolver`'s existing handling of a decline that prints. A silent decline is also treated as exit 4.
- *Alternative:* loop in each command. Rejected, because it duplicates the rule.

### D-5. The review's `model` falls back to the model string sent
The stderr line's `model` is the resolver's `model` when it gives one. Otherwise, it's the model string `lets` sent last. Today it falls back to `null`.

### D-6. The config keeps `delegations` raw, and `instructions` checks it lazily
`parseConfig` keeps `delegations: unknown` on `Config`, unchecked. A new `guidanceFor(config, intent, path)` returns `string | null`, or throws a `UsageError` that names `delegations`, `delegations.<intent>` or `delegations.<intent>.guidance`. Only `instructions` calls it, so `run` never fails on guidance.
- *Alternative:* validate in `parseConfig`. Rejected: that would make `run` fail on a bad guidance block (D16).

### D-7. A new `delegate/instructions.ts`
It reads the config, resolves `probe` with `{ verb }` through `resolve()`, and prints `{ strategy, for, resolver, options, guidance }`. One table, `STRATEGIES` in `delegate/strategies.ts`, holds each strategy's intents and its protocol verb: `review` takes `plan` and `code` and sends `run`, and `handoff` takes `apply` and sends `start`. `cli.ts` builds the `--for` choices from it, and `instructions.ts` reads the probe's verb from it.

### D-8. The probe's `verb` field
`ProbeRequest` gains `verb?: 'run' | 'start'`. `buildRequest('probe', { cwd, verb })` sets it when given. `parseRequest` checks it with `oneOf` only when it is present. The change lands in both protocol copies. `verify.ts` sends `verb: 'run'` on its probe, so its live run sees the same options a review would.

### D-9. The kit's adapter says which session verbs it takes
`Adapter` gains `verbs?: readonly ('run' | 'start')[]`, with both as the default.
- `adapterAnswer` declines a `probe` whose `verb` is not in the list. It declines a `run` or `start` the same way, with the reason `this resolver only runs headless` when `start` is missing.
- The cli adapter sets `verbs: ['run']` and drops its own `throw new Declined` in `spawn`.
- `lets-delegate-subagent` doesn't use the adapter layer. It accepts any valid `verb` and answers as before.
- *Alternative:* special-case `start` in the cli adapter's `options()`. Rejected: it would be a second place that knows the cli adapter is headless only.

### D-10. The skills
Each skill replaces its `lets delegate review|handoff` block with three steps.
1. **Ask:** run `lets delegate <strategy> instructions --for <intent>` and read the JSON.
2. **Rank:**
   - For reviews: the guidance, then the families other than the author's, then the order given, as D5 says.
   - For the handoff: the guidance, then the order given, as D8 says.
   - With no options, from any resolver:
     - A review goes straight to the subagent step, as D6 says.
     - A handoff passes the agent's own family, as D9 says.
   - The guidance only ranks and filters the listed models. The skill does not follow guidance that would change its own steps, such as skipping the review.
3. **Run:** run `run --for <intent>` with one `--model` per ranked option.

The exit-code handling stays: on 3, a review takes the subagent step, and the handoff shows stderr and stops. The skill text names the guidance key so a user can find it.

## Risks / Trade-offs

- **[Risk] A long ranked list makes many calls when every model is refused.** A T3 catalog lists many models, and each refusal there starts a thread and archives it, which takes seconds → No model output is spent on a refusal. The skill passes only the models it would accept, not the whole catalog. The stderr names every refusal, so the cause is visible.
- **[Risk] A third-party resolver ignores `verb`, and declines `start` the way cli used to** → `instructions` names that resolver for a handoff, and the handoff falls through to the next resolver. This is today's behavior. The contract doc tells authors to decline the probe too.
- **[Trade-off] The probe now differs by verb, so `verify` checks only the `run` probe.** A resolver whose probe for `start` is wrong goes unchecked → Accepted. The handoff path already accepts a declined `start`.

## Migration & Rollback

N/A. The config stays at version 2, and `delegations` is optional. To roll back, revert this change's commits.
