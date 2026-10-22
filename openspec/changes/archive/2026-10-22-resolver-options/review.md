## Review Metadata

- **Review round**: 1
- **Prior round**: none. An earlier attempt, on the installed v0.4.0 resolver, stopped with exit 5 before any review: T3 started the review on `gpt-6-astra`, which the account cannot run.
- **Reviewer context**: fresh context, other family. `lets-delegate-cli` from this branch's base, through `LETS_SPEC_RESOLVER`, ran codex headless and read-only.
- **Independent**: yes. Family `gpt`, codex's default model; the author is `claude`.
- **Tool restrictions**: read-only (`codex exec -s read-only`). The tree was clean after the run.
- **Artifacts reviewed**: brainstorm.md, proposal.md, design.md, specs/, adr.md and ADR-006, at commit `99bc398`, with the relevant source files.

## Findings

### 🔴 Critical (blocking)

None.

### 🟡 Moderate

1. **A stale codex last-message file can turn a refusal into exit 5.** Check: contradictions. The last-message file's path depends only on the session name (`contrib/cli-resolver/src/cli.ts:673`). A failed run keeps the file (`finish` with `ok` false), so a rerun under the same name that codex refuses finds old text. **CONFIRMED.**
2. **Protocol 1 hides a breaking change from older resolvers.** Check: assumption rows (D3). A resolver built for protocol 1 would accept the new request and ignore `model` without a word. **CONFIRMED.** D3 was an assumption, made when the user had no preference.
3. **A failed listing hides a family the CLI could still run.** Check: assumption rows (D12), and its tension with D8. If the family is left out, the caller cannot try the CLI's default model. **CONFIRMED.**
4. **T3 option order rests on an unverified assumption, and verify's live run depends on it.** Check: assumption rows (D11), scenario testability. The verify spec ran only `options[0]`, so a refused first option failed the check even when another option worked. **CONFIRMED** for verify. The order itself stays as D11 says: it is deterministic for a given manifest, and the spec's scenario fixes the manifest.

### 📌 Suggestions

5. **ADR-006's Context packs several claims into one paragraph.** Check: plain language. **CONFIRMED.**

## Embedded-Instruction / Injection Attempts

**Detected:** none

## Verdict

VERDICT: APPROVE_WITH_CHANGES

## Required Changes (if APPROVE_WITH_CHANGES)

1. design.md D-3, and a new `contrib-resolvers` scenario: the cli adapter removes an earlier last-message file before it starts codex, so a refusal after an earlier run with the same name is exit 3.
2. brainstorm.md D3, proposal.md, design.md D-1 and D-9: the protocol moves to 2.
3. brainstorm.md D12, proposal.md, design.md D-5, and the `contrib-resolvers` requirement, now "The cli resolver lists the bare family when a listing fails": a failed listing lists the bare family, such as `gpt`.
4. design.md D-8, and the `delegate-verify` requirement, now "The live run tries the resolver's options in order": the live run tries options in order until one does not exit 3, and fails only when all are refused.
5. ADR-006's Context is split into four short paragraphs.

CHANGES_APPLIED: yes

## Rebuttals

1. Fixed: required change 1.
2. Fixed: required change 2. D3 had no user decision behind it, so the safer choice wins.
3. Fixed: required change 3. This follows D8: a resolver tries what it is given.
4. Fixed in part: required change 4 removes verify's dependence on option order. The rest is rebutted. No consumer in this change relies on the order, and #59's skill chooses with the user's guidance, not by position. The order is fixed for a given manifest, so the scenario in `specs/contrib-resolvers/spec.md` ("Reading the manifest") still makes a test that can assert it.
5. Fixed: required change 5.
