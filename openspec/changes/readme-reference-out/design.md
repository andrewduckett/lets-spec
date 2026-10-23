## Context

The text to move sits in three places in `README.md`:

- `## ⚙️ lets sync` and its four subsections (lines 745-863).
- `### Resolvers` under Fresh sessions (617-655), and
  `#### Switching from lets-delegate-resolver` (677-690).
- `### From 0.1` and `### From a version that linked the skills` under
  Updating (904-936).

`docs/resolver-contract.md` already says most of what "Resolvers" says.
It also holds a full copy of `contrib/headless-resolver`, which a bats
test pins to the file.

Links into the moved text: the README's own `#committed-or-ignored-skills`
(twice) and `#resolvers` (once). The contrib READMEs link only to
`#set-up-delegation`, which stays.

## Goals / Non-Goals

**Goals:**

- Each fact has one home. Text moves; it is not copied.
- Moved text keeps its wording, apart from headings and links that the
  new page needs.

**Non-Goals:**

- Rewriting what stays in the README. The front-door story does that.
- Moving the monorepo notes, the vocabulary, or the mise snippet.

## Test Seams

- **Primary test seam:** `tests/skill-interfaces.bats`, run by
  `pnpm test`.
- **Existing seams reused:** the test that checks how the docs name
  `lets delegate review` and `handoff`. `nix flake check` builds the
  release, which does not include `docs/`.

## Scrutiny Tier & Blast Radius

- **Tier:** low
- **Blast radius:** `README.md`, `docs/`, one bats file. No code and no
  release content.

## Decisions

**`docs/lets-sync.md` takes the whole section.** It gets the section's
intro, the command table, the list of what each run does, the exit
codes, and the four subsections, in the same order. The README keeps the
`## ⚙️ lets sync` heading and one sentence: what the command does, and a
link to the page. The two `#committed-or-ignored-skills` links point at
`docs/lets-sync.md#committed-or-ignored-skills`.

**`docs/upgrading.md` is ordered by release, newest first.** The
sections are:

1. 0.5: the default now answers as `subagent` (the note now in
   "Resolvers").
2. 0.5: `lets-delegate-resolver` is gone (the "Switching" subsection and
   its table).
3. `lets-sync` is now `lets sync` (added in 0.3).
4. From a version that linked the skills (added in 0.1).

The README's Updating section keeps its opening, "With Nix" and "With
mise", and ends with one sentence that links to the page.

**Resolvers folds into the contract's "How `lets` finds a resolver".**
The contract lacks three facts, and gains them there:

- For a review, the default runs nothing: `lets delegate review run`
  exits 3, and the review skill runs a subagent.
- For a handoff, the default writes the prompt to
  `.workspace/lets-delegate/<name>.prompt.md`, and gives back the prompt
  and that path.
- When a session fails, `lets` stops. It never retries, and never asks
  another resolver.

Everything else in "Resolvers" is already in the contract, and is
dropped. The README's `#resolvers` link points at
`docs/resolver-contract.md#how-lets-finds-a-resolver`. The README's
"Write your own resolver" subsection, which stays, already links to the
contract.

**The script copy goes.** The contract keeps the sentences that link to
`contrib/headless-resolver` and say what it does, and the sentence that
it leaves out the timeout. The code block and the test "the resolver
contract shows contrib/headless-resolver as it is" go. An excerpt was
the alternative, but it still needs a test to stay true, and the file is
one click away.

**The docs-naming test reads every page in `docs/`.** It now lists
`README.md` and `docs/resolver-contract.md`. It changes to `README.md`
and `docs/*.md`, so the two new pages are covered. No other test reads
the moved text.

No decision here is costly to reverse, so none needs an ADR.

## Risks / Trade-offs

- [A fact is lost in the move] → Before deleting each README section,
  check every sentence against its new page or the contract.
- [A link breaks] → Grep the repository for `](#` targets and
  `README.md#` after the move, and follow each new link to a heading
  that exists.

## Migration & Rollback

N/A. Revert the commits to undo.
