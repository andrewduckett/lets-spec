## Why

A stored model name is what fails today. The config pinned `gpt-6-astra`, T3 listed it, the account could not run it, and the review exited while other models were available. The resolver is the only part that can see what its harness runs now. So it should report that, run exactly the model it is given, and say clearly when the harness refuses. Then the review skill can choose a model and try the next one (#59).

## What Changes

- `probe` answers `{ resolver, options }`. `options` is a list of `family[/model]` strings, in the harness's order:
  - The T3 resolver reads `model-manifest.json` and puts each provider's default first (D11).
  - The cli resolver runs `codex debug models`, keeping only listed models (D7), and `agy models`, keeping only `gemini-*` ids (D4). It lists claude as the bare family `claude` (D13). It leaves out a family whose listing fails (D12).
  - Each Gemini model appears once, without its effort suffix (D6).
  - The subagent resolver answers an empty list.
- **BREAKING** `run` and `start` take a required `model` string, `family[/model]`, and run exactly that model. A request without it exits 2 (D1). `run` adds the effort to a Gemini model. A model the resolver never listed is still tried (D8). The T3 `start` uses the model instead of the project default (D14).
- **BREAKING** The `reviewers` request field goes, and the kit's `pickFamily` and `pickReviewer` go with it. No resolver chooses a model any more.
- **BREAKING** A refusal is exit 3, with the reason on stderr. A refusal is any no from the harness or the account before the model gives output: the harness is not running or not set up, there are no tokens, or there is no such model. Exit 4 is left for resolver bugs, contract errors and unknown outcomes (D9). The T3 resolver archives a refused thread (D10).
- `lets delegate verify` checks the new `probe` answer, and its live run sends a `model`.
- `docs/resolver-contract.md` and the `headless-resolver` sh example follow the new contract. The protocol number stays 1 (D3).
- A new decision record supersedes ADR-002's second decision.
- `lets delegate review` still sends no `model`, so a review on `main` fails until #59 adds `--model`. No release is cut in between (D2).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `contrib-resolvers`: `probe` reports options. `run` and `start` run the model they are given. A refusal is exit 3, and the T3 resolver archives a refused thread. The cli resolver's listing rules apply.
- `delegate-config`: the requirements on how a resolver walks `reviewers` are removed, because the field goes.
- `delegate-default`: `lets-delegate-subagent` answers `probe` with an empty `options` list.
- `delegate-verify`: the check requires `options` in the `probe` answer, and sends `model` in its live run.

## Impact

- **The kit:** `contrib/resolver-kit/src/protocol.ts`, `families.ts`, `resolver.ts` and `adapter.ts`.
- **The resolvers:** `contrib/t3-resolver/src/t3.ts`, `contrib/cli-resolver/src/cli.ts`, `contrib/subagent-resolver/src/subagent.ts` and `contrib/headless-resolver`.
- **`lets`:** `lets/src/delegate/protocol.ts`, which the kit copies, and `verify.ts`.
- **Tests:** `tests/resolver-kit`, `tests/t3-resolver`, `tests/cli-resolver`, `tests/subagent-resolver`, and `tests/lets/delegate/protocol.test.ts` and `verify.test.ts`.
- **Docs:** `docs/resolver-contract.md`, and a new ADR that supersedes `docs/decisions/ADR-002-lets-owns-the-delegate-config.md`.
- **Dependencies:** none. The cli resolver now calls `codex debug models` and `agy models` at `probe` time.
- **Follow-up:** #61 removes the agy filter once agy lists only Gemini models.
