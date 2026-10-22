## Story

#49 resolver-chain-config — the config lists resolvers in order, lets asks them in turn and stops, and the PATH fallback and in-process default go. https://github.com/andrewduckett/lets-spec/issues/49

## Decisions

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | What went wrong on the user's machine? | The resolver picked `gpt-6-astra`, the first gpt entry in T3's catalog, because nothing told it otherwise; the account cannot run it, and the review failed while other models were there. Two faults: a model chosen from stored or guessed knowledge, and a first refusal ending the call. | User |
| D2 | Does the config keep a stored list of reviewers and models? | No. Nothing about models is stored. A resolver reports what its harness can run at the moment of the call. | User |
| D3 | Is anything kept compatible with the version 1 config? | No. There are no users yet, so the old file is refused and nothing migrates. | User |
| D4 | How is a family and model written? | One string, `family[/model]`, at every boundary: config, flags, requests, answers, log lines. Each program splits it in one place. `sourceFamily` stays a bare family. | User |
| D5 | Who chooses the model? | The calling skill. It asks `lets` what can run and for the user's guidance, picks, and passes the pick to `lets delegate`. The resolver runs what it is given or exits 3 with the reason, and the skill tries its next option. | User |
| D6 | Does `lets` or the kit hold an order of its own? | No. Options are in the harness's own order. The user's guidance and the skill's judgment order them. | User |
| D7 | What does the user config hold for the skill? | One block per delegation, `review-plan`, `review-code`, `handoff`, each with prose `guidance`, so other keys can be added beside it later. | User |
| D8 | What file is the config? | `~/.config/lets-delegate/config.yaml`, under `XDG_CONFIG_HOME` when set, with `version: 2` and `resolvers`, a list of absolute paths in order. YAML because prose is written by hand. A leftover `config.json` is refused with a message that names the new file. | User |
| D9 | With no config, what runs? | The release's own `contrib/lets-delegate-subagent`, and nothing else. | User |
| D10 | What happens when every resolver in the chain declines? | `lets delegate` exits 2 and says no resolver answered here and which file names the chain. | Evidence: epic #46 shared decisions, with the setup wording dropped by D13 |
| D11 | How does the skill ask what can run and for its guidance? | One command, `lets delegate instructions --for <delegation>`, prints `resolver`, `options` and `guidance` as one JSON object, the way `openspec instructions` does. `resolver` `subagent` with empty `options` is the cue to run a subagent. | User |
| D12 | How does the skill pass its pick? | `--model <family[/model]>`, required on `review` and `handoff`. | User |
| D13 | What happens to `lets delegate setup`? | Removed in this story: the command, the `delegate-setup` spec and its README section, with a paragraph on writing the config by hand in their place. Setup is reshaped in its own brainstorm, and #44 and #50 with it. | User |
| D14 | What is a refusal? | A session that fails before any output: no harness configured, no tokens, no such model. The resolver exits 3 with the reason. A session that produced output and then failed stops the call, as today. | User |
| D15 | What happens to a T3 thread that was refused? | The resolver archives it at once and puts the reason on stderr. | User |
| D16 | What about herdr? | It goes, as a harness. Its resolver becomes `lets-delegate-cli`: one resolver for every family CLI on PATH, answering in any terminal, declining `start`. One resolver per harness, as ADR-003 says; a terminal is one harness with three CLIs in it. | User |
| D17 | What does `lets` do in `lets/src/delegate/lookup.ts`? | Asks `LETS_SPEC_RESOLVER` when set, then the config's `resolvers` in order, and stops at the first that does not decline. The `lets-delegate-resolver` PATH lookup and the built-in special case for the default go. A listed resolver that is missing or not executable is a usage error that names it. | Evidence: issue #49 scope |
| D18 | How does the chain name the default? | With the word `subagent` in `resolvers`, which means the running `lets`'s own copy, run with its own Node. By path would not work: the copy sits at a Nix store path that moves with every update, and keeps a `#!/usr/bin/env node` line that needs a Node on `PATH`. Added after review round 1. | Assumption |

## Changes from the story

- **Cut: the setup changes.** The story had setup's `--resolver` become `--resolvers` and its proposal list resolvers. Setup is removed instead (D13), because it would write a file this story refuses, and it is being redesigned.
- **Changed: the config file.** The story said version 2 of `config.json`. It is `config.yaml` (D8), so the prose guidance that story C adds can be written by hand.
- **Split out as a chore: herdr becomes `lets-delegate-cli`** (D16). Rename the package and binary, drop the harness check, decline `start`, update its README, the Nix outputs and the release.
- **Split out as story B: resolvers report options and run the model they are given.** `probe` answers with the options the harness can run now; `run` and `start` take a model and run exactly that; the kit's picking code and the `reviewers` field go; a refusal is exit 3 with the reason (D14), and a refused T3 thread is archived (D15). The `cli` resolver lists models from `codex debug models` and `agy models`. The conformance check and the contract doc follow. An ADR supersedes ADR-002.
- **Split out as story C: the skill chooses.** `lets delegate instructions --for` (D11), the `delegations` blocks in the config (D7), `--model` on `review` and `handoff` (D12), the review's stderr line, and the `lets-review-code`, `lets-review-plan` and `lets-build` skills changed to ask, choose, call. The `delegate-config` spec and the README follow.
- **Follow-up for `lets-shape`, not filed here:** reshape setup, #44 and #50 once stories B and C exist, and update epic #46's scope, which lists the protocol as out and herdr as in.

Confirmed by user: yes
