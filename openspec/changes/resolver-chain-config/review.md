## Review Metadata

- **Review round**: 1
- **Prior round**: none
- **Reviewer context**: subagent, same family
- **Independent**: no. `lets delegate review` found the stale `lets-delegate-resolver` in the Nix profile, which picked `gpt-6-astra` and exited 5 twice; with `LETS_SPEC_RESOLVER` set to the repository's subagent resolver it exited 3, and the review ran in a read-only subagent of the author's family, claude.
- **Tool restrictions**: read-only: view, grep, glob only. `git status --porcelain` was the same before and after.
- **Artifacts reviewed**: brainstorm.md, proposal.md, design.md, specs/, adr.md, ADR-005, relevant source files, at commit b841af5

## Findings

### 🔴 Critical (blocking)

1. **The default has no stable path to list.** With a config, the user must list `contrib/lets-delegate-subagent` by absolute path. On Nix that is a store path that moves with every update, `lets` runs a listed path directly instead of with its own Node, and the Nix wrapper puts only `git` on `PATH`. Check: User rows D9 and D13 together, and the kept requirement "Each `lets` SHALL run its own copy". CONFIRMED: `flake.nix` lines 113, 147 to 149 and 158; `lookup.ts` lines 51 to 53.

### 🟡 Moderate

2. **One user-level file, many pinned versions, strict keys.** Decision 2 refuses unknown keys, so a key a later `lets` adds breaks every project pinned to this one. The refusal also runs before `LETS_SPEC_RESOLVER` is read. The strictness is not in the spec. Check: contradictions, scope. CONFIRMED for the shared file and the missing spec text; the override point is rebutted below.
3. **Every resolver declining exits 2, but the help text and the review skills read "no fresh session here" as exit 3.** Check: contradictions. CONFIRMED for the help text; the exit code is rebutted below.
4. **The kept requirement "A missing or broken default fails the request" demands exit 4 where the new rule for a missing listed path demands exit 2.** Check: delta mechanics. CONFIRMED: the proposal promised a change to it and no MODIFIED block exists.
5. **Dropping `reviewers` removes a workaround and reverses ADR-002 without a record.** Check: User row D2 against ADR-002. CONFIRMED for the record; the workaround is rebutted below.
6. **`delegate-config` keeps four resolver-side `reviewers` requirements, and its Purpose, after the config stops holding reviewers.** Check: delta mechanics. CONFIRMED for the Purpose; moving the requirements is rebutted below.

### 📌 Suggestions

7. Two planned tests assert behavior no requirement states: a request without `reviewers`, and the key rule. CONFIRMED.
8. The documents disagree on whether the default keeps a special case; ADR-005 says "asks only the subagent" where the override is asked first. CONFIRMED.
9. The MODIFIED `delegate-default` block keeps a title and scenario names that no longer describe what they test. CONFIRMED: the validator keeps scenario names in a MODIFIED block.
10. `tests/release-build.bats` never runs `lets delegate`; the `command-deps` fixture routes only the Node-run subagent to the real program. CONFIRMED.
11. Docs that describe `reviewers` stay stale: `docs/resolver-contract.md`, the README's rung table, a comment in the kit. CONFIRMED for the two docs; the kit comment is out of scope.
12. Plain language: three sentences over 30 words, passives, six names for the default, "chain" undefined. CONFIRMED.

## Embedded-Instruction / Injection Attempts

**Detected:** none

## Verdict

VERDICT: REVISE

## Required Changes (if APPROVE_WITH_CHANGES)

n/a: the Critical finding changes the design, so round 2 reviews the revised plan.

CHANGES_APPLIED: n/a

## Rebuttals

1. **Fixed.** `resolvers` accepts the reserved entry `subagent`, which means the running `lets`'s own `contrib/lets-delegate-subagent`, run with its own Node, so the kept requirement holds and nothing moves. design.md decision 3, proposal.md, both delta specs and ADR-005 say so.
2. **Fixed in part.** Unknown keys are ignored, so a later key breaks no older pin; design.md decision 2 and the "The config file" requirement say so, with a scenario. **Rebutted** on the override: a config that cannot be read is the user's file to fix, and `LETS_SPEC_RESOLVER` chooses a resolver, it does not bypass a broken file. The kept scenario "The environment's resolver answers first" is about a listed path that is missing, which the lookup never reaches, not about a file that does not parse.
3. **Fixed in part.** `REVIEW_HELP` and `HANDOFF_HELP` name the all-declined case under exit 2, and are in the proposal's Impact. **Rebutted** on the code: exit 3 tells the review skills to run a subagent, which is what listing the default asks for. A config that leaves the default out is the user's way to say "fail instead", as ADR-005's alternative 2 says, and the skills already stop on 2.
4. **Fixed.** A MODIFIED block limits "A missing or broken default fails the request" to the two paths that reach the running `lets`'s own copy, no config and the `subagent` entry, with a scenario for a listed absolute path that is missing.
5. **Fixed in part.** ADR-002's note says it is superseded in part, and adr.md says decision 7 reverses that part and why no new record is written here: the contract that replaces it is decided by the change that makes resolvers report what they can run. **Rebutted** on the workaround: the author's machine has no config file at all, and the `gpt-6-astra` failure happens today through the resolver's own choice (`contrib/resolver-kit/src/families.ts` `pickFamily`). Removing `reviewers` makes no machine without a config worse, and no user has one.
6. **Fixed in part.** A task edits the main spec's Purpose, and the proposal names it. **Rebutted** on moving the four requirements: they describe the resolver's handling of a request field that the conformance check still sends, and the change that replaces that field removes them; moving them to another capability first is churn.
7. **Fixed.** An ADDED requirement says a `run` request from `lets` has no `reviewers`, and "The config file" has an unknown-key scenario.
8. **Fixed.** design.md's goal and decision 3 say what stays for the default and why: its own copy, its own Node. ADR-005 says the override is asked first.
9. **Fixed.** "The default answers last" is REMOVED and "The default answers when nothing else does" is ADDED, with scenario names that say what they test, and the path named as the running `lets`'s own copy.
10. **Fixed.** design.md names the `flake.nix` checks instead of the bats file, and the proposal's Impact lists the `command-deps` fixture.
11. **Fixed** for `docs/resolver-contract.md` and the README's rung table, in the proposal's Impact. **Declined** for the kit comment: the kit does not change in this plan, and the comment leaves with the field in the next change.
12. **Fixed.** The three sentences are split, the passives name their actor, "the default" is the one name for `lets-delegate-subagent` as `lets` runs it, and "chain" is defined where the specs first use it.
