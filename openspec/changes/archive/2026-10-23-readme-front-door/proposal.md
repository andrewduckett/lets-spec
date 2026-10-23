## Why

The README is both the front door and the reference manual. It is 856 lines long. A new user meets internal parts, design notes and terms used before they are defined, and never sees what success looks like. The reference pages it pointed to have now moved into `docs/` (D1), so the README can be cut down to what a new user needs.

## What Changes

- The README is restructured to the outline in #70 D1 and cut to about 400 lines (D2, D3). Where it repeats a skill, `--help` or a `docs/` page, it keeps one sentence and a link (D4).
- A new **Quick start** shows the steps, the line `lets sync` prints when it works, and the commit command (D5).
- "Set it up" loses the "Choose a flow and a skills mode" step (D6) and merges the first run and the commit into one step.
- "Specs in a monorepo" becomes a three-sentence note. The rest moves to a new `docs/monorepo.md`. Its sentences for agents move to `skills/lets-write-specs/SKILL.md` where that skill does not already say them (D7).
- "Shared domain language" becomes a 12-line "Your project's vocabulary" (D8).
- "Fresh sessions" becomes "Reviews in a fresh session". It opens with short definitions, drops "strategy" and "intent" (D9), and replaces the rungs with a First choice / Fallback table (D10).
- Every H2 has an emoji and opens with one sentence naming its reader. A six-line contents list sits at the top.
- The vocabulary is the same across files: "chain", "fresh session", "the default resolver", "T3 Code". `herdr` leaves the cli README. The t3 README uses the cli README's wording for a declined handoff (D13).
- `tests/skill-interfaces.bats` changes only where the new prose breaks it (D12).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. No requirement changes (D14), so the change sets `skip_specs`.

## Impact

- `README.md`: rewritten.
- `docs/monorepo.md`: new.
- `skills/lets-write-specs/SKILL.md`: a few sentences for agents, at most.
- `contrib/t3-resolver/README.md`, `contrib/cli-resolver/README.md`: wording only.
- `tests/skill-interfaces.bats`: only if the new prose breaks it.
- No code, command, config or release behavior changes.
