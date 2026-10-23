load support/common

# Agents read the skills, schemas and rules, then run the commands and open
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

# A gh command in a code block starts its line; in a sentence it follows a
# backtick. gh answers an unknown command with its group's help, and exits
# 0, so the test reads the usage line instead.
@test "each gh command the prose names is one gh knows" {
  local group command found=0
  while read -r group command; do
    found=1
    # gh api takes an endpoint, not a command. Its help names graphql.
    if [ "$group" = api ]; then
      gh api --help 2>&1 | grep -qE "^  \\\$ gh api $command( |$)" ||
        { echo "gh api has no endpoint: $command"; false; }
      continue
    fi
    gh "$group" "$command" --help 2>&1 | grep -qE "^  gh $group $command( |$)" ||
      { echo "gh has no command: gh $group $command"; false; }
  done < <(mentions '(^ *|`)gh [a-z]+ [a-z-]+' | sed -E 's/^[ `]*gh //' | sort -u)
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
# skills: each schema the flow ships, and the flow's config.
flow_texts() {
  local schema
  for schema in $(jq -r --arg flow "$1" '.flows[$flow].schemas[]' "$repo/flows.json"); do
    echo "$repo/schemas/$schema/schema.yaml"
  done
  echo "$repo/overlays/openspec/config.d/lets-$1.yaml"
}

# A skill no schema step calls is still reachable when another skill the
# flow ships calls it. lets-review-code is reached through the standard
# flow's finishing rules, in its config.
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
      case "$skill" in lets-build | lets-shape | lets-setup-backlog) continue ;; esac
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

@test "the resolver contract shows contrib/headless-resolver as it is" {
  local doc="$repo/docs/resolver-contract.md"
  diff "$repo/contrib/headless-resolver" \
    <(awk '/^#!\/bin\/sh$/ { show = 1 } /^```$/ { show = 0 } show' "$doc")
}

@test "the review skills say exit 3 also means no resolver started a session" {
  for skill in lets-review-code lets-review-plan; do
    grep -q '\*\*3\*\*: no fresh session can run here, for example because no resolver started one' \
      "$repo/skills/$skill/SKILL.md" || { echo "$skill"; false; }
  done
}

@test "each lets delegate review or handoff the prose names is followed by instructions or run" {
  run bash -c "$(declare -f prose); repo='$repo'; prose | xargs grep -ohE 'lets delegate (review|handoff)( [^ \`]+)?' | grep -vE 'lets delegate (review|handoff) (instructions|run)$'"
  [ "$status" -eq 1 ] || { echo "$output"; false; }
}

@test "the docs name lets delegate review or handoff only with instructions or run" {
  run bash -c "grep -ohE 'lets delegate (review|handoff)( [^ \`]+)?' '$repo/README.md' '$repo/docs/resolver-contract.md' '$repo'/contrib/*/README.md | grep -vE 'lets delegate (review|handoff) (instructions|run)$'"
  [ "$status" -eq 1 ] || { echo "$output"; false; }
}

@test "the README's warning about #58 is gone" {
  run grep -n 'issues/58' "$repo/README.md"
  [ "$status" -eq 1 ] || { echo "$output"; false; }
}

@test "the README names where the guidance lives, and --for" {
  grep -qF 'delegations.<intent>.guidance' "$repo/README.md"
  grep -qF -- '--for' "$repo/README.md"
}

@test "the resolver contract describes the probe's verb" {
  grep -qE '^\| `verb` \| `probe` \|' "$repo/docs/resolver-contract.md"
}

# skill_says <skill> <fixed text>: the skill's SKILL.md holds the text,
# which may wrap across lines.
skill_says() {
  tr -s '[:space:]' ' ' < "$repo/skills/$1/SKILL.md" | grep -qF -- "$2" || { echo "$1 does not say: $2"; return 1; }
}

@test "each review skill asks lets for its intent's options, then runs with a ranked list" {
  for pair in lets-review-plan:plan lets-review-code:code; do
    skill="${pair%%:*}" intent="${pair##*:}"
    skill_says "$skill" "lets delegate review instructions --for $intent"
    skill_says "$skill" "lets delegate review run --for $intent"
    skill_says "$skill" "--model <first> --model <second>"
    skill_says "$skill" "delegations.$intent.guidance"
  done
}

@test "each review skill ranks by the guidance, then other families, then the order given" {
  for skill in lets-review-code lets-review-plan; do
    skill_says "$skill" "the guidance first, then families other than the author's, then the order the options came in"
  done
}

