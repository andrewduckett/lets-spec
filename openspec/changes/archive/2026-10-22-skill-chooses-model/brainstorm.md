## Story

#59 skill-chooses-model — the skill asks lets what can run and for the user's guidance, picks a model, and passes it to lets delegate.
https://github.com/sidereal-io/lets-spec/issues/59

## Decisions

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | Do the skills work with the `lets` on `main` today? | No. #58 made `--model` required, and `lets-review-code`, `lets-review-plan` and the `lets-build` handoff still call `lets delegate` without it, so each exits 2. | Evidence: `lets/src/cli.ts` (`modelOption`), the three `SKILL.md` files |
| D2 | Does the review's stderr JSON line still need `model` and `independent`? | No, it already reports both. That scope item is done. | Evidence: `lets/src/delegate/review.ts` |
| D3 | How does the query handle a resolver that answers `probe` but declines `start`, as `lets-delegate-cli` does? | The probe request names the protocol verb it is for: `run` for a review, `start` for a handoff. A resolver declines a probe for a verb it would decline, so the query reports the resolver that will really answer. | User |
| D4 | Is the probe's new field required? | No. It is optional, and the protocol stays at 2. `lets` always sends it. A resolver that ignores it still keeps the contract. Only the kit and `lets-delegate-cli` change. | User |
| D5 | How does a review skill rank the options? | The user's guidance first. Where it says nothing, a family other than the author's, then the resolver's order. The author's family comes last, and gives `independent: false`. | User |
| D6 | What does a review do when every model is refused, or there are none? | It takes the existing subagent step. When the resolver is `subagent` with no options, it skips the review command and runs the subagent at once. | User |
| D7 | What does a handoff do when every model is refused? | It shows the user the stderr, and stops. | User |
| D8 | Which option does a handoff pick? | The guidance first. Where it says nothing, the resolver's order. Independence does not apply. | User |
| D9 | What `--model` does a handoff pass when there are no options? | The agent's own family, as a bare family, so `subagent` still hands back the prompt. | User |
| D10 | Are plan reviews and code reviews told apart? | Yes. They get separate guidance, which will differ. | User |
| D11 | What are the parts of a delegation? | Three: the command (`instructions`, `run`, `verify`), the strategy (`review`: read-only, waits for the answer; `handoff`: interactive, returns at once), and the intent (`plan`, `code`, `apply`). The strategy fixes the options, the output, the exit codes and the protocol verb (`review` sends `run`, `handoff` sends `start`). The intent picks the guidance. | User |
| D12 | What shape do the commands take? | Strategy first: `lets delegate review instructions\|run` and `lets delegate handoff instructions\|run`, beside `lets delegate verify`. The action is `run`. `lets delegate review` and `lets delegate handoff` are no longer actions. | User |
| D13 | How is the intent given? | `--for <intent>` on every `instructions` and `run`, and it is always required, even for `handoff`, whose only intent is `apply`. `review` takes `plan` or `code`. Any other value exits 2. | User |
| D14 | What does `instructions` print? | One JSON line on stdout: the strategy, the intent, the resolver that will answer, its options and the guidance. | User |
| D15 | Where does the guidance live, and what is it called? | `delegations.<intent>.guidance` in the delegate config, as a string, for the intents `plan`, `code` and `apply`. It is called `guidance`, because `instructions` already names the command and the handoff response's field. | User |
| D16 | Does the config version change? | No, it stays at 2. A missing entry gives `guidance: null`. `instructions` exits 2, naming the file, when the guidance is not a string. It ignores other names under `delegations`, and `run` ignores the key. | User |
| D17 | Who tries the next model after a refusal? | `lets`. `run` takes `--model` more than once, as a ranked list, and tries each in turn on exit 3. The stderr line names the model that ran. Exit 3 means every model was refused. | User |
| D18 | Which resolvers does `instructions` ask, and how does it fail? | The same lookup as `run`: `LETS_SPEC_RESOLVER`, then the chain, with the same exit 2 for a missing listed resolver or a chain where every resolver declines. | Assumption |
| D19 | Does the retry move to another resolver? | No. Every model goes to the resolver that answered. A refusal is not a decline, so no later resolver in the chain is asked. | Assumption |
| D20 | Does the skill ask the user, as it runs, which model to use? | No. The guidance is the config's prose. The skill reads it and chooses without asking. | Assumption |

## Changes from the story

- **Cut:** the review's stderr JSON line reporting `model` and `independent`. It already does (D2).
- **Changed:** the command shape. The story had `lets delegate instructions --for <review-plan|review-code|handoff>` beside `review` and `handoff`. It is now `lets delegate review|handoff instructions|run --for <intent>`, with the intents `plan`, `code` and `apply` (D11–D14). The guidance keys follow (D15).
- **Added:** the probe request names the verb it is for, and `lets-delegate-cli` declines a probe for `start` (D3, D4). This touches the resolver kit, `lets-delegate-cli`, `docs/resolver-contract.md` and the `contrib-resolvers` spec.
- **Moved:** the retry on a refusal, from the skills into `lets` (D17).
- **Added:** the README's warning about #58 goes, since #58 has landed.

Confirmed by user: yes
