**Why:** The critical review in #70 found doc and ADR claims that no longer match the code, and install snippets that name the repository's old owner. A reader who trusts them copies a redirecting URL or acts on a wrong exit code, so they need fixing before the README restructure builds on them.

## Story

#75 docs-accuracy — every doc claim about a command, path, version or decision matches the code. https://github.com/sidereal-io/lets-spec/issues/75

## Decisions

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | Which old-owner references change? | `README.md:91,688`, `contrib/t3-resolver/README.md:51,61`, `contrib/cli-resolver/README.md:100,110` and `mise.toml:11` become `sidereal-io/lets-spec`. `README.md:142` stays for #25. Archived changes keep the old URLs as history. | Evidence: `grep -rn andrewduckett`, #75 |
| D2 | How does an ADR show that a later decision changed part of it? | No new convention. Each record's top note says plainly what no longer holds and what holds now, and its `status` agrees with that note. ADR-001, 002 and 003 are made correct this way. | User |
| D3 | ADR-002 says `status: accepted` but opens with "Superseded in part". How does it become consistent? | Its first decision still holds, so it stays `accepted`. The note is reworded plainly to say the second decision, `reviewers` in the request, was replaced by ADR-006. | Assumption, from D2 |
| D4 | No ADR covers `lets-delegate-cli`. How does ADR-003 say it answers outside a harness? | A note only, with no new ADR. `lets-delegate-cli` opens no harness window, so it answers wherever `codex`, `claude` or `agy` is on `PATH`. | User |
| D5 | Where does ADR-005's Context split? | Into two paragraphs, at "One constraint shapes how the default is named". No words change. | Evidence: #70 D9 |
| D6 | What does the README say about `config.yaml`'s schema? | That it must name your flow's schema, which `lets sync` checks against the release's default. | Evidence: `lets/src/sync/config.ts:28-37` |
| D7 | What does `AGENTS.md:21` say `pnpm test` runs? | The Node tests, the type check, `pnpm verify` on every shipped resolver, and the bats tests. | Evidence: `package.json:10` |
| D8 | What timeouts does the contract give? | `run` gets `timeoutMinutes` plus one minute. The other verbs get five minutes. `lets delegate verify`'s shape checks get 60 seconds each. | Evidence: `lets/src/delegate/verify.ts:14` |
| D9 | What does `VERIFY_HELP` say about the live `start`? | It runs on the first model `probe` lists, or on `claude` when the probe lists none. | Evidence: `lets/src/delegate/verify.ts:21,113` |
| D10 | How do the contract's exit 5 and 6 rows read? | "Exits 5" and "Exits 6" apply to `review run`. `handoff run` exits 4 for both. | Evidence: `lets/src/delegate/handoff.ts:26-31` |
| D11 | Which row joins the README's `lets sync` exit table? | Outside a git repository, `lets sync` writes nothing, says so, and exits 0. | Evidence: `lets/src/sync/main.ts:52-56` |
| D12 | What does the contract say about a failed `finish`? | `lets` reports it on stderr, and the review's result and exit code stay the same. | Evidence: `lets/src/delegate/review.ts:83-89` |
| D13 | What does the README say about `contrib/headless-resolver`'s size? | Nothing. "About twenty lines" goes, because the count drifts with every edit. | User |
| D14 | Does the change need a spec delta? | No. No requirement changes, and no spec or test pins the edited text. The change sets `skip_specs: true`. | Evidence: `grep` of `openspec/specs/` and `tests/` |

## Changes from the story

- Cut: D10's row about the t3 token path in `contrib/t3-resolver/README.md`. #90 already documents `XDG_CONFIG_HOME` and `T3CODE_HOME` there.
- Changed: the issue asks for "one convention for partial supersession". The user chose to correct each ADR's note and status instead, with no convention written down (D2).

Confirmed by user: yes
