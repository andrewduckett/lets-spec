# Discovery: Let's Spec

> The living map behind the backlog: who the product serves and the journeys it supports.
> Stories are GitHub issues; each discovery run's scope and decisions live in its parent issue.

## Personas

### People who use Let's Spec

#### Mo — maintainer of a project that uses Let's Spec

- **Who**: a developer who plans with AI coding agents across several repositories
- **Goal**: the same planning rules in every repository, followed by the agents
- **Pain today**: each project keeps its own copy of the rules and the copies drift apart; agents jump to code before anyone has planned
- **Success looks like**: a change goes from idea to merged pull request with a plan and a second opinion, in every repository, without hand-fixing the tooling first

### People who build Let's Spec

#### Andrew — maintainer of Let's Spec

- **Who**: the person who writes the skills and the `lets` command, and releases them
- **Goal**: see the workflow fail on their own repository before a user does
- **Pain today**: a workflow tool is hard to test without running it for real on a project
- **Success looks like**: this repository plans every change with Let's Spec, and each release carries the fixes that found

> **Implication**: Andrew walks Mo's journey on this repository after every release. A stage that is partial for Mo is partial for Andrew too, so the maintainer feels each gap first.

## Journey Map

Stage status checked against the code on 2026-10-23.

### People who use Let's Spec

**Plan and build with agents** (Mo):

```
  Set it up ──► Set up the backlog ──► Shape ──► Build ──► Review ──► Merge ──► Update
      │               │                 │          │          │          │         │
   partial         partial          supported  supported   partial   supported  partial
```

1. **Set it up** — install with Nix or mise, run `lets sync`, describe the project — partial: setup is several documented steps run by hand, and asks nothing in a terminal ([#65](https://github.com/sidereal-io/lets-spec/issues/65)); the flow and skills mode live in `mise.toml`, not the project's config ([#23](https://github.com/sidereal-io/lets-spec/issues/23)); the mise example pins a release that has no `lets` command, names the repository's old owner and does not say when to pin ([#25](https://github.com/sidereal-io/lets-spec/issues/25)); the README is a front door and a reference manual in one file, with its terms used before they are defined ([#77](https://github.com/sidereal-io/lets-spec/issues/77), [#82](https://github.com/sidereal-io/lets-spec/issues/82)); the rules block every project receives carries spec vocabulary and a field that does not exist ([#76](https://github.com/sidereal-io/lets-spec/issues/76))
2. **Set up the backlog** — `lets-setup-backlog` creates the Project and its fields — partial: views, options and workflows are not converged ([#29](https://github.com/sidereal-io/lets-spec/issues/29)); the skill becomes part of one guided setup ([#65](https://github.com/sidereal-io/lets-spec/issues/65))
3. **Shape** — `lets-shape` turns an idea or a bug into issues with packets — supported
4. **Build** — `lets-build` claims an issue, plans it, and builds the plan in a fresh session — supported
5. **Review** — plan and code reviews run in a fresh session, from another family — partial: the kit cannot find a parent process on macOS, so the T3 resolver declines there ([#72](https://github.com/sidereal-io/lets-spec/issues/72)); the example resolver answers a probe for a verb it declines, and `verify` cannot see it ([#73](https://github.com/sidereal-io/lets-spec/issues/73))
6. **Merge** — the user merges the pull request; archive is the last commit — supported
7. **Update** — move the pin, sync, commit — partial: `lets --version` says 0.0.0-dev under Nix ([#19](https://github.com/sidereal-io/lets-spec/issues/19)); the label-backlog migration is undocumented ([#20](https://github.com/sidereal-io/lets-spec/issues/20)); the OpenSpec CLI warning does not name the line to set ([#26](https://github.com/sidereal-io/lets-spec/issues/26))

### People who build Let's Spec

**Release and dogfood** (Andrew):

```
  Change ──► Release ──► Bump the pin here ──► Walk Mo's journey
     │          │               │                     │
 supported  supported        partial               partial
```

1. **Change** — one issue, one branch, one pull request, planned with Let's Spec — supported
2. **Release** — push a tag; the workflow builds and publishes the tarball — supported
3. **Bump the pin here** — a pull request moves `mise.toml` to the release and commits what `lets sync` wrote — partial: done by hand after each release
4. **Walk Mo's journey** — every change on this repository goes through the skills — partial: see Mo's journey above

## Backlog

Stories are GitHub issues: <https://github.com/sidereal-io/lets-spec/issues>.
