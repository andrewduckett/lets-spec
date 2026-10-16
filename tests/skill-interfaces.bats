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
  done < <(mentions '[a-z-]+/scripts/[a-z-]+\.(sh|jq|mjs)')
  [ "$found" -eq 1 ]
}

@test "each command the prose gives a Node script is one its usage lists" {
  local script command found=0
  while read -r script command; do
    found=1
    run node "$repo/skills/$script" --help
    [ "$status" -eq 0 ]
    [[ "$output" == *"$(basename "$script") $command"* || "$output" == *"$(basename "$script" .mjs) $command"* ]] ||
      { echo "$script has no command $command"; false; }
  done < <(mentions '[a-z-]+/scripts/[a-z-]+\.mjs [a-z][a-z-]+')
  [ "$found" -eq 1 ]
}

@test "each schema template the prose names exists" {
  local mention
  while IFS= read -r mention; do
    [ -f "$repo/schemas/${mention#openspec/schemas/}" ] || { echo "no such template: $mention"; false; }
  done < <(mentions 'openspec/schemas/[a-z-]+/templates/[a-z-]+\.md')
}

# flow_skills <flow>: the skills flows.json ships with the flow, one per line.
flow_skills() {
  jq -r --arg flow "$1" '.flows[$flow].skills[]' "$repo/flows.json"
}

# named_skills <file>: each name the file calls a skill, as `name` skill,
# even across a line break.
named_skills() {
  tr -s '[:space:]' ' ' <"$1" | grep -oE '`[a-z-]+` skill' | cut -d'`' -f2 | sort -u
}

# flow_texts <flow>: the files lets-spec gives a flow's agent besides its
# skills: the schema, and the flow's config.
flow_texts() {
  echo "$repo/schemas/lets-$1/schema.yaml"
  echo "$repo/overlays/openspec/config.d/lets-$1.yaml"
}

# A skill no schema step calls, such as lets-spawn, is still reachable
# when another skill the flow ships calls it. lets-review-code is reached
# through the standard flow's finishing rules, in its config.
@test "each skill a flow ships, other than an entry point, is named by its schema, its config or a skill the flow ships" {
  local flow skill shipped named text
  for flow in standard minimal; do
    shipped="$(flow_skills "$flow")"
    [ -n "$shipped" ] || { echo "flows.json lists no skills for $flow"; false; }
    named="$(
      for text in $(flow_texts "$flow"); do named_skills "$text"; done
      for skill in $shipped; do named_skills "$repo/skills/$skill/SKILL.md"; done
    )"
    for skill in $shipped; do
      case "$skill" in lets-build | lets-shape) continue ;; esac
      grep -qx "$skill" <<<"$named" ||
        { echo "$flow ships $skill, but none of its schema, config or skills name it"; false; }
    done
  done
}

@test "each skill a schema or config names is one its flow ships, or a generated OpenSpec skill" {
  local flow skill text
  for flow in standard minimal; do
    for text in $(flow_texts "$flow"); do
      for skill in $(named_skills "$text"); do
        case "$skill" in openspec-*) continue ;; esac
        flow_skills "$flow" | grep -qx "$skill" ||
          { echo "${text#"$repo/"} names $skill, which the $flow flow does not ship"; false; }
      done
    done
  done
}

@test "each marker a schema reads is one its templates write" {
  local flow marker template
  for flow in standard minimal; do
    for marker in 'Confirmed by user:' 'VERDICT:' 'CHANGES_APPLIED:'; do
      grep -qF "$marker" "$repo/schemas/lets-$flow/schema.yaml" || continue
      case "$marker" in
        'Confirmed by user:') template=brainstorm.md ;;
        *) template=review.md ;;
      esac
      grep -qF "$marker" "$repo/schemas/lets-$flow/templates/$template" ||
        { echo "the $flow schema reads $marker, but templates/$template does not write it"; false; }
    done
  done
}

@test "every instruction block is a literal block, so its line breaks survive" {
  local schema
  for schema in "$repo"/schemas/*/schema.yaml; do
    [ "$(grep -c '^ *instruction:' "$schema")" -eq "$(grep -c '^ *instruction: |$' "$schema")" ] ||
      { echo "$schema has an instruction that is not a literal block"; false; }
    [ "$(grep -c '^ *instruction: |$' "$schema")" -ge 3 ] ||
      { echo "$schema has fewer instruction blocks than any flow needs"; false; }
  done
}

@test "the prose has no trailing whitespace" {
  run grep -n '[[:space:]]$' $(prose)
  [ "$status" -eq 1 ] || { echo "$output"; false; }
}
