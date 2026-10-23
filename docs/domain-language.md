# Domain language in a project

A glossary keeps the words in your plans, specs and code meaning the
same thing. This page says where it lives and what the agents do with it.
The agents' own rules are in the
[domain-language reference](../skills/lets-shape/references/domain-language.md).

## Where the glossary lives

The shared glossary is `openspec/glossary.md`. It holds terms that mean
the same thing across the whole project.

A spec folder can hold its own `glossary.md` for a narrower meaning. For
`openspec/specs/backend/checkout/`, agents read
`openspec/specs/backend/glossary.md` and
`openspec/specs/backend/checkout/glossary.md`, when they exist.

Every glossary is optional. A project with none still works, and the
agents never create an empty one.

## Use a glossary you already have

If your project already has a glossary, name it in the `context` of
`openspec/config.yaml`:

```yaml
context: |
  Shared glossary: docs/requirements/00-glossary.md
  This replaces the default openspec/glossary.md.
```

The path is relative to the folder that holds `openspec/`. If the file is
missing, the agents tell you instead of falling back to the default.

## What the agents do with a term

- They ask you what a term means before they rely on it.
- Once you agree a meaning and a scope, they write it in the glossary.
- They read the glossary again at each step, and keep the meaning in
  code names and reviews.

## When shaping adds a term

1. The new definition goes in a commit of its own, apart from other work.
2. You choose which pull request carries it: one story's, or a separate
   documentation pull request.
3. Other stories that need the definition wait until that pull request
   merges.
