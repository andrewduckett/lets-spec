**Why:** This repository still runs Let's Spec v0.4.0, so none of the fixes the dogfood loop found under #38 reach its own workflow until the pin moves to v0.5.0, which was published today.

## Story

#41 bump-pin-after-release — this repository runs the release that carries the fixes under #38, https://github.com/sidereal-io/lets-spec/issues/41

## Decisions

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | Which release does the pin move to? | 0.5.0: tag v0.5.0 is pushed and the release workflow published `lets-spec-0.5.0.tar.gz`. | Evidence: `gh release view v0.5.0` |
| D2 | What does the change edit by hand? | Only the `github:andrewduckett/lets-spec` line in `mise.toml`. The OpenSpec CLI pin stays at 1.13.2, which the release notes name. | Evidence: `mise.toml`, release notes of v0.5.0 |
| D3 | What does `lets sync` write that gets committed? | The rules block in `AGENTS.md` and the skills block in `.gitignore`. Both markers change from `lets-sync rewrites` to `lets sync rewrites`, and the rules gain a Domain language section and reworded never-edit rule. `openspec/config.yaml` is only checked, not rewritten. | Evidence: `lets/src/sync/block.ts`, `overlays/AGENTS.md`, `lets/src/sync/config.ts` |
| D4 | What does `lets sync` write that stays out of git? | The skill and schema copies under `.agents/skills/` and `openspec/schemas/`, in ignored mode. `lets-review-code` and `lets-review-plan` are new in 0.5.0, and the `CLAUDE.md` and `.claude/skills` links already exist. | Evidence: `mise.toml` sets `LETS_SPEC_SKILLS = "ignored"`, `.gitignore` |
| D5 | Does the issue wait on #35, which its body names? | No. #35 does not exist on GitHub, and the epic's open blockers are all closed. | Evidence: `gh issue view 35` fails; `gh issue view 41 --json blockedBy` |
| D6 | How is the change accepted? | In the repo, `lets --version` prints 0.5.0, `lets sync --check` exits 0, and `pnpm test` and `nix flake check` pass. | Assumption |
| D7 | Is the user's own delegate config part of this chore? | No. `lets delegate setup` writes a user-level file, not the repository. | Evidence: #38 Shared decisions |

## Changes from the story

None.

Confirmed by user: yes
