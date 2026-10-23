## Context

- `README.md` is 856 lines. #77 already moved the `lets sync` reference, the upgrade notes and the resolver mechanics into `docs/`, so most of what is left is the front door plus repeats of the skills.
- `docs/domain-language.md` is already written for the user (#76). `docs/lets-sync.md`, `docs/upgrading.md` and `docs/resolver-contract.md` exist, and the README links to them.
- The first `lets sync` prints `lets-spec: wrote <n> files. Commit them.` (`lets/src/sync/skills.ts:100`). A run with nothing to do prints nothing.
- `tests/skill-interfaces.bats` reads the README in two tests. One says every `lets delegate review` or `handoff` is followed by `instructions` or `run`. The other says the README holds `delegations.<intent>.guidance` and `--for`.
- `skills/lets-write-specs/SKILL.md` "Choose the capability paths" already tells agents to use full IDs, list and show specs first, write deltas only for changed shared specs, and keep flat paths flat. `skills/lets-brainstorm/SKILL.md:55` already says domain names do not map to source folders.
- The skill text ships to every project at the next release. The README and `docs/` do not.

## Goals / Non-Goals

**Goals:**

- A new user reaches a committed setup, and knows the next skill to run, from Quick start and "Set it up" alone.
- Each H2 opens with one sentence naming its reader, and has an emoji.
- Each fact lives in one place. The README links to the skill, `--help` or `docs/` page that holds the detail.

**Non-Goals:**

- No change to any command, config key, schema or release behavior.
- No new `docs/` page other than `docs/monorepo.md`.
- No change to the mise pin form (#25), the rules block (#76), or the moved reference pages (#77), apart from fixing a link.
- No walkthroughs. #64 and #65 own them.

## Test Seams

- **Primary test seam:** `pnpm test`, which runs `tests/skill-interfaces.bats` over the README, `docs/` and the contrib READMEs.
- **Existing seams reused:** `tests/skill-interfaces.bats`. No new test. The task that finishes the README also runs one-off checks: `wc -l README.md`, every relative link in the changed files resolves, every H2 has an emoji, and no `herdr`, `rung`, `strategy` or `intent` is left in the README's prose.

## Scrutiny Tier & Blast Radius

- **Tier:** low
- **Blast radius:** `README.md`, the two contrib READMEs and a new `docs/monorepo.md`. One sentence at most in `skills/lets-write-specs/SKILL.md`, which reaches projects at the next release.

## Decisions

### The outline and its line budget

The README follows the #70 D1 outline. Each section has a budget, so the total lands near 400 lines.

| Section | What it holds | Lines |
|---|---|---|
| Title, 🧐 What is this thing? | The two skills, `lets-setup-backlog`, `lets sync`, "not part of OpenSpec", a six-line contents list | 25 |
| ✨ Why | The five aims, each in short sentences | 15 |
| 🚀 Quick start | Four numbered steps: add it (links to Nix or mise), enter the shell and see the success line, commit, run `lets-setup-backlog` then `lets-shape` or `lets-build` | 25 |
| 📦 Set it up | Requirements (Version column filled or dropped), With Nix, With mise, First run and commit, Monorepos note | 85 |
| ⚙️ Usage | The backlog, `lets-setup-backlog`, `lets-shape`, `lets-build`, The Project fields, The flows, Your project's vocabulary | 135 |
| 🧵 Reviews in a fresh session | Definitions, What a review gets, Set up delegation, Install a resolver, Write your own | 75 |
| 📜 The working rules | The marker, the short list, the link to `overlays/AGENTS.md`, one link to `docs/lets-sync.md` | 25 |
| 🔄 Updating | With Nix, With mise, the link to `docs/upgrading.md` | 25 |
| 🛠️ Development | Layout absorbing "What's inside", Releases, Testing, After a T3 Code update | 70 |
| 📄 License | | 3 |
| **Total** | | **about 480 at most; aim for 420** |

The "⚙️ `lets sync`" H2 goes. Its one paragraph becomes one sentence in "The working rules". "⚙️" moves to Usage.

### What each section cuts

Rule (D4): where the README repeats a skill, `--help` or a `docs/` page, keep one sentence and a link.

- **What's inside:** removed. The skills and `lets sync` go in "What is this thing?". The parts go in Development > Layout. The paragraph on committed copies goes in "First run and commit".
- **Requirements:** the "The flake supplies it. With mise, you pin it." cells go. The Nix and mise sections say it once each. The resolver row says "not independent" once.
- **With Nix / With mise:** each snippet says `standard` and `committed` are the defaults, and links "The flows" and `docs/lets-sync.md#committed-or-ignored-skills` (D6). The mise `auto_update` paragraph and the OpenSpec version paragraph shrink to one sentence each.
- **First run and commit:** merges steps 3 and 4. It names the success line, lists what `lets sync` wrote in one short list, and gives one `git add … && git commit` command. The `ignored` mode gets one sentence.
- **Monorepos:** the three-sentence note from #70 finding 3, linking `docs/monorepo.md`.
- **The backlog:** the mermaid chart goes; the "You want to | Run" table says the same thing. "Packet" is defined once here: "An issue's packet is its body, filled in from its Kind's template. `lets-shape` writes it; `lets-build` checks it."
- **`lets-build`:** keep the four-row branch table. "Finding the issue", "Confirming the packet" and "Routing" shrink to one short paragraph. The routing table goes: "Chores and most XS or S stories use `lets-minimal`; the skill says the exact rule."
- **The Project fields:** keep the fields table. The status table becomes three sentences. Keep the blocker warning.
- **The flows:** keep the comparison table and the `standard` steps table. The `minimal` steps table goes, because the comparison table already lists its three planning steps. Keep "Turning the code review off", shorter.
- **Your project's vocabulary:** the 12-line draft from #70 finding 2, linking `docs/domain-language.md` (D8).
- **Reviews in a fresh session:** opens with one sentence naming its reader, then a definition list: resolver, harness, family, chain, review, handoff, decline and refuse. "Strategy" and "intent" go; one sentence says what `review` and `handoff` do and what `--for` names (D9). The two command tables become that sentence plus `lets delegate review run --help`. The rungs become the First choice / Fallback table (D10). "Set up delegation" keeps the config example, the order rule, the absolute-path rule and `delegations.<intent>.guidance`; the rest links to `docs/resolver-contract.md`. "Resolvers" folds into the definitions. "Install a resolver" keeps the two-row table and one paragraph. "Write your own" keeps four lines, the contract link and the verify command.
- **Updating:** keep. The `--override-input` tip moves to Development, because only someone working on Let's Spec uses it.
- **Development:** Layout keeps its table and gains the rows for the flow skills, the generated OpenSpec skills and the release tarball. "Generated OpenSpec skills" becomes one Layout row. The Testing list after `nix flake check` shrinks to one sentence; the `pnpm` table stays.

### Vocabulary

- "Chain" names the ordered list of resolvers in the config. The README introduces it once, in the definitions.
- "Fresh session" is what the user gets. "Delegate" appears only as the command and the config file.
- "Default" always has a noun: the default branch, flow, skills mode or resolver. The resolver is "the default resolver, `lets-delegate-subagent`" the first time, and "the default resolver" after.
- "T3 Code" in prose; `t3` only as a command.
- These are README definitions, not glossary entries (D11).

### `docs/monorepo.md`

About 40 lines, for the person setting up a monorepo: the layout, what a domain and a capability path are, how to tell agents which code each group describes in `context`, and that one change can update several domains. It drops the remark about strict validation and the term "sync/archive".

### `skills/lets-write-specs/SKILL.md`

Every agent-facing sentence in the old monorepo section is already in "Choose the capability paths", except one: domain names do not map to source folders, so use the project context, the request and the code. Add that sentence to the section's last paragraph. Nothing else in the skill changes.

### Contrib READMEs

- `contrib/cli-resolver/README.md`: "in herdr" goes from line 6.
- `contrib/t3-resolver/README.md`: the "Anything else" row says "the next resolver in your config answers", as the cli README does (D13). Line 96's paragraph changes only if it then contradicts the row.

## Risks / Trade-offs

- [A link to a removed README anchor breaks, in `docs/`, a contrib README or a skill] → The finishing task greps the whole tree for `README.md#` and checks each anchor still exists.
- [Cutting the routing table hides why a small story skipped the plan review] → The one sentence names `lets-minimal` and points to the `lets-build` skill, which holds the rule.
- [A cut line was the only place a fact lived] → Before deleting a paragraph, the task checks the fact is in the skill, `--help` or `docs/` page the README now links. If it is not, it stays.
- [The README lands well above 400 lines] → The budget table caps it at 480. Over that, the task cuts again before it commits.

## Migration & Rollback

N/A. Documentation only. Revert the commits to undo.
