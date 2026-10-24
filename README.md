# 📐 Let's Spec

## 🧐 What is this thing?

This section is for anyone wondering what Let's Spec does.

Let's Spec (`lets-spec`) is a planning workflow for AI coding agents, built
on [OpenSpec](https://github.com/Fission-AI/OpenSpec). It gives each of
your projects the same agent skills, OpenSpec schema and working rules.
You talk to it through two skills:

- **`lets-shape`** shapes a big idea, or one bug, chore or story, into
  issues on the repository's GitHub Project.
- **`lets-build`** takes the next one from that backlog and moves it
  through planning, building, review and archive.

A third skill, **`lets-setup-backlog`**, creates that Project once per
repository. The `lets sync` command copies the skills, schemas and rules
into your project, and keeps them up to date. You install it with a Nix
flake, or with [mise](https://mise.jdx.dev) from a release on GitHub. It
is a personal, unofficial project, and not part of OpenSpec.

- [🚀 Quick start](#-quick-start): from nothing to a committed setup
- [📦 Set it up](#-set-it-up): the requirements, and the details for Nix or mise
- [⚙️ Usage](#️-usage): the backlog, the three skills and the flows
- [🧵 Reviews in a fresh session](#-reviews-in-a-fresh-session): reviews by another model family
- [📜 The working rules](#-the-working-rules) and [🔄 Updating](#-updating)
- [🛠️ Development](#️-development): working on Let's Spec itself

## ✨ Why

This section is for you if you are deciding whether it fits your projects.

Agents write better code when they plan first, but each project's copy of
the planning rules drifts. Let's Spec keeps one copy for all. It aims to:

- **Plan before code.** Every change starts with a brainstorm with you.
- **Keep work small.** One story is one change, branch and pull request.
- **Get a second opinion.** In `standard`, another family reviews the work.
- **Share one backlog.** Sessions claim a story, so none builds it twice.
- **Update every project at once.** One pin moves skills, schema and rules.

## 🚀 Quick start

This section is for you if you want a project set up, fast.

1. Add Let's Spec to your project, [with Nix](#with-nix) or
   [with mise](#with-mise).
2. Enter the dev shell, or `cd` into the project with mise, and `lets sync`
   runs. The last line its first run prints is
   `lets-spec: wrote <n> files. Commit them.` If a list of problems to fix
   follows it, fix those first.
3. Commit what it wrote. From a clean working tree:
   `git add -A && git commit -m "chore: set up Let's Spec"`.
4. In your agent, run the `lets-setup-backlog` skill once. Then run
   `lets-shape` to fill the backlog, and `lets-build` to build the first
   story.

## 📦 Set it up

This section is for you if you want the details behind the Quick start.

### Requirements

| Tool | Version | Why |
|---|---|---|
| Nix with flakes, or mise | any | Installs the tools below, and runs `lets sync`. |
| GitHub repository | — | The backlog is a GitHub Project linked to it. |
| GitHub CLI (`gh`) | 2.102.0 or later | The skills set Project fields by name, and create sub-issues and "blocked by" links. |
| OpenSpec CLI | The version the release was generated from | The `openspec-*` skills are generated from it. |
| Node | 26 or later | `lets` runs on it. |
| T3 Code, or `codex`, `claude` or `agy`, optional | any | Lets the resolvers built into `lets` run reviews in a [fresh session](#-reviews-in-a-fresh-session). Without one that reaches another model family, the reviews are not independent. |

The flake supplies `gh`, the OpenSpec CLI and Node. With mise, you pin them.

### With Nix

Add the flake input, following `main`; your `flake.lock` pins the commit:

```nix
inputs.lets-spec.url = "github:sidereal-io/lets-spec";
```

With [flake-parts](https://flake.parts), import the module and use it:

```nix
imports = [ inputs.lets-spec.flakeModules.default ];
perSystem = { config, pkgs, ... }: {
  letsSpec = {
    flow = "standard";      # the default
    skills = "committed";   # the default, or "ignored"
  };
  devShells.default = pkgs.mkShell {
    packages = config.letsSpec.packages;
    shellHook = config.letsSpec.shellHook;
  };
};
```

Without flake-parts, add the package named for the flow, such as
`lets-spec.packages.${system}.standard`, run `lets sync` in `shellHook`
outside CI, and set `LETS_SPEC_SKILLS` for the skills mode. `standard` and
`committed` are the defaults; [The flows](#the-flows) and
[Committed or ignored skills](docs/lets-sync.md#committed-or-ignored-skills)
explain the others.

### With mise

Add this to your project's `mise.toml`, then run `mise lock` and commit
`mise.lock`, so every clone and CI get the same release:

```toml
[tools]
node = "26"
gh = "2.102"
"npm:@fission-ai/openspec" = "1.13.2"   # the version in the release notes
"github:sidereal-io/lets-spec" = "latest"

[env]
LETS_SPEC_FLOW = "standard"         # the default
# LETS_SPEC_SKILLS = "ignored"      # the default is committed

[hooks]
enter = "lets sync"
```

`standard` and `committed` are the defaults, as with Nix. `latest` stays
on one release until `mise upgrade`; `auto_update` never moves it. Pin the
OpenSpec CLI to the version the release notes name, or `lets sync` warns
you. The `enter` hook needs `mise activate`; without it, run
`mise exec -- lets sync`.

### First run and commit

The first `lets sync` adds the working rules to `AGENTS.md`, creates
`openspec/config.yaml` for your flow, links `CLAUDE.md` and
`.claude/skills` so Claude Code reads the same files as other agents, and
copies the skills into `.agents/skills/` and the schemas into
`openspec/schemas/`.

Add your own instructions to `AGENTS.md`, outside the markers: what the
project is, its layout and how to run its checks. Then commit, as
[Quick start](#-quick-start) shows, so every clone has the skills, even
without Nix or mise. With the `ignored` skills mode, `lets sync` adds a
block to `.gitignore` instead: commit that, not the copies. After the
first run, `lets sync` prints nothing when all is well.

### Monorepos

Keep one set of skills and one `openspec/` directory at the repository
root. Group the specs by application, service or feature, and say in
`openspec/config.yaml` which code each group describes.
[Specs in a monorepo](docs/monorepo.md) shows the layout.

## ⚙️ Usage

This section is for you once it is set up, and you want to know what to run.

### The backlog

The backlog is the GitHub Project linked to your repository. Every piece
of work is an issue on it, with its Kind, Priority, Size and Status as
Project fields. An issue's **packet** is its body, filled in from its
Kind's template: `lets-shape` writes it, and `lets-build` checks it.

| You want to | Run |
|---|---|
| Split or prioritize a large idea | `lets-shape` |
| File a bug, a chore or a single story, or finish an issue that has no packet | `lets-shape` |
| Start the next story, or carry on the change on your current branch | `lets-build` |
| Set up or check this repository's backlog | `lets-setup-backlog` |

### `lets-setup-backlog`: create or check the Project

Run it once in a new repository. It creates and links a Project with
[the fields below](#the-project-fields), or checks the one that is linked
and offers to fix each gap. If `gh` asks for the `project` scope, run
`gh auth refresh -s project`.

### `lets-shape`: turn an idea into stories

`lets-shape` turns a product requirements document (PRD), a vision, an
issue or a conversation into a release plan, and never writes code. It
works in phases: scope, personas, journey map, MoSCoW priorities, then
thin stories filed as sub-issues with "blocked by" links. It asks you to
confirm each phase and saves it, so you can stop and resume. Bring it one
bug, chore or small story, and it shapes just that issue.

### `lets-build`: build one issue

`lets-build` looks at your current branch to decide what to do:

| You are on | It does |
|---|---|
| The default branch, such as `main` | Finds the next issue, or the one you name, and checks its packet. Assigns it to you, sets it In Progress, creates a branch and an OpenSpec change named after it, and plans it. It stops when the plan is ready. |
| A change's branch, plan unfinished | Carries on planning. |
| A change's branch, plan finished | Builds the tasks. In `standard`, it then has the code reviewed. It verifies and archives the change, and marks the pull request ready for review. |
| A branch whose change is archived | Tells you the pull request is ready for review. |

The next issue is the unassigned, unblocked Todo with the highest
priority. Chores and most XS or S stories use the `lets-minimal` schema;
[the skill](skills/lets-build/SKILL.md#route) says the exact rule. You
merge the pull request: agents never merge unless you ask.

### The Project fields

A Project is a backlog when it has these fields. Extra fields and options
are fine; the skills ignore them.

| Field | Type | Options the skills use |
|---|---|---|
| Kind | single select | Epic, Story. Add Bug and Chore to shape bugs and chores. |
| Priority | single select | Must, Should, Could, Wont |
| Size | single select | XS, S, M, L, XL |
| Status | single select | Todo, In Progress, Done. These are a new Project's defaults. |

Option names must match exactly, including case. `lets-shape` sets a new
issue to Todo. `lets-build` sets it In Progress when it claims it. The
Project's default workflows set it Done when the pull request merges.

> [!IMPORTANT]
> Put each blocker on the story it blocks, not on the epic. GitHub search
> cannot see a blocker on a parent issue, so `lets-build` would pick a
> story that is not ready.

### The flows

A flow is an OpenSpec schema and the skills it calls. Each project uses
one, and also gets `lets-minimal` for chores and small stories.

| | `standard` | `minimal` |
|---|---|---|
| Use it for | Normal feature work | Small changes |
| Planning steps | brainstorm → proposal → specs → design → ADR → review → tasks | brainstorm → specs → tasks |
| Independent plan review | Yes | No |
| Building | One commit per task, test-first | One commit per task, test-first |
| Independent code review | Yes, a rule in `openspec/config.yaml` ([how](#turning-the-code-review-off)) | No |
| Skills it adds | `lets-brainstorm`, `lets-write-specs`, `lets-write-adrs`, `lets-write-tasks`, `lets-test-first`, `lets-review-plan`, `lets-review-code` | `lets-brainstorm`, `lets-write-specs`, `lets-write-tasks`, `lets-test-first` |

The `standard` flow, step by step:

| # | Step | What the agent does | Output |
|---|---|---|---|
| 1. | brainstorm | Questions you one at a time about scope, behavior and acceptance, and records each answer and its source | `brainstorm.md` |
| 2. | proposal | States why the change is needed and what it changes | `proposal.md` |
| 3. | specs | Writes the requirements, each with testable scenarios | `specs/**/spec.md` |
| 4. | design | Explains how to build it, when the change needs that | `design.md` |
| 5. | ADR | Writes an architecture decision record (ADR) in `docs/decisions/`, only for a choice that is costly to reverse | `adr.md`, plus any new ADRs |
| 6. | review | A fresh session reviews the whole plan with `lets-review-plan` | `review.md` |
| 7. | tasks | Breaks the work into a checklist | `tasks.md` |
| 8. | apply | Builds each task test-first. One commit per task. | Commits |
| 9. | code review | A fresh session reviews the branch with `lets-review-code` | A **Code review** section in the pull request |
| 10. | verify, archive | Checks the code matches the plan, then archives the change | An archive commit |

A `minimal` change has no `proposal.md`, so `openspec show` fails on it.
Nothing in the workflow calls `show`.

#### Turning the code review off

The code review is the `operations.archive` entry in your project's
`openspec/config.yaml`, which `lets sync` writes once and never changes.
Delete the entry to stop code reviews, or edit it to change when they run.

### Your project's vocabulary

A glossary keeps words meaning the same thing in plans, specs and code.
The shared one is `openspec/glossary.md`, unless `context` names another:

```yaml
context: |
  Shared glossary: docs/requirements/00-glossary.md
  This replaces the default openspec/glossary.md.
```

Agents ask you what a new term means, and write it down once you agree;
`lets sync` never touches a glossary.
[Domain language in a project](docs/domain-language.md) says more.

## 🧵 Reviews in a fresh session

This section is for you if you want reviews by another model family.

Reviews, and builds that `lets-build` hands off, can run in a fresh
session that shares no context with the author. These words come up:

- **Resolver:** the part of `lets` that turns a request into a real
  session in one harness. `lets` has three: `t3`, `cli` and `subagent`.
- **Harness:** the agent app you work in, such as Claude Code or T3 Code.
- **Family:** the models from one maker: `gpt`, `claude` or `gemini`.
- **Chain:** the resolvers your config lists, which `lets` asks in order.
- **Review:** a read-only session. `lets` waits for its final message.
- **Handoff:** an interactive session that builds a planned change.
- **Decline:** a resolver cannot work here, so the next one is asked.
- **Refuse:** a resolver will not run the model it was given, so `lets`
  sends it the next model.

Skills call `lets delegate review run` and `lets delegate handoff run`, where
`--for` names what the session is for. Each first asks the matching
`instructions` command which models it can use, and passes them to `run`
best first. `lets delegate review run --help` lists the options.

### What a review gets

A review gets the best of these that your machine offers:

| | What runs | Fresh context | Independent | Needs |
|---|---|---|---|---|
| First choice | A session a resolver in your chain starts | yes | when the skill picks another family | a resolver your [config](#set-up-delegation) lists |
| Fallback | A read-only subagent in your current harness | yes | no | nothing |

The skill falls back when the resolver lists no models, or refuses them
all. `review.md` records which ran, such as `fresh context, other family`.

### Set up delegation

With no config, only the default resolver, `subagent`, answers. For fresh
sessions, write `~/.config/lets/config.yaml` (or
`$XDG_CONFIG_HOME/lets/config.yaml`) by hand, once on each machine:

```yaml
version: 3
delegate:
  resolvers:
    - t3
    - cli
    - subagent
  review:
    plan:
      guidance: Prefer the strongest gpt model. Never use gemini.
    code:
      guidance: Prefer a gpt model.
  handoff:
    apply:
      guidance: Prefer claude. Use a small model for a chore.
```

`delegate.resolvers` is the chain. List the resolvers for your harnesses
first, then `cli`, then `subagent`, the default resolver; without it, a
review every resolver declines fails. Each entry is `t3`, `cli` or
`subagent`; any other entry, such as a path from an older `lets`, makes
`lets delegate` exit 2. With no `delegate.resolvers`, only `subagent`
answers.

`review` and `handoff` are optional. `delegate.<strategy>.<intent>.guidance`
is your advice, in plain words, on which models to use. Its parts are the
command that reads it and a value `--for` takes: `review.plan`,
`review.code` or `handoff.apply`. The skill uses it only to rank and leave
out models. A value that is not a string makes `instructions` exit 2.

Other keys are ignored, so a later `lets` can add settings beside
`delegate`.

### The resolvers

The resolvers are part of `lets`, so there is nothing to install. List
the ones you want by name:

| Name | It answers | It needs | A review runs as | A handoff |
|---|---|---|---|---|
| [`t3`](docs/resolvers.md#t3) | Inside T3 Code | T3 Code running | A new thread, archived when the review succeeds | Starts a new thread in the sidebar |
| [`cli`](docs/resolvers.md#cli) | In any terminal | `codex`, `claude` or `agy` on your `PATH` | A child process of that CLI, in its read-only mode | Declines, so the next resolver answers |
| [`subagent`](docs/resolvers.md#subagent) | Anywhere | nothing | Nothing: the skill runs the review in a subagent | Gives back the prompt to start any agent with |

Each declines where it cannot work, so the first that fits where you are
answers.

## 📜 The working rules

This section is for you if you want to know the rules your agents follow.

`lets sync` keeps the shared rules in `AGENTS.md`, between two
`lets-spec rules` marker comments. Every agent reads them. In short:

- Plan product changes with OpenSpec.
- One change is one branch and one pull request, stacked on any it needs.
- Make one commit per unit of work, with Conventional Commits.
- Run the project's checks before you push.
- Only `lets-shape` and `lets-build` set Project fields.
- You own the merge.
- Change requests on a ready pull request reopen its archived change.
- Never edit what Let's Spec puts in the project.

The full text is in [`overlays/AGENTS.md`](overlays/AGENTS.md). Never edit
it in a project: `lets sync` rewrites it. What else `lets sync` owns, and
what `--check` checks, is in [`docs/lets-sync.md`](docs/lets-sync.md).

## 🔄 Updating

This section is for you if your project wants a newer Let's Spec.

Commit what `lets sync` writes in the same pull request as the new pin.
Moving up from an older release? Read [`docs/upgrading.md`](docs/upgrading.md)
first: some releases need a step of your own.

### With Nix

Run `nix flake update lets-spec`, enter the dev shell, and commit what
`lets sync` wrote. Dependabot's `nix` entry opens a pull request when
`main` moves, but it changes only `flake.lock`, so `lets sync --check`
fails in CI until someone enters the dev shell on its branch and commits.

### With mise

1. Run `mise upgrade`.
2. Set the OpenSpec CLI in `mise.toml` to the version named in the new
   release's notes, and run `mise install`.
3. Run `lets sync`.
4. Commit `mise.toml` and `mise.lock` with what `lets sync` wrote.

## 🛠️ Development

This section is for you if you want to work on Let's Spec itself.

Enter the dev shell with `nix develop`, or run `mise install`. Both give
you Node 26, pnpm, bats, `jq`, `yq` and the OpenSpec CLI. Then run
`pnpm install` once.

### Layout

| Path | What it holds |
|---|---|
| `flake.nix` | Reads `flows.json`, calls `build/`, and defines the packages and checks |
| `flows.json` | Each flow's recipe: its schemas from `schemas/` and the skills they call, plus the entry points. The first schema is the flow's default and names it. The build fails if a recipe names a missing schema or skill, or lists one twice. |
| `nix/flake-module.nix` | The flake module that projects import. It puts the OpenSpec CLI, `lets` and `gh` in the dev shell, and runs `lets sync` when the shell starts. |
| `build/` | The release builder, the OpenSpec skill generator and the list of OpenSpec workflows |
| `openspec-*` skills | Not committed. The flake generates them from the OpenSpec CLI in its nixpkgs, for the workflows in `build/openspec.json`, so moving nixpkgs can change their text. Each release records the CLI version in its `release.json`. |
| `lets/` | The `lets` command, in TypeScript. `src/sync/` is `lets sync`, and `src/delegate/` is `lets delegate`. `src/resolvers/t3/`, `cli/` and `subagent/` are the three resolvers, each an adapter that `lets delegate` calls in process. `src/resolvers/kit/` is the code they share with `lets delegate`: the adapter type, the model families, the errors and exit codes. `build.mjs` bundles `lets` into one file with esbuild. |
| `docs/` | The pages the README links to, and the decision records in `docs/decisions/` |
| `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `mise.toml` | The pnpm workspace, its scripts, the type check's settings, and the tools for working without Nix |
| `skills/` | The authored skills, one `lets-*` folder each: the entry points, and the flow skills the schemas call |
| `schemas/` | The OpenSpec schemas, each with its templates |
| `overlays/` | The rules fragment and the files `lets sync` creates in a project. Each flow has its own `openspec/config.yaml`, in `openspec/config.d/<schema>.yaml` |
| `tests/` | `*.bats`: end-to-end tests of `lets sync`, the release build, each schema, and every command, file and skill the prose names. The folders: unit tests for `lets` and each resolver, run with fakes. |
| `.github/workflows/` | `ci.yml` runs `nix flake check` and a mise smoke test; `release.yml` publishes a release when a `v*` tag is pushed |

### Releases

`nix build .#dist` builds the release folder: the `lets` bundle in `bin/`,
one file with no `node_modules`, and a release for every flow. Bump
`version` in `lets/package.json` in the commit you tag. Pushing a
`v<major>.<minor>.<patch>` tag publishes `lets-spec-<version>.tar.gz`, with
the OpenSpec CLI version in its notes. Then bump this repository's own
mise pin, and commit what `lets sync` wrote.

### Testing

`nix flake check` runs the tests, builds every flow and the release, and
sets up sample projects. In the dev shell:

| Command | What it runs |
|---|---|
| `pnpm test` | The Node tests, the type check and the bats tests |
| `pnpm check` | The type check alone: `tsc --noEmit` |
| `pnpm build` | The `lets` bundle, into `lets/dist/lets` |
| `bats tests` | The bats tests alone |

Node runs the TypeScript source directly, so you do not need to build
before you test. With mise, `mise run test` runs `pnpm test`.

To try an unmerged change in a project, override the input for one shell:
`nix develop --override-input lets-spec path:/path/to/your/clone`.

### After a T3 Code update

The `t3` resolver depends on T3 Code's internals. After each T3 Code
update, run the smoke test in
[After a t3 update](docs/resolvers.md#after-a-t3-update).

## 📄 License

If you want to reuse this code, it is under the [GNU GPL v3.0](LICENSE).
