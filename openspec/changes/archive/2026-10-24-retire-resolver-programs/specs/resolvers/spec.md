## REMOVED Requirements

### Requirement: The release folder ships each resolver
**Reason**: The resolver programs, their packaging, their protocol and the `sh` example are gone. `lets` runs `t3`, `cli` and `subagent` in process, as `delegate-resolvers` and `delegate-default` specify, and checks `--model` itself before it asks any resolver.
**Migration**: List resolvers by name in the delegate config, as the 0.6 upgrade note says. Delete any link to a program from the `resolvers/` folder of an older release.

### Requirement: The flake packages each resolver
**Reason**: The resolver programs, their packaging, their protocol and the `sh` example are gone. `lets` runs `t3`, `cli` and `subagent` in process, as `delegate-resolvers` and `delegate-default` specify, and checks `--model` itself before it asks any resolver.
**Migration**: List resolvers by name in the delegate config, as the 0.6 upgrade note says. Delete any link to a program from the `resolvers/` folder of an older release.

### Requirement: Each resolver passes the verify check
**Reason**: The resolver programs, their packaging, their protocol and the `sh` example are gone. `lets` runs `t3`, `cli` and `subagent` in process, as `delegate-resolvers` and `delegate-default` specify, and checks `--model` itself before it asks any resolver.
**Migration**: List resolvers by name in the delegate config, as the 0.6 upgrade note says. Delete any link to a program from the `resolvers/` folder of an older release.

### Requirement: The T3 and cli resolvers refuse to finish a handle they never make
**Reason**: The resolver programs, their packaging, their protocol and the `sh` example are gone. `lets` runs `t3`, `cli` and `subagent` in process, as `delegate-resolvers` and `delegate-default` specify, and checks `--model` itself before it asks any resolver.
**Migration**: List resolvers by name in the delegate config, as the 0.6 upgrade note says. Delete any link to a program from the `resolvers/` folder of an older release.

### Requirement: A run or start needs a model
**Reason**: The resolver programs, their packaging, their protocol and the `sh` example are gone. `lets` runs `t3`, `cli` and `subagent` in process, as `delegate-resolvers` and `delegate-default` specify, and checks `--model` itself before it asks any resolver.
**Migration**: List resolvers by name in the delegate config, as the 0.6 upgrade note says. Delete any link to a program from the `resolvers/` folder of an older release.

### Requirement: A probe's verb is run or start
**Reason**: The resolver programs, their packaging, their protocol and the `sh` example are gone. `lets` runs `t3`, `cli` and `subagent` in process, as `delegate-resolvers` and `delegate-default` specify, and checks `--model` itself before it asks any resolver.
**Migration**: List resolvers by name in the delegate config, as the 0.6 upgrade note says. Delete any link to a program from the `resolvers/` folder of an older release.

### Requirement: The sh example declines a probe for start
**Reason**: The resolver programs, their packaging, their protocol and the `sh` example are gone. `lets` runs `t3`, `cli` and `subagent` in process, as `delegate-resolvers` and `delegate-default` specify, and checks `--model` itself before it asks any resolver.
**Migration**: List resolvers by name in the delegate config, as the 0.6 upgrade note says. Delete any link to a program from the `resolvers/` folder of an older release.
