## 1. lets sync checks the release before it writes (C12)

- [x] 1.1 [easy] `lets sync` in a git project that has never synced, with a release that ships the skill folder `.agents/skills/other`, exits 1, prints `ships .agents/skills/other, which lets sync does not own.` on stderr, and writes no file: `AGENTS.md`, `.gitignore` and the managed folders are as they were. Move the `releasePaths({ release, io })` call up beside `requireRelease` at the top of `steps` in `lets/src/sync/main.ts` (verify: node --test tests/lets/sync/main.test.ts) (✓ node --test tests/lets/sync/main.test.ts passed)
- [x] 1.2 [easy] `LETS_SPEC_SKILLS=ignored lets sync --check` refuses the same release with exit 1 and the same stderr. Today only the committed mode's check reaches `releasePaths` (verify: node --test tests/lets/sync/main.test.ts) (✓ node --test tests/lets/sync/main.test.ts passed)

## 2. The T3 token follows XDG_CONFIG_HOME (C14)

- [x] 2.1 [easy] With `XDG_CONFIG_HOME=/cfg`, `readToken` in `contrib/t3-resolver/src/t3.ts` returns the token stored at `/cfg/lets-delegate/t3-token` and issues none; with no token stored there, it writes the fresh token to that path. Use the same rule as `configPath` in `lets/src/delegate/config.ts` (verify: node --test tests/t3-resolver/t3.test.ts) (✓ node --test tests/t3-resolver/t3.test.ts passed)
- [x] 2.2 [easy] With `XDG_CONFIG_HOME` unset, and with it set to the empty string, `readToken` reads and writes `~/.config/lets-delegate/t3-token` (verify: node --test tests/t3-resolver/t3.test.ts) (✓ node --test tests/t3-resolver/t3.test.ts passed)
- [x] 2.3 [easy] With `XDG_CONFIG_HOME=/cfg`, nothing at `/cfg/lets-delegate/t3-token`, and `old` stored at `~/.config/lets-delegate/t3-token`, `readToken` issues a new token, writes it to `/cfg/lets-delegate/t3-token`, and never returns `old` (verify: node --test tests/t3-resolver/t3.test.ts tests/t3-resolver/resolver.test.ts) (✓ node --test tests/t3-resolver/t3.test.ts tests/t3-resolver/resolver.test.ts passed)
- [x] 2.4 [easy] `contrib/t3-resolver/README.md` says the token lives in `$XDG_CONFIG_HOME/lets-delegate/t3-token` when that is set, beside `lets`'s `config.yaml`, and in `~/.config/lets-delegate/t3-token` otherwise; and that `T3CODE_HOME` sets the T3 base directory the resolver reads and issues tokens against (verify: grep -q XDG_CONFIG_HOME contrib/t3-resolver/README.md && grep -q T3CODE_HOME contrib/t3-resolver/README.md) (✓ grep checks passed)

## 3. A git failure after a review exits 4 (C18)

- [ ] 3.1 [easy] When `git status` fails after the session, `lets delegate review run` exits 4 (`EXIT.spawn`), not 7; stderr still says it could not check the tree, and the session is still finished as not ok. Change the `return EXIT.dirty` in the `SpawnError` branch of `lets/src/delegate/review.ts` (verify: node --test tests/lets/delegate/review.test.ts)

## 4. Integration

- [ ] 4.1 [easy] Every project check passes (verify: pnpm test && nix flake check)
