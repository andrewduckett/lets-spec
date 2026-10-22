## Why

Let's Spec has no shared vocabulary discipline, so agents can carry ambiguous or conflicting meanings from shaping into stories, requirements, code, and UI. Projects need agreed terms that remain consistent across domains and planning sessions.

## What Changes

- Develop domain language during shaping and brainstorming, recording agreed definitions immediately and keeping unresolved meanings tentative (D1–D2, D7).
- Support optional nested glossaries, explicit scope distinctions, and promotion of shared definitions without duplication (D3–D6).
- Reuse an existing shared glossary through an explicit OpenSpec project-context pointer, with predictable lookup and missing-file handling (D14–D16).
- Require relevant vocabulary during spec writing, implementation, and reviews in both flows; investigate semantic conflicts while allowing different code representations (D8–D9, D12–D13).
- Resolve glossary edit ownership at shaping's handoff when those edits exist, including definitions shared by several stories (D10–D11, D17).
- Review scoped definitions when a capability retires (D18).

## Capabilities

### New Capabilities

- `shared-domain-language`: Discover, develop, maintain, and review agreed vocabulary across project, domain, and capability scopes throughout the workflow.

### Modified Capabilities

None.

## Impact

Update the authored workflow skills, both schemas, relevant rules in `overlays/AGENTS.md`, and user documentation. Add focused compatibility and distribution checks where the design requires them.

Design will settle instruction structure, exact conventional paths, and OpenSpec compatibility (D19). Consumer glossary migrations and automated terminology linting remain out of scope. No new configuration parser or mandatory workflow stage is proposed.
