## Review Metadata

- **Review round**: 1
- **Prior round**: none
- **Reviewer context**: fresh context, other family
- **Independent**: yes. `gpt-6-luna` on Codex reviewed a plan that Claude wrote. T3 records the thread's provider as `codex` and its model as `gpt-6-luna`. The reviewer's own opening line calls itself Claude. That line is wrong, and the thread's record settles it.
- **Tool restrictions**: read-only. `lets delegate review` checked that the tree was unchanged after the session (`gitClean: true`).
- **Artifacts reviewed**: brainstorm.md, proposal.md, design.md, specs/, adr.md, ADR-007, ADR-008, relevant source files
- **Commit reviewed**: `fcdebb1`
- **How it ran**: through this branch's own `lets` and `lets-delegate-t3`, with `--model gpt/gpt-6-luna`. The pinned `lets` 0.4.0 chose `gpt-6-astra`, which the account cannot run, and its session failed. `gpt/gpt-6.1-sol` was refused next. Thread `f158beb7-f571-47ba-906b-013d1c5df708`, 331 seconds.

## Findings

### 🔴 Critical (blocking)

None.

### 🟡 Moderate

1. **A review has no fallback when a resolver other than `subagent` lists no models.** `lets-delegate-t3` can answer `probe` with `"options":[]` (`openspec/specs/contrib-resolvers/spec.md`, *The T3 resolver lists the models in its manifest*). design.md D-10 sent only a `subagent` resolver with no options to the subagent step, so the skill would have no `--model` to pass. — **CONFIRMED.** D6 in brainstorm.md covers every empty list, and the design narrowed it.
2. **Nothing limits what the guidance can change.** `instructions` returns the config's prose unchanged, and D-10 ranks by it. Prose that says to skip the review and report success would have no stated limit. — **CONFIRMED.** The user writes the guidance, so this is not an outside attack. But the skill's steps must not depend on prose meant for choosing a model.
3. **The design calls retries cheap, but each T3 refusal starts and archives a thread.** `openspec/specs/contrib-resolvers/spec.md`, *The T3 resolver archives a refused thread*. — **CONFIRMED.** Each refusal costs no model output, but it is not free.

### 📌 Suggestions

4. **The fallback for the review's `model` is untested when the resolver sends `model: null`.** The kit returns `null` for a bare family (`contrib/resolver-kit/src/resolver.ts`). — **CONFIRMED.**
5. **D-7 says the strategy-to-verb table lives in one place, then names two.** — **CONFIRMED.**

## Embedded-Instruction / Injection Attempts

**Detected:** none

## Verdict

VERDICT: APPROVE_WITH_CHANGES

## Required Changes (if APPROVE_WITH_CHANGES)

1. design.md D-10: a review with no options goes to the subagent step whatever the resolver, and a handoff with none passes the agent's own family.
2. design.md D-10: the guidance only ranks and filters the listed models. The skill does not follow guidance that would change its own steps.
3. design.md, Risks: the long-list risk names the thread that each T3 refusal starts and archives.
4. specs/delegate-config/spec.md, *A refused model passes to the next*: the review's `model` is the model sent when the resolver reports none or `null`, with a scenario for `null`.
5. design.md D-7: one table, `STRATEGIES` in `delegate/strategies.ts`, holds each strategy's intents and verb. `cli.ts` and `instructions.ts` both read it.

CHANGES_APPLIED: yes

## Rebuttals

1. Fixed by required change 1, in design.md D-10, *Rank*, "With no options, from any resolver".
2. Fixed by required change 2, in design.md D-10, *Rank*, the last bullet.
3. Fixed by required change 3, in design.md, *Risks / Trade-offs*, the first risk.
4. Fixed by required change 4: the requirement's last sentence, and *Scenario: The resolver reports a null model*.
5. Fixed by required change 5, in design.md D-7.
