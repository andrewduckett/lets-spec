## Context

`lets delegate` asks resolvers in order (`lets/src/delegate/lookup.ts`): the executable `LETS_SPEC_RESOLVER` names, then `lets-delegate-resolver` on `PATH`, then the built-in default in `lets/src/delegate/default-resolver.ts`. The default never declines.

Today the default does two things this change removes:

- `run` picks a family with `pickFamily` and `familiesFromExecutors` (`lets/src/delegate/families.ts`), and runs `codex exec`, `claude -p` or `agy` headless. It throws `NoFamilyError`, which is exit 3, only when none is on `PATH`.
- `start` looks up `claude`, `codex` or `agy`, and returns `handle: null` with instructions to paste a command.

The review skills already treat exit 3 as "no fresh session can run here" and take a read-only subagent step (`skills/lets-review-code/SKILL.md`, `skills/lets-review-plan/SKILL.md`). `lets-build` already shows a `handle: null` answer's `instructions` and stops. Neither skill needs a new branch.

`contrib/lets-delegate-resolver/` keeps its own copy of `families.ts` and its own exit-3 path. This change does not touch it.

## Goals / Non-Goals

**Goals:**
- The default's `run` exits 3 at once, with a message pointing at the subagent step.
- The default's `start` hands back the prompt, its saved path, and no CLI name.
- No headless executor code stays in `lets`.

**Non-Goals:**
- A replacement headless resolver (#40, D6).
- Any change to the lookup order, `LETS_SPEC_RESOLVER`, the protocol, or `contrib/lets-delegate-resolver/`.
- New wording or steps in the review skills' subagent step.

## Test Seams

- **Primary test seam:** the command functions `run` in `lets/src/delegate/review.ts` and `lets/src/delegate/handoff.ts`, driven with `commandDeps({ resolver: false, commands: [...] })` from `tests/lets/delegate/fixtures/command-deps.ts`. This goes through lookup and the default, as a user's command would, and observes the exit code, stdout, stderr and the files written.
- **Existing seams reused:** `tests/lets/delegate/review.test.ts` and `tests/lets/delegate/handoff.test.ts`, which already have "with no resolver" tests. `tests/lets/delegate/default-resolver.test.ts` keeps only what the default still does: `probe`, `finish` answering `null`, and writing the prompt file.

## Scrutiny Tier & Blast Radius

- **Tier:** medium. It is one subsystem, and the protocol is unchanged. But it removes a working path that users with no resolver installed rely on for cross-family reviews.
- **Blast radius:** `lets/src/delegate/default-resolver.ts`, `families.ts`, `cli.ts` help text, their tests, `README.md`, and the wording of the three skills. Every user with no resolver installed now gets same-family subagent reviews.

## Decisions

**D-1. The default's review answer is exit 3 through the existing `NoFamilyError` path, with a new message.** The default's `run` throws at once, and starts nothing. The message reads like: `no resolver started a session here, so no fresh session can run. Run the review in a subagent.` It must not say that no resolver is installed: the default also answers when an installed resolver declines, such as the T3 resolver run outside T3. Exit 3 already means "take the subagent step" to both review skills, so neither changes its branch.
*Alternatives:* a new exit code (every skill and resolver would have to learn it, for the same action); a `run` response that says "subagent" (the protocol's `run` response requires `text`, and the skills read the exit code, not a response).

**D-2. Exit 3 is renamed in meaning, not in value.** `EXIT.noFamily` becomes `EXIT.noSession`, and the help text for 3 becomes "no fresh session can run here: no resolver started one, or none of its families is available". The rest of `lets/src/cli.ts` changes with it: `DELEGATE_HELP` stops saying the default runs codex, claude or agy, and the `review` description says a resolver picks the family. `NoFamilyError` stays, because the contrib resolver and `pickFamily` in contrib still throw it for the second case.

**D-3. The headless runner is deleted from `lets`, not kept unused.** `runCommand`, `HEADLESS_EXECUTOR`, `familiesFromExecutors`, `pickFamily`, the default's `lastMessagePath` and its `execFile` call go, with their tests. `scrubbedEnv` in `env.ts` is used only by the default's `run`, so that function goes. `env.ts` stays, with the `Env` type that `lookup.ts` imports and `SESSION_MARKERS`, which `contrib/lets-delegate-resolver/README.md` points resolver authors to. The contrib copies stay. #40 can rebuild from the contrib copy or from git history (D6).
*Alternative:* keep the code behind a flag for #40. It would be dead code with tests in the meantime.

**D-4. The handoff instructions are fixed text around the prompt.** The format is `Start any agent in <cwd> and give it this prompt, which is also saved in <file>:` followed by a blank line and the prompt. No `commandExists` lookup. The default still writes the prompt to `.workspace/lets-delegate/<name>.prompt.md`, as the user's copy to paste. Nothing removes it, as today: no handle comes back, so nothing calls `finish` for it, and `.workspace/` is git-ignored scratch.

**D-5. The default keeps `finish`, and it answers `null`.** The default never issues a handle now, so it has nothing to finish. The default resolver keeps the verb because the protocol requires every resolver to answer it. Its test checks that it answers `null` and removes nothing.

**D-6. Skill wording only.** `lets-review-code` and `lets-review-plan` change "**3**: no fresh session can run here" to add "for example, no resolver is installed". `lets-build`'s handoff step says that the default's `instructions` hold the prompt to carry on by hand. Each skill's branches stay the same.

## Risks / Trade-offs

- [A user with codex on `PATH` and no resolver loses cross-family reviews] → The proposal marks it **BREAKING**. The release notes and README say to install a resolver, and #40 makes that one command. The subagent review records `independent: no`, so a same-family review is never mistaken for an independent one.
- [#35's fix targets code this change deletes] → The brainstorm records it. #35 is re-scoped or closed when #40 is shaped.
- [Deleting `scrubbedEnv` breaks an import elsewhere] → The build task greps for every import before deleting, and `pnpm test` plus `nix flake check` catch the rest.

## Migration & Rollback

No data changes shape. A user who wants today's headless review installs a resolver. Rollback is reverting the change's commits. The protocol is unchanged, so installed resolvers are unaffected either way.
