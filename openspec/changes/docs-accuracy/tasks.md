## 1. Owner and ADRs

- [x] 1.1 [easy] Every install snippet and this repository's `mise.toml` name `sidereal-io/lets-spec`. Only the `0.1.0` mise snippet in the README keeps the old owner, because #25 owns it (verify: `! grep -rn andrewduckett README.md contrib mise.toml | grep -v 'version = "0.1.0"'`) (✓ verify passed)
- [x] 1.2 [easy] ADR-002's top note says plainly that its first decision still holds and that ADR-006 replaced the second, about `reviewers`. Its status stays `accepted` (verify: `f=docs/decisions/ADR-002-lets-owns-the-delegate-config.md; grep -q '^status: accepted$' $f && ! grep -q 'Superseded in part' $f && grep -q '^> .*ADR-006' $f`) (✓ verify passed)
- [x] 1.3 [easy] ADR-003 opens with a note saying that `lets-delegate-cli` opens no harness window, so it answers wherever `codex`, `claude` or `agy` is on `PATH`. Its status stays `accepted` (verify: `f=docs/decisions/ADR-003-one-resolver-per-harness.md; grep -q '^status: accepted$' $f && grep -q '^> .*lets-delegate-cli' $f`) (✓ verify passed)
- [x] 1.4 [easy] ADR-005's Context is two paragraphs, the second starting "One constraint shapes how the default is named", with no word changed (verify: `f=docs/decisions/ADR-005-the-config-lists-the-chain.md; grep -q '^One constraint shapes how the default is named' $f && [ "$(git show main:$f | tr -s ' \n' ' ')" = "$(tr -s ' \n' ' ' < $f)" ]`) (✓ verify passed)

## 2. README and AGENTS.md

- [x] 2.1 [easy] The README's upgrade note says `openspec/config.yaml` must name your flow's schema, not `lets-standard` or `lets-minimal` (verify: `grep -q "your flow's schema" README.md && ! grep -q 'must now say `schema: lets-standard` or' README.md`) (✓ verify passed)
- [x] 2.2 [easy] The README's `lets sync` exit table says that outside a git repository it writes nothing, says so, and exits 0 (verify: `awk '/^\| Exit \| When \|/,/^$/' README.md | grep -qi 'git repo'`) (✓ verify passed)
- [x] 2.3 [easy] The README describes `contrib/headless-resolver` as a complete resolver in `sh`, with no line count (verify: `! grep -qi 'twenty lines' README.md && grep -q 'contrib/headless-resolver' README.md`) (✓ verify passed)
- [x] 2.4 [easy] The `pnpm test` comment in `AGENTS.md` names the Node tests, the type check, `pnpm verify` and the bats tests (verify: `grep '^pnpm test' AGENTS.md | grep -q 'pnpm verify' && grep '^pnpm test' AGENTS.md | grep -qi 'type'`) (✓ verify passed)

## 3. Resolver contract and verify help

- [ ] 3.1 [easy] The contract says that `lets delegate verify` gives each shape check 60 seconds, next to the five minutes for other verbs (verify: `grep -q '60 seconds' docs/resolver-contract.md`)
- [ ] 3.2 [easy] The contract's exit 5 and 6 rows say that `review run` exits 5 or 6, and that `handoff run` exits 4 for both (verify: `grep -E '^\| (5|6) \|' docs/resolver-contract.md | grep -c 'handoff run' | grep -qx 2`)
- [ ] 3.3 [easy] The contract says that when `finish` fails, `lets` reports it on stderr and the review's result and exit code stay the same (verify: `grep -i 'finish' docs/resolver-contract.md | grep -qi 'stderr'`)
- [ ] 3.4 [easy] `lets delegate verify --help` says the live `start` runs on the first model `probe` lists, or on `claude` when it lists none (verify: `node lets/bin/lets delegate verify --help | grep -q 'claude'`)

## 4. Checks

- [ ] 4.1 [easy] The project's checks pass with every edit in place (verify: `pnpm test && nix flake check`)
