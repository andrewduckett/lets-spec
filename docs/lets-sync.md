# `lets sync`

`lets sync` copies the skills, the schemas and the working rules from the
release you installed into your project, and keeps them up to date. This
page is its reference.

| Command | What it does |
|---|---|
| `lets sync` | Sets the project up and keeps it set up. The dev shell or the mise hook runs it. |
| `lets sync --check` | Changes nothing. Exits 1 if the project is out of date. Run it in CI. |
| `lets sync --help` | Prints what it does. |
| `lets --version` | Prints the release's version. |

Each time `lets sync` runs, it:

- adds or rewrites the rules block in `AGENTS.md`, and tells you to commit
  the change
- creates any missing file the project owns, and never edits one that
  exists
- copies each skill and each schema from the release, rewrites any file
  that differs, and tells you to commit what it wrote
- removes any skill or schema the release no longer ships
- keeps the `.gitignore` block in the `ignored` mode, and removes it in
  the `committed` mode
- removes the links that older versions made, even under the skills' old
  names, and the section that listed them in git's local exclude file. So
  git sees the copies, and no old skill is left beside a new one
- warns about anything to fix: the wrong `schema:`, a marker without its
  pair, a `CLAUDE.md` or `.claude/skills` that is not the expected link,
  or an OpenSpec CLI on `PATH` that differs from the one the release's
  `openspec-*` skills were generated from

A copy is mode 0755 when the release's file is executable, and 0644
otherwise. So the skills' scripts stay executable.

It exits 0 even when it warns, so a problem never stops the shell from
starting. It changes nothing when it exits with any other code.

| Exit | When |
|---|---|
| 0 | The run finished, with or without warnings. Or it found the release but ran outside a git repository, so it wrote nothing and said so. |
| 1 | It cannot find the release, or the folder it finds is not a valid release. Or no release ships for the `LETS_SPEC_FLOW` you set, or `LETS_SPEC_SKILLS` is not `committed`, `ignored` or empty. With `--check`, also when the project is out of date. |
| 2 | You gave it an unknown option. |

## What `lets sync` owns

`lets sync` owns every path that matches one of these patterns:

- `.agents/skills/lets-*`
- `.agents/skills/openspec-*`
- `openspec/schemas/lets-*`

It writes, rewrites and removes those paths, so it undoes any edit you
make there. Change Let's Spec instead. It never touches anything else in
those folders, so your own skills under other names are safe.

## Committed or ignored skills

The skills mode decides whether git tracks the copied skills and schemas.
`lets sync` writes the same files in both modes. The rules block,
`openspec/config.yaml`, `CLAUDE.md` and `.claude/skills` are committed in
both modes.

| Mode | What `lets sync` does | Who it suits |
|---|---|---|
| `committed` (default) | Writes the copies, and asks you to commit them. Removes its block from `.gitignore`, if one is there. | Every project. Every clone has the skills. |
| `ignored` | Writes the same copies, says that git ignores them, and keeps a block in `.gitignore` that ignores them. | A project that wants no skill text in its history, and whose every user installs Let's Spec with Nix or mise. |

You set the mode with `letsSpec.skills` in the Nix module, or with the
`LETS_SPEC_SKILLS` environment variable.

In the `ignored` mode, `lets sync` keeps this block in `.gitignore`. You
own the rest of the file.

```gitignore
# BEGIN lets-spec skills. lets sync rewrites this block: change lets-spec, not this text.
/.agents/skills/lets-*
/.agents/skills/openspec-*
/openspec/schemas/lets-*
# END lets-spec skills
```

When you switch modes, the next run tells you what to do:

| From | To | `lets sync` says |
|---|---|---|
| `ignored` | `committed` | `lets-spec: removed the lets-spec skills block from .gitignore. Run: git add .agents/skills openspec/schemas, then commit.` |
| `committed` | `ignored` | `lets-spec: added the lets-spec skills block to .gitignore. Commit it.` Then, under `problem(s) to fix`: `git still tracks lets-spec copies that .gitignore ignores. Run: git rm -r --cached --ignore-unmatch -- '.agents/skills/lets-*' '.agents/skills/openspec-*' 'openspec/schemas/lets-*', then commit.` |

Git ignores only files it does not track yet. So after a switch to
`ignored`, run the `git rm -r --cached` command it gives, then commit. The
command keeps the copies on disk, and works in bash and zsh even when one
of its patterns matches nothing. Until you run it, every `lets sync` run
lists the problem again. The run still exits 0, and `lets sync --check`
does not fail on it. A project that never tracked the copies sees no
such problem.

## What `--check` checks

`lets sync --check` changes nothing. It prints each problem it finds, and
exits 1 if it finds any.

| Mode | It fails when |
|---|---|
| Both | The rules block in `AGENTS.md` is missing, out of date, or has a marker without its pair. |
| `committed` | A copied file differs from the release in its bytes or its execute bit, is missing, or is one the release does not ship. Or `.gitignore` still has the skills block. |
| `ignored` | `.gitignore` has no skills block, or its block is out of date. A CI clone has no copies, so it does not check them. |

Run it in your project's CI. With Nix, run `nix develop -c lets sync --check`.
With mise, run `mise exec -- lets sync --check`.

The module's shell hook does not run `lets sync` when the `CI` environment
variable is set. CI services such as GitHub Actions set it. So in CI,
`lets sync --check` checks the tree you committed, not one the hook has
just synced.

## Environment

| Variable | Default | What it does |
|---|---|---|
| `LETS_SPEC_SKILLS` | `committed` | The skills mode: `committed` or `ignored`. Unset or empty means `committed`. Any other value is an error. The Nix module sets it. |
| `LETS_SPEC_FLOW` | `standard` | The flow to sync when `WORKFLOW_RELEASE` is not set. Set it with mise. |
| `WORKFLOW_RELEASE` | | The release folder to use. The Nix package sets it, so the flow comes from your flake, and `LETS_SPEC_FLOW` has no effect. |
