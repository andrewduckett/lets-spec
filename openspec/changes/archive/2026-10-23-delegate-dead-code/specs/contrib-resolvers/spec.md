## MODIFIED Requirements

### Requirement: The T3 resolver lists the models in its manifest
Inside T3 Code, `lets-delegate-t3` SHALL list its `options` from T3's model manifest: for each provider in the manifest's order, `<family>/<model>` for each model T3 lists, with the provider's default chat model first. It SHALL list each `gemini` model once, with its effort suffix removed. When T3 has no model manifest, it SHALL list no `options`, and SHALL name the manifest path on stderr.

#### Scenario: Reading the manifest
- **WHEN** the manifest lists `codex` with `gpt-6-luna`, then `claudeAgent` with `claude-opus-5-5` and `claude-fable-5-1` and a default of `claude-fable-5-1`, then `antigravity` with `gemini-3.8-flash-high` and `gemini-3.8-flash-low`
- **THEN** `lets-delegate-t3 probe` prints `{"resolver":"t3","options":["gpt/gpt-6-luna","claude/claude-fable-5-1","claude/claude-opus-5-5","gemini/gemini-3.8-flash"]}`

#### Scenario: No manifest
- **WHEN** `lets-delegate-t3 probe` runs inside T3 Code, and T3's `model-manifest.json` does not exist
- **THEN** it exits 0, prints `{"resolver":"t3","options":[]}`, and stderr contains the path of `model-manifest.json`
