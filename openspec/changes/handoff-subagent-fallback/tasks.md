## 1. The default resolver

- [x] 1.1 [medium] With no resolver installed, `lets delegate review` exits 3, prints nothing on stdout, and starts no process, even with `codex`, `claude` and `agy` on `PATH` (verify: node --test tests/lets/delegate/review.test.ts) (✓ node --test tests/lets/delegate/review.test.ts passed)
- [x] 1.2 [easy] The default's review answer says on stderr that no resolver started a session and to run the review in a subagent, and never says "installed" (verify: node --test tests/lets/delegate/review.test.ts) (✓ node --test tests/lets/delegate/review.test.ts passed)
- [x] 1.3 [medium] With no resolver installed, `lets delegate handoff` exits 0 with `"resolver":"default"`, `"handle":null`, and instructions holding the prompt text and `.workspace/lets-delegate/<name>.prompt.md`, where the prompt is saved (verify: node --test tests/lets/delegate/handoff.test.ts) (✓ node --test tests/lets/delegate/handoff.test.ts passed)
- [x] 1.4 [easy] The default's handoff instructions are the same with or without `claude`, `codex` and `agy` on `PATH`, and name none of them (verify: node --test tests/lets/delegate/handoff.test.ts) (✓ node --test tests/lets/delegate/handoff.test.ts passed)
- [x] 1.5 [easy] The default's `finish` answers `null` for any handle and removes no file (verify: node --test tests/lets/delegate/default-resolver.test.ts) (✓ node --test tests/lets/delegate/default-resolver.test.ts passed)
- [x] 1.6 [medium] `lets` holds no headless runner: `runCommand`, `HEADLESS_EXECUTOR`, `familiesFromExecutors`, `pickFamily` and `scrubbedEnv` go with their tests, `env.ts` keeps `Env` and `SESSION_MARKERS`, and `EXIT.noFamily` becomes `EXIT.noSession` with the value 3 (verify: pnpm check) (✓ pnpm check passed)
- [x] 1.7 [easy] `lets delegate review --help` describes exit 3 as "no fresh session can run here: no resolver started one, or none of its families is available", and `lets delegate --help` and the `review` description no longer say the default runs codex, claude or agy (verify: node --test tests/lets/delegate/cli.test.ts) (✓ node --test tests/lets/delegate/cli.test.ts passed)

## 2. Docs and skills [depends-on: 1]

- [x] 2.1 [parallel] [easy] The README's *lets delegate*, *What a review gets* and *Resolvers* sections say the default runs no review session and hands back the prompt for a handoff, and the review rungs drop the headless CLIs (verify: ! grep -nE "runs .codex., .claude. or .agy.|headless CLI of" README.md) (✓ ! grep -nE "runs .codex., .claude. or .agy.|headless CLI of" README.md passed)
- [x] 2.2 [parallel] [easy] `lets-review-code` and `lets-review-plan` say exit 3 also means no resolver started a session, and `lets-build`'s handoff step says the default's instructions hold the prompt to carry on by hand (verify: bats tests/skill-interfaces.bats) (✓ bats tests/skill-interfaces.bats passed)

## 3. Integration [depends-on: 2]

- [ ] 3.1 [easy] The whole suite, the type check, conformance and the flake pass (verify: pnpm test && nix flake check)

## Deviations Ledger
- 1.4: its test passed on the first run, because 1.3's fixed text already named no CLI. Run against the resolver before 1.3, it fails.
- 2.1: the README's prerequisites row for `codex`, `claude` or `agy` also said `lets delegate` runs reviews through them. It now names an optional resolver instead.
- 2.2: design D-6 suggested "for example, no resolver is installed" for exit 3. The skills say "for example because no resolver started one, or none of its families is available" instead, because the default also answers when an installed resolver declines, as the spec says for stderr. Two bats tests pin the new wording.