@test "each review skill takes the subagent step when there are no options" {
  for skill in lets-review-code lets-review-plan; do
    skill_says "$skill" "When \`options\` is empty, whatever the resolver, skip the command and take the [subagent step]"
  done
}

@test "each skill that delegates lets the guidance only rank and filter models" {
  for skill in lets-review-code lets-review-plan lets-build; do
    skill_says "$skill" "The guidance only ranks and filters the listed models"
  done
}

@test "lets-build's handoff asks lets for options, then runs with a ranked list" {
  skill_says lets-build "lets delegate handoff instructions --for apply"
  skill_says lets-build "lets delegate handoff run --for apply"
  skill_says lets-build "delegations.apply.guidance"
  skill_says lets-build "the guidance first, then the order the options came in"
  skill_says lets-build "When \`options\` is empty, pass your own family"
  skill_says lets-build "If it exits 3, every model was refused: show the user its stderr, and stop."
}

@test "lets-build says a handoff's instructions hold the prompt to carry on by hand" {
  grep -q 'hold the prompt to carry on by hand' "$repo/skills/lets-build/SKILL.md"
}

# Resolve actual Markdown reference links as an installed skill would.
# Include source copies in an isolated fixture so a bad relative path fails.
assert_reference_links() {
  local text="$1" root="$2" base="${3:-$(dirname "$1")}" link found=0
  root="$(realpath "$root")"
  while IFS= read -r link; do
    found=1
    [ -f "$base/$link" ] || { echo "unresolved: $text -> $link"; return 1; }
    case "$(realpath "$base/$link")" in
      "$root"/*) ;;
      *) echo "reference escapes installed skills: $text -> $link"; return 1 ;;
    esac
  done < <(grep -oE '\]\([^)]*references/[^)]*\.md\)' "$text" | sed -E 's/^\]\(//;s/\)$//')
  [ "$found" -eq 1 ] || { echo "no reference input: $text"; return 1; }
}

@test "shaping loads its installed domain-language reference" {
  assert_reference_links "$repo/skills/lets-shape/SKILL.md" "$repo/skills"
}

load support/release

@test "planning vocabulary inputs resolve inside each published flow" {
  local flow schema skill out schemas
  for flow in standard minimal; do
    out="$BATS_TEST_TMPDIR/$flow"
    schemas="$(jq -r --arg flow "$flow" '.flows[$flow].schemas | join(",")' "$repo/flows.json")"
    build "$out" "$schemas" $(flow_skills "$flow")
    for skill in lets-shape lets-brainstorm lets-write-specs; do
      assert_reference_links "$out/overlay/.agents/skills/$skill/SKILL.md" "$out/overlay"
    done
    for schema in $(jq -r --arg flow "$flow" '.flows[$flow].schemas[]' "$repo/flows.json"); do
      (
        cd "$out/overlay"
        printf 'schema: %s\n' "$schema" > openspec/config.yaml
        OPENSPEC_TELEMETRY=0 OPENSPEC_NO_UPDATE_CHECK=1 openspec new change "$schema-demo" </dev/null >/dev/null 2>&1
        printf '%s\n' '- [ ] 1.1 Fixture implementation' >"openspec/changes/$schema-demo/tasks.md"
        local artifact
        for artifact in brainstorm specs apply; do
          OPENSPEC_TELEMETRY=0 OPENSPEC_NO_UPDATE_CHECK=1 openspec instructions "$artifact" --change "$schema-demo" --json </dev/null >"$out/instructions.json" 2>/dev/null
          jq -r .instruction "$out/instructions.json" >"$out/instruction.md"
          # Agents receive CLI text without its schema file location.
          assert_reference_links "$out/instruction.md" "$out/overlay" "$out/overlay"
        done
      )
    done
  done
}

@test "review vocabulary inputs resolve in the published standard flow" {
  local out="$BATS_TEST_TMPDIR/standard" skill
  build "$out" lets-standard,lets-minimal $(flow_skills standard)
  for skill in lets-review-plan lets-review-code; do
    assert_reference_links "$out/overlay/.agents/skills/$skill/SKILL.md" "$out/overlay"
  done
}

@test "installed reference containment accepts a symlinked root" {
  local real="$BATS_TEST_TMPDIR/real" alias="$BATS_TEST_TMPDIR/alias"
  mkdir -p "$real/skill/references"
  printf '# Method\n' >"$real/skill/references/method.md"
  printf '[Method](references/method.md)\n' >"$real/skill/SKILL.md"
  ln -s "$real" "$alias"
  assert_reference_links "$alias/skill/SKILL.md" "$alias"
}
