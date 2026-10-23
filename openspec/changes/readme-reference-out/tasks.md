<!-- Docs-only change. Each move is one task: write the new home, then cut
     the README section in the same commit, so no fact has two homes.
     The README line numbers are from commit e6af129. -->

## 1. Tests follow the moved prose

- [x] 1.1 [easy] The docs-naming test in `tests/skill-interfaces.bats` reads `README.md`, every `docs/*.md` page and the contrib READMEs, with the glob outside quotes as `'$repo'/docs/*.md` (verify: bats -f "the docs name lets delegate review or handoff" tests/skill-interfaces.bats) (✓ bats -f "the docs name lets delegate review or handoff" passed; a planted bad mention in docs/ failed it)

## 2. Move the reference out [depends-on: 1]

- [ ] 2.1 [medium] `docs/lets-sync.md` holds the whole `⚙️ lets sync` section and its four subsections in the same order and wording; the README keeps the heading and one sentence that links to the page, and its two `#committed-or-ignored-skills` links point at `docs/lets-sync.md#committed-or-ignored-skills` (verify: test -f docs/lets-sync.md && ! grep -q '^### What `--check` checks' README.md && ! grep -q '](#committed-or-ignored-skills)' README.md)
- [ ] 2.2 [medium] `docs/upgrading.md` holds the four upgrade notes, newest release first: the default answers as `subagent` (0.5), `lets-delegate-resolver` is gone (0.5), `lets-sync` is now `lets sync`, then linked skills; its link to the delegate config is `../README.md#set-up-delegation`; the README's Updating section keeps its opening, "With Nix" and "With mise", and ends with one sentence linking to the page (verify: grep -q '../README.md#set-up-delegation' docs/upgrading.md && ! grep -qE '^#+ (Switching from lets-delegate-resolver|From 0.1|From a version that linked)' README.md && ! grep -q 'Before this release it said' README.md)
- [ ] 2.3 [medium] "How `lets` finds a resolver" in `docs/resolver-contract.md` says that for a review the default runs nothing and `lets delegate review run` exits 3, and that for a handoff it writes the prompt to `.workspace/lets-delegate/<name>.prompt.md` and gives back the prompt and that path; the README's `### Resolvers` keeps its heading and one sentence linking to `docs/resolver-contract.md#how-lets-finds-a-resolver` (verify: grep -q 'lets-delegate/<name>.prompt.md' docs/resolver-contract.md && ! grep -q 'lets-delegate/<name>.prompt.md' README.md && grep -q 'resolver-contract.md#how-lets-finds-a-resolver' README.md)
- [ ] 2.4 [easy] `docs/resolver-contract.md` no longer copies `contrib/headless-resolver`: the code block goes, the link and the sentences around it stay, and the test "the resolver contract shows contrib/headless-resolver as it is" goes (verify: ! grep -q '^#!/bin/sh' docs/resolver-contract.md && ! grep -q 'shows contrib/headless-resolver as it is' tests/skill-interfaces.bats)

## 3. Check the whole [depends-on: 2]

- [ ] 3.1 [easy] The project's checks pass (verify: pnpm test && nix flake check)

## Deviations Ledger
