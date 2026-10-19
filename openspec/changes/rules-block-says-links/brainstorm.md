**Why:** The rules block is the first text every agent reads, and since 0.3.0 it has told them the skills are read-only links that git ignores, which is the opposite of the truth in both skills modes.

## Story

#21 rules-block-says-links — the rules block tells agents the skills are rewritten copies, in both modes
https://github.com/andrewduckett/lets-spec/issues/21

## Decisions

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | What should the sentence say, so it is true in both modes? | "`lets sync` rewrites this section, the skills in `.agents/skills/` and the schemas in `openspec/schemas/` on every run, so an edit there is lost. Change lets-spec instead." It names no mode, links or git. | Evidence: README, *Committed or ignored skills* |
| D2 | Rename `lets-sync` to `lets sync` in the BEGIN lines of the rules and skills markers? | Yes. The markers match on the prefix `BEGIN lets-spec rules` and `BEGIN lets-spec skills`, so blocks older releases wrote still match, read as `stale`, and are rewritten once with the usual "updated ... Commit it" message. A unit test already covers an older wording. | Evidence: `lets/src/sync/block.ts` (`beginPattern`, `blockState`); `tests/lets/sync/block.test.ts` |
| D3 | The README says the marker keeps the old name on purpose. What happens to that paragraph? | It goes. The *Committed or ignored skills* example shows the new marker, and the *From 0.1* section loses the sentence that says the marker still says `lets-sync`. | Evidence: README lines 600–609, 687–704 |
| D4 | Does the legacy links marker in `.git/info/exclude` change? | No. Older releases wrote it; 0.4.0 only reads it to remove old links. Its text is theirs. | Evidence: `lets/src/sync/block.ts` (`LEGACY_LINKS`) |
| D5 | What is the acceptance? | A fresh `lets sync` writes a rules block and a skills block whose text has no "links" and no `lets-sync`. A project with the 0.4.0 blocks gets them rewritten once, and the next run is current. Every test passes with the markers it pins updated. | Assumption |

## Changes from the story

None. Issue #20's point about the marker's double-take is met by D2 as a side effect, and that issue stays open for the migration guide.

Confirmed by user: yes
