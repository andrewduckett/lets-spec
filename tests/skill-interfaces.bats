load support/common

# Agents read the skills, schemas and rules, then run the scripts and open
# the files they name. These tests check that every name still points at
# something real, so a rename breaks a test, not an agent.

# The text agents read.
prose() {
  printf '%s\n' "$repo"/skills/*/SKILL.md "$repo"/schemas/*/schema.yaml \
    "$repo"/schemas/*/templates/*.md "$repo"/overlays/AGENTS.md
}

# mentions <pattern>: each distinct match of the extended regex in the prose.
mentions() {
  prose | xargs grep -ohE "$1" | sort -u
}

@test "each skill is named for its folder" {
  local dir name
  for dir in "$repo"/skills/*/; do
    name="$(basename "$dir")"
    [ "$(sed -n 's/^name: //p' "$dir/SKILL.md" | head -n 1)" = "$name" ] ||
      { echo "$name/SKILL.md has another name"; false; }
  done
}

@test "each script the prose names exists" {
  local mention found=0
  while IFS= read -r mention; do
    found=1
    [ -f "$repo/skills/$mention" ] || { echo "no such script: $mention"; false; }
  done < <(mentions '[a-z-]+/scripts/[a-z-]+\.(sh|jq)')
  [ "$found" -eq 1 ]
}

@test "each command the prose gives a script is one the script's usage lists" {
  local script command found=0
  while read -r script command; do
    found=1
    run bash "$repo/skills/$script" --help
    [ "$status" -eq 0 ]
    [[ "$output" == *"$(basename "$script") $command"* ]] ||
      { echo "$script has no command $command"; false; }
  done < <(mentions '[a-z-]+/scripts/[a-z-]+\.sh [a-z][a-z-]+')
  [ "$found" -eq 1 ]
}

@test "each schema template the prose names exists" {
  local mention
  while IFS= read -r mention; do
    [ -f "$repo/schemas/${mention#openspec/schemas/}" ] || { echo "no such template: $mention"; false; }
  done < <(mentions 'openspec/schemas/[a-z-]+/templates/[a-z-]+\.md')
}
