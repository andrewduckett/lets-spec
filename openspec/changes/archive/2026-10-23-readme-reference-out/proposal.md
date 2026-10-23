## Why

The README is both the front door and the reference manual. Between the
setup steps and the maintainer notes sit a 119-line `lets sync`
reference, a 40-line description of how `lets` picks a resolver, and
four upgrade notes. A reader looking for how to start has to scroll past
all of it. This story moves that text out first, so the next story can
rewrite what stays.

## What Changes

- New page `docs/lets-sync.md`: what `lets sync` owns, the skills modes,
  `--check`, its environment and exit codes (D1).
- New page `docs/upgrading.md`: the four upgrade notes, newest release
  first (D4).
- `docs/resolver-contract.md` gains the few facts from the README's
  "Resolvers" subsection that it does not already hold (D3).
- `docs/resolver-contract.md` loses its copy of
  `contrib/headless-resolver`. It keeps the link (D5).
- The README keeps its `lets sync` and Updating headings. Each moved
  section becomes one sentence and a link (D2). Links that pointed at the
  moved sections point at the new pages (D6).
- Tests: the test that pins the script copy goes (D5). The test that
  checks how the docs name `lets delegate` commands reads every page in
  `docs/` (D7).

No behavior changes. Every fact keeps one home (D8).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This change touches only documentation and its tests, so it sets
`skip_specs`.

## Impact

- `README.md`, `docs/resolver-contract.md`, and two new pages under
  `docs/`.
- `tests/skill-interfaces.bats`.
- No code, command, or release content changes.
