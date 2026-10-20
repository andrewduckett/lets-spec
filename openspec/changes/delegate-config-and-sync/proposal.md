## Why

`lets delegate` finds its resolver by a `PATH` convention, and the resolver picks a review model with no record of what the user chose. T3 lists models the account cannot run, so a review from T3 exits 5 on `gpt-6-astra` (#34). Every other delegate fix under #38 builds on a config the user owns, so it comes first.

## What Changes

- **New command `lets delegate setup`.** It detects the harness it runs in, the family CLIs on `PATH`, and the models each account can run (D1, D2). It shows what it found and proposes a config, and writes nothing (D3). It starts no session and spends no tokens (D14).
- **`--write` writes the proposed config,** and flags change a choice before it is written (D3). It prints readable text, or JSON with `--json`. Running it again shows the current config next to the proposal (D15).
- **A user-level config** at `~/.config/lets-delegate/config.json`, or under `XDG_CONFIG_HOME` when that is set (D13). It names a resolver (D9) and holds an ordered reviewer list. Each entry has a family, a model or `null` for the tool's own default, and optional efforts (D4, D5, D6).
- **The lookup reads the config.** The order is `LETS_SPEC_RESOLVER`, then the config's resolver, then `lets-delegate-resolver` on `PATH`, then the built-in default (D10). If the config's resolver is missing or can't run, the command exits 2 and says to run setup again (D11).
- **The `run` request gains an optional `reviewers` field** in protocol 1. `lets delegate review` sends the entries that serve the review's effort (D7). A resolver that ignores the field keeps working.
- **The contrib resolver walks the list** in T3 and in herdr. It takes the first entry from another family that its harness can run, or the first entry it can run at all, which then reports `independent: false` (D4). If it can run no entry, it exits 3 and names the entries it skipped and why (D12). With no list, it keeps its own rule (D17).
- **The READMEs say to run `lets delegate setup`** to configure delegation, and the contract section documents the new field and the config.

Handoffs do not use the reviewer list (D16). Installing or updating the resolver from the release is #44 (D8).

## Capabilities

### New Capabilities
- `delegate-setup`: what `lets delegate setup` detects, how it shows its findings, the config it proposes, and how `--write` and its flags write it.
- `delegate-config`: how `lets delegate` uses the user config: the config's resolver in the lookup, the reviewer list in the `run` request, and how the contrib resolver chooses from that list.

### Modified Capabilities
- `delegate-default`: the requirement "The default answers last" now also waits for the resolver the user config names.

## Impact

- **Code:** a new setup command and config reader under `lets/src/delegate/`, and `lets/src/cli.ts`. Changes to `lookup.ts`, `review.ts`, and `protocol.ts` and its copy in `contrib/lets-delegate-resolver/src/`. In the contrib resolver: `families.ts`, `resolver.ts`, `t3.ts` and `herdr.ts`. Conformance in `lets/src/delegate/conformance.ts` accepts the new field.
- **Tests:** `tests/lets/` and `tests/lets-delegate-resolver/`.
- **Protocol:** protocol 1 gains one optional request field. Existing resolvers are unaffected.
- **External tools:** setup runs `codex debug models` and `agy models`, and reads T3's runtime file. These list commands are not stable interfaces, so the setup output says which source each list came from.
- **Docs:** the README, and `contrib/lets-delegate-resolver/README.md` (*How `lets` finds a resolver*, *The request*).
- **Files on the user's machine:** a new file, `~/.config/lets-delegate/config.json`, which is written only by `--write`.
