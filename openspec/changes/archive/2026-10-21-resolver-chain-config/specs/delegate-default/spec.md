## ADDED Requirements

### Requirement: The default answers when nothing else does
When no config file exists, `lets delegate` SHALL ask the default, its own `contrib/lets-delegate-subagent` beside the running `lets`, after the resolver `LETS_SPEC_RESOLVER` names, if any. When a config file exists, `lets delegate` SHALL ask the default only where the chain holds the entry `subagent`, in that position, and only when every resolver before it declines. On both paths `lets` SHALL run the default with its own Node.

#### Scenario: No config
- **WHEN** `LETS_SPEC_RESOLVER` is unset, no config file exists, and the user runs `lets delegate handoff`
- **THEN** `lets delegate handoff` prints a JSON line with `"resolver":"subagent"`

#### Scenario: A listed resolver answers before the default
- **WHEN** the config lists a resolver that answers a review with a final message, then `subagent`
- **THEN** `lets delegate review` prints that message and exits 0, and the default is not asked

#### Scenario: A listed resolver declines and the default is next
- **WHEN** the config lists a resolver that declines, then `subagent`
- **THEN** `lets delegate handoff` prints a JSON line with `"resolver":"subagent"`

#### Scenario: The chain leaves the default out
- **WHEN** the config lists one resolver that declines, and no `subagent` entry
- **THEN** `lets delegate handoff` exits 2, and the default is not asked

#### Scenario: The default runs with lets's own Node
- **WHEN** the config lists `subagent`, and no `node` is on `PATH`
- **THEN** `lets delegate handoff` prints a JSON line with `"resolver":"subagent"`

## MODIFIED Requirements

### Requirement: A missing or broken default fails the request
When the lookup reaches the default, through no config or through the `subagent` entry, and the running `lets`'s own `lets-delegate-subagent` is missing or fails with any exit other than 0 or 3, `lets delegate` SHALL exit 4 and print nothing on stdout. Stderr SHALL name the file `lets` tried to run and say that the `lets` install is incomplete. An absolute path the config lists is never the default: when it is missing, "A missing configured resolver stops the command" applies.

#### Scenario: The file is gone
- **WHEN** the release folder's `contrib/lets-delegate-subagent` is deleted, nothing else is installed or configured, and the user runs `lets delegate review`
- **THEN** the command exits 4, stdout is empty, and stderr contains the path of `contrib/lets-delegate-subagent` and the word `incomplete`

#### Scenario: A handoff with the file gone
- **WHEN** the release folder's `contrib/lets-delegate-subagent` is deleted, nothing else is installed or configured, and the user runs `lets delegate handoff`
- **THEN** the command exits 4, stdout is empty, and no file is written under `.workspace/lets-delegate/`

#### Scenario: The file is broken
- **WHEN** the release folder's `contrib/lets-delegate-subagent` holds text that Node cannot run, nothing else is installed or configured, and the user runs `lets delegate review`
- **THEN** the command exits 4, stdout is empty, and stderr contains the path of `contrib/lets-delegate-subagent` and the word `incomplete`

#### Scenario: The file is gone and the chain lists subagent
- **WHEN** the release folder's `contrib/lets-delegate-subagent` is deleted, and the config lists only `subagent`
- **THEN** `lets delegate review` exits 4, and stderr contains that path and the word `incomplete`

#### Scenario: A listed copy of the program is gone
- **WHEN** the config lists `/opt/r/lets-delegate-subagent` by absolute path, and that file does not exist
- **THEN** `lets delegate review` exits 2, and stderr names that path and the config file

## REMOVED Requirements

### Requirement: The default answers last
**Reason**: The default is no longer appended to every lookup. "The default answers when nothing else does" says when it is asked: with no config, or where the chain lists `subagent`.
**Migration**: Add `subagent` to `resolvers` in `config.yaml`, last, to keep the fallback to a subagent review.
