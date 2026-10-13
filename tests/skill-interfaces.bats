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

# flow_skills <flow>: the skills flows.nix ships with the flow, one per line.
# The list may span several lines, so join the flow's block first.
flow_skills() {
  sed -n "/^  $1 = {/,/^  };/p" "$repo/flows.nix" | tr '\n' ' ' |
    grep -o 'skills = \[[^]]*\]' | grep -o '"[^"]*"' | tr -d '"'
}

# named_skills <file>: each name the file calls a skill, as `name` skill,
# even across a line break.
named_skills() {
  tr -s '[:space:]' ' ' <"$1" | grep -oE '`[a-z-]+` skill' | cut -d'`' -f2 | sort -u
}

@test "each skill a flow ships, other than an entry point, is named by its schema" {
  local flow skill
  for flow in standard minimal; do
    for skill in $(flow_skills "$flow"); do
      case "$skill" in lets-build | lets-shape) continue ;; esac
      named_skills "$repo/schemas/$flow/schema.yaml" | grep -qx "$skill" ||
        { echo "$flow ships $skill, but its schema never names it"; false; }
    done
  done
}

@test "each skill a schema names is one its flow ships, or a generated OpenSpec skill" {
  local flow skill
  for flow in standard minimal; do
    for skill in $(named_skills "$repo/schemas/$flow/schema.yaml"); do
      case "$skill" in openspec-*) continue ;; esac
      flow_skills "$flow" | grep -qx "$skill" ||
        { echo "the $flow schema names $skill, which the flow does not ship"; false; }
    done
  done
}

@test "each marker a schema reads is one its templates write" {
  local flow marker
  for flow in standard minimal; do
    for marker in 'Confirmed by user:' 'VERDICT:' 'CHANGES_APPLIED:'; do
      grep -qF "$marker" "$repo/schemas/$flow/schema.yaml" || continue
      grep -qF "$marker" "$repo/schemas/$flow/templates/"*.md ||
        { echo "the $flow schema reads $marker, but no template writes it"; false; }
    done
  done
}

@test "every instruction block is a literal block, so its line breaks survive" {
  run grep -n 'instruction: *[^| ]' "$repo"/schemas/*/schema.yaml
  [ "$status" -eq 1 ] || { echo "$output"; false; }
}

@test "the prose has no trailing whitespace" {
  run grep -n ' $' $(prose)
  [ "$status" -eq 1 ] || { echo "$output"; false; }
}
