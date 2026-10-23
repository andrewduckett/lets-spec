## 1. Move the pin to v0.5.0

- [ ] 1.1 [easy] `mise.toml` pins `github:andrewduckett/lets-spec` at 0.5.0, and nothing else in the file changes (verify: `grep -q '"github:andrewduckett/lets-spec" = "0.5.0"' mise.toml && git diff --stat -- mise.toml | grep -q '1 file changed, 1 insertion(+), 1 deletion(-)'`)
- [ ] 1.2 [easy] `mise install` fetches the release, so `lets` in this repository is 0.5.0 (verify: `mise install && test "$(mise exec -- lets --version)" = "0.5.0"`)
- [ ] 1.3 [easy] `lets sync` rewrites the rules block in `AGENTS.md` and the skills block in `.gitignore`, both now with the `lets sync rewrites` marker, and the rules carry the Domain language section (verify: `mise exec -- lets sync && grep -q 'lets sync rewrites this block' AGENTS.md && grep -q 'lets sync rewrites this block' .gitignore && grep -q '^### Domain language' AGENTS.md`)
- [ ] 1.4 [easy] The project is in sync with the release, and git tracks none of the skill or schema copies (verify: `mise exec -- lets sync --check && test -z "$(git ls-files -- '.agents/skills/lets-*' '.agents/skills/openspec-*' 'openspec/schemas/lets-*')"`)
- [ ] 1.5 [medium] The pin bump and what `lets sync` wrote are one `chore:` commit, and the project's checks pass on it (verify: `test -z "$(git status --porcelain --untracked-files=no)" && pnpm test && nix flake check`)
