## ADDED Requirements

### Requirement: A request from lets carries the model the user gave
`lets delegate review` and `lets delegate handoff` SHALL require `--model <family[/model]>`, and SHALL send its value unchanged as the `model` of the `run` or `start` request. Without `--model`, they SHALL exit 2 and ask no resolver. The `run` request SHALL have no `reviewers` field, whatever the config holds.

#### Scenario: A review with a model
- **WHEN** the user runs `lets delegate review --model gpt/gpt-6-luna` with the other required options
- **THEN** the `run` request the resolver receives has `"model":"gpt/gpt-6-luna"` and no `reviewers` field

#### Scenario: A handoff with a bare family
- **WHEN** the user runs `lets delegate handoff --name build-x --prompt-file p.md --model claude`
- **THEN** the `start` request the resolver receives has `"model":"claude"`

#### Scenario: No model
- **WHEN** the user runs `lets delegate review` without `--model`
- **THEN** it exits 2, stderr names `--model`, and no resolver is run

### Requirement: A refusal stops the review with exit 3
When the resolver that answers a review or a handoff exits 3, `lets delegate review` and `lets delegate handoff` SHALL exit 3 and show the resolver's stderr. They SHALL NOT ask a later resolver in the chain.

#### Scenario: The model is refused
- **WHEN** the resolver that answers `lets delegate review --model gpt/gpt-6-astra` exits 3 with `codex refused gpt-6-astra` on stderr
- **THEN** `lets delegate review` exits 3, and its stderr contains `codex refused gpt-6-astra`

## REMOVED Requirements

### Requirement: A request from lets carries no reviewers
**Reason**: Replaced by "A request from lets carries the model the user gave". The request now names one model, and still carries no `reviewers`.
**Migration**: Pass `--model` to `lets delegate review`.

### Requirement: The resolver takes the first reviewer from another family
**Reason**: The `reviewers` field is gone. A resolver runs the one `model` it is given, and the caller chooses it.
**Migration**: Choose the model from the resolver's `probe` options, and pass it with `--model`.

### Requirement: The resolver runs the reviewer's model
**Reason**: The `reviewers` field is gone. "The cli resolver runs a review headless" and "The T3 resolver opens a session in a T3 thread" in `contrib-resolvers` now say how a resolver runs the model it is given, including the effort suffix for `gemini`.
**Migration**: Pass the model with `--model`.

### Requirement: No usable reviewer exits 3
**Reason**: The `reviewers` field is gone. "A refusal exits 3" in `contrib-resolvers` covers a model the harness cannot run.
**Migration**: On exit 3, choose another option and run the review again.

### Requirement: No list keeps the resolver's own choice
**Reason**: No resolver chooses a model any more. A request without `model` exits 2.
**Migration**: Pass `--model` to `lets delegate review` and `lets delegate handoff`.
