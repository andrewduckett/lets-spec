# Specs in a monorepo

This page is for you if you are setting up Let's Spec in a repository that
holds several applications or services. It says how to lay out the specs,
and how to tell agents which code each group of specs describes.

## Keep one setup at the root

Keep one set of skills and one `openspec/` directory at the repository
root, as
[OpenSpec recommends for monorepos](https://github.com/Fission-AI/OpenSpec/blob/main/docs/existing-projects.md#monorepos-and-work-that-spans-repos).
Group the specs by application, service or feature, as your project needs:

```text
.agents/skills/                        # shared skills
AGENTS.md                              # shared workflow rules
openspec/
  config.yaml                          # shared schema and project context
  specs/
    backend/checkout/spec.md
    frontend/checkout/spec.md
    shared/user-auth/spec.md
  changes/
```

## Domains and capability paths

- A **domain** is a group of specs, such as `backend` or `shared`.
- A **capability path** names one spec by its folder under
  `openspec/specs/`, such as `user-auth` or `backend/checkout`.

`backend/checkout` and `frontend/checkout` are two different capabilities,
even though their last folder has the same name. Agents always use the
full path.

Domains are optional. A flat path such as `openspec/specs/user-auth/spec.md`
keeps working. You do not need to move it or configure anything.

## Tell agents which code each domain describes

Domain names do not map to source folders by themselves. Say how they map
in the `context` of `openspec/config.yaml`:

```yaml
context: |
  Backend capabilities describe apps/api; frontend capabilities describe apps/web.
  Shared authentication behavior is implemented in packages/auth.
```

Agents use this context, the request and the code to find the specs a
change touches. When the scope is clear, they go on without asking you to
pick a domain.

## One change can update several domains

A checkout story can change both the backend and the frontend specs. Its
change then holds two delta specs:

```text
openspec/changes/add-checkout/specs/backend/checkout/spec.md
openspec/changes/add-checkout/specs/frontend/checkout/spec.md
```

Each delta's path matches its main spec under `openspec/specs/`. A spec the
change only reads, such as shared authentication, gets a delta only if its
requirements change.

Skills, git branches and pull requests stay shared across the repository.
One change is still one branch and one pull request, however many domains
it touches.
