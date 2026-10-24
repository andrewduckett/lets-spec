## REMOVED Requirements

### Requirement: One resolver runs every family CLI on PATH
**Reason**: `lets` runs this resolver in process, so the rule is stated through the `lets delegate` commands, not a program's exit code and stdout.
**Migration**: Moved to `delegate-resolvers` under the same name, restated through a `lets delegate` command with the resolver's name in the config.

### Requirement: The cli resolver declines when no family CLI is on PATH
**Reason**: `lets` runs this resolver in process, so the rule is stated through the `lets delegate` commands, not a program's exit code and stdout.
**Migration**: Moved to `delegate-resolvers` under the same name, restated through a `lets delegate` command with the resolver's name in the config.

### Requirement: The cli resolver runs a review headless
**Reason**: `lets` runs this resolver in process, so the rule is stated through the `lets delegate` commands, not a program's exit code and stdout.
**Migration**: Moved to `delegate-resolvers` under the same name, restated through a `lets delegate` command with the resolver's name in the config.

### Requirement: The cli resolver declines every handoff
**Reason**: `lets` runs this resolver in process, so the rule is stated through the `lets delegate` commands, not a program's exit code and stdout.
**Migration**: Moved to `delegate-resolvers` under the same name, restated through a `lets delegate` command with the resolver's name in the config.

### Requirement: The cli resolver cleans up after a review
**Reason**: `lets` runs this resolver in process, so the rule is stated through the `lets delegate` commands, not a program's exit code and stdout.
**Migration**: Moved to `delegate-resolvers` under the same name, restated through a `lets delegate` command with the resolver's name in the config.

### Requirement: T3 Code has its own resolver
**Reason**: `lets` runs this resolver in process, so the rule is stated through the `lets delegate` commands, not a program's exit code and stdout.
**Migration**: Moved to `delegate-resolvers` under the same name, restated through a `lets delegate` command with the resolver's name in the config.

### Requirement: The T3 resolver opens a session in a T3 thread
**Reason**: `lets` runs this resolver in process, so the rule is stated through the `lets delegate` commands, not a program's exit code and stdout.
**Migration**: Moved to `delegate-resolvers` under the same name, restated through a `lets delegate` command with the resolver's name in the config.

### Requirement: The T3 resolver declines outside T3 Code
**Reason**: `lets` runs this resolver in process, so the rule is stated through the `lets delegate` commands, not a program's exit code and stdout.
**Migration**: Moved to `delegate-resolvers` under the same name, restated through a `lets delegate` command with the resolver's name in the config.

### Requirement: The cli resolver lists the models each CLI reports
**Reason**: `lets` runs this resolver in process, so the rule is stated through the `lets delegate` commands, not a program's exit code and stdout.
**Migration**: Moved to `delegate-resolvers` under the same name, restated through a `lets delegate` command with the resolver's name in the config.

### Requirement: The cli resolver lists the bare family when a listing fails
**Reason**: `lets` runs this resolver in process, so the rule is stated through the `lets delegate` commands, not a program's exit code and stdout.
**Migration**: Moved to `delegate-resolvers` under the same name, restated through a `lets delegate` command with the resolver's name in the config.

### Requirement: The T3 resolver lists the models in its manifest
**Reason**: `lets` runs this resolver in process, so the rule is stated through the `lets delegate` commands, not a program's exit code and stdout.
**Migration**: Moved to `delegate-resolvers` under the same name, restated through a `lets delegate` command with the resolver's name in the config.

### Requirement: A resolver runs a model it never listed
**Reason**: `lets` runs this resolver in process, so the rule is stated through the `lets delegate` commands, not a program's exit code and stdout.
**Migration**: Moved to `delegate-resolvers` under the same name, restated through a `lets delegate` command with the resolver's name in the config.

### Requirement: A refusal exits 3
**Reason**: `lets` runs this resolver in process, so the rule is stated through the `lets delegate` commands, not a program's exit code and stdout.
**Migration**: Moved to `delegate-resolvers` under the same name, restated through a `lets delegate` command with the resolver's name in the config.

### Requirement: The T3 resolver archives a refused thread
**Reason**: `lets` runs this resolver in process, so the rule is stated through the `lets delegate` commands, not a program's exit code and stdout.
**Migration**: Moved to `delegate-resolvers` under the same name, restated through a `lets delegate` command with the resolver's name in the config.

### Requirement: The cli resolver declines a probe for start
**Reason**: `lets` runs this resolver in process, so the rule is stated through the `lets delegate` commands, not a program's exit code and stdout.
**Migration**: Merged into *The cli resolver declines every handoff* in `delegate-resolvers`. At the command level both say that a handoff, and the instructions for one, skip `cli` and run nothing. Its probe-for-a-review scenario is *One resolver runs every family CLI on PATH*.

### Requirement: The T3 resolver keeps its token beside the lets config
**Reason**: `lets` runs this resolver in process, so the rule is stated through the `lets delegate` commands, not a program's exit code and stdout.
**Migration**: Moved to `delegate-resolvers` under the same name, restated through a `lets delegate` command with the resolver's name in the config.
