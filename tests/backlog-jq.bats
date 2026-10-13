load support/common

# The backlog rules live in .jq files beside each backlog.sh: backlog-next.jq
# picks a story, backlog-claim.jq and backlog-plan.jq plan the gh commands
# for a write. These tests run them on JSON shaped like GitHub's responses,
# so they need no network and no gh.
#
# The property tests make many random inputs from a fixed seed, so a run is
# repeatable, and check a rule that must hold for each one. On a failure
# they print the input that broke the rule.

build_scripts="$repo/skills/lets-build/scripts"
shape_scripts="$repo/skills/lets-shape/scripts"

# issue <n> <field> <label>...: an issue as GitHub's search returns it. Its
# Priority field is <field>, unset when it is "-", or cleared when it is
# "null". Each <label> is a priority/* label.
issue() {
  local n="$1" field="$2" fields="[]" labels="" option
  shift 2
  if [ "$field" != - ]; then
    option="{\"name\": \"$field\"}"
    [ "$field" != null ] || option=null
    fields="[{\"issue_field_name\": \"Priority\", \"single_select_option\": $option}]"
  fi
  for label in "$@"; do
    labels+="${labels:+, }{\"name\": \"priority/$label\"}"
  done
  printf '{"number": %d, "title": "story-%d", "html_url": "https://github.com/o/r/issues/%d", "labels": [%s], "issue_field_values": %s}\n' \
    "$n" "$n" "$n" "$labels" "$fields"
}

# next_of <issue JSON>...: run backlog-next.jq on a search result that holds
# the issues.
next_of() {
  printf '%s\n' "$@" | jq -s '{items: .}' | jq -r -f "$build_scripts/backlog-next.jq"
}

# story <n> <priority>: what next prints for issue n.
story() {
  printf '#%d [%s] story-%d\nhttps://github.com/o/r/issues/%d' "$1" "$2" "$1" "$1"
}

@test "next picks a Must before a Should, and a Should before a Could" {
  run next_of "$(issue 1 - should)" "$(issue 2 - must)" "$(issue 3 - could)"
  [ "$status" -eq 0 ]
  [ "$output" = "$(story 2 must)" ]
  run next_of "$(issue 1 - could)" "$(issue 2 - should)"
  [ "$status" -eq 0 ]
  [ "$output" = "$(story 2 should)" ]
}

@test "next picks the lowest number within a priority" {
  run next_of "$(issue 7 - must)" "$(issue 3 - must)"
  [ "$status" -eq 0 ]
  [ "$output" = "$(story 3 must)" ]
}

@test "next reads priority from the Priority field, in any case" {
  run next_of "$(issue 1 - should)" "$(issue 2 MUST)"
  [ "$status" -eq 0 ]
  [ "$output" = "$(story 2 must)" ]
}

@test "next prefers the Priority field to a priority label" {
  run next_of "$(issue 1 Could must)" "$(issue 2 - should)"
  [ "$status" -eq 0 ]
  [ "$output" = "$(story 2 should)" ]
}

@test "next falls back to the label when the Priority field is cleared" {
  run next_of "$(issue 1 null must)" "$(issue 2 - should)"
  [ "$status" -eq 0 ]
  [ "$output" = "$(story 1 must)" ]
}

@test "next takes the highest of several priority labels" {
  run next_of "$(issue 1 - could must)" "$(issue 2 - should)"
  [ "$status" -eq 0 ]
  [ "$output" = "$(story 1 must)" ]
}

@test "next skips a Wont, and an issue with no priority" {
  run next_of "$(issue 1 - wont)" "$(issue 2 -)" "$(issue 3 - could)"
  [ "$status" -eq 0 ]
  [ "$output" = "$(story 3 could)" ]
}

@test "next prints nothing when no story is ready" {
  run next_of "$(issue 1 - wont)"
  [ "$status" -eq 0 ]
  [ -z "$output" ]
  run jq -r -f "$build_scripts/backlog-next.jq" <<<'{"items": []}'
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

# random_issue <n>: issue n, with a random Priority field, unset or
# cleared, and a random set of priority labels in a random order.
random_issue() {
  local -a fields=(- null Must Should Could Wont) labels=() all=(must should could wont)
  local label i j
  for label in "${all[@]}"; do
    ((RANDOM % 3)) || labels+=("$label")
  done
  for ((i = ${#labels[@]} - 1; i > 0; i--)); do
    j=$((RANDOM % (i + 1)))
    label="${labels[i]}" labels[i]="${labels[j]}" labels[j]="$label"
  done
  issue "$1" "${fields[RANDOM % 6]}" ${labels[@]+"${labels[@]}"}
}

# expected_next <issue JSON>...: what next should print, worked out apart
# from backlog-next.jq. The field wins over labels; among labels, the
# highest priority wins. Then rank Must, Should, Could, then the number.
expected_next() {
  local json n field p rank
  local -A ranks=([must]=0 [should]=1 [could]=2)
  for json in "$@"; do
    n="$(jq -r .number <<<"$json")"
    field="$(jq -r '.issue_field_values[0].single_select_option.name // ""' <<<"$json" | tr A-Z a-z)"
    p="$field"
    if [ -z "$p" ]; then
      for rank in must should could; do
        if jq -e --arg l "priority/$rank" 'any(.labels[]; .name == $l)' <<<"$json" >/dev/null; then
          p="$rank"
          break
        fi
      done
    fi
    if [ -n "$p" ] && [ -n "${ranks[$p]:-}" ]; then echo "${ranks[$p]} $n $p"; fi
  done | sort -n -k1,1 -k2,2 | head -n 1 | {
    read -r _ n p || exit 0
    story "$n" "$p"
  }
}

@test "property: next picks the highest priority, then the lowest number, whatever the order" {
  RANDOM=1
  local round count n issues reversed expected
  local -A seen
  for round in $(seq 40); do
    issues=()
    seen=()
    count=$((RANDOM % 7))
    while [ "${#issues[@]}" -lt "$count" ]; do
      n=$((RANDOM % 20 + 1))
      [ -z "${seen[$n]:-}" ] || continue
      seen[$n]=1
      issues+=("$(random_issue "$n")")
    done
    expected="$(expected_next ${issues[@]+"${issues[@]}"})"
    reversed=()
    for ((n = ${#issues[@]} - 1; n >= 0; n--)); do reversed+=("${issues[n]}"); done

    run next_of ${issues[@]+"${issues[@]}"}
    [ "$status" -eq 0 ] && [ "$output" = "$expected" ] || {
      printf 'issues:\n%s\nexpected:\n%s\ngot:\n%s\n' "$(printf '%s\n' "${issues[@]}")" "$expected" "$output"
      false
    }
    run next_of ${reversed[@]+"${reversed[@]}"}
    [ "$output" = "$expected" ] || { echo "the order of the issues changed the pick"; false; }
  done
}

# issue_with <labels JSON> [assignees JSON]: an issue as GitHub's REST API
# returns it, numbered 7.
issue_with() {
  jq -n --argjson labels "$1" --argjson assignees "${2:-[]}" \
    '{number: 7, labels: [$labels[] | {name: .}], assignees: [$assignees[] | {login: .}]}'
}

# claim <issue JSON>: the gh command backlog-claim.jq gives for the issue.
claim() {
  jq -c -f "$build_scripts/backlog-claim.jq" <<<"$1"
}

@test "claim assigns an unassigned issue to the current user" {
  run claim "$(issue_with '[]')"
  [ "$status" -eq 0 ]
  [ "$output" = '["issue","edit","7","--add-assignee","@me"]' ]
}

@test "claim refuses an issue that already has an assignee" {
  run claim "$(issue_with '[]' '["octocat","hubot"]')"
  [ "$status" -eq 0 ]
  [ "$output" = '{"error":"#7 is already assigned to octocat, hubot. Run backlog.sh next for another story."}' ]
}

# plan <issue JSON> <op> <value> <mode> [field id]: the gh commands
# backlog-plan.jq gives for the write, one compact JSON array per line.
plan() {
  jq -c -f "$shape_scripts/backlog-plan.jq" --arg op "$2" --arg value "$3" \
    --arg mode "$4" --arg field "${5:-}" <<<"$1"
}

@test "set-priority with labels creates the label if needed, adds it, and removes the old one" {
  run plan "$(issue_with '["priority/could","area/ui"]')" set-priority Must labels
  [ "$status" -eq 0 ]
  [ "$output" = '["ensure-label","priority/must","MoSCoW priority: Must"]
["issue","edit","7","--add-label","priority/must","--remove-label","priority/could"]' ]
}

@test "set-priority with fields sets the Priority field, and removes any priority label" {
  run plan "$(issue_with '["priority/must"]')" set-priority Should fields 42
  [ "$status" -eq 0 ]
  [ "$output" = '["api","--method","POST","repos/{owner}/{repo}/issues/7/issue-field-values","-F","issue_field_values[][field_id]=42","-f","issue_field_values[][value]=Should"]
["issue","edit","7","--remove-label","priority/must"]' ]
}

@test "set-kind Epic with labels creates the label if needed, then adds it" {
  run plan "$(issue_with '[]')" set-kind Epic labels
  [ "$status" -eq 0 ]
  [ "$output" = '["ensure-label","kind/epic","A parent issue whose stories are its sub-issues"]
["issue","edit","7","--add-label","kind/epic"]' ]
}

@test "set-kind Story with labels removes the epic label, and does nothing on a story" {
  run plan "$(issue_with '["kind/epic"]')" set-kind Story labels
  [ "$status" -eq 0 ]
  [ "$output" = '["issue","edit","7","--remove-label","kind/epic"]' ]
  run plan "$(issue_with '[]')" set-kind Story labels
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "set-kind with fields sets the issue type, and removes the epic label" {
  run plan "$(issue_with '["kind/epic"]')" set-kind Epic fields
  [ "$status" -eq 0 ]
  [ "$output" = '["issue","edit","7","--type","Epic"]
["issue","edit","7","--remove-label","kind/epic"]' ]
}

@test "a write refuses a value it does not know" {
  run plan "$(issue_with '[]')" set-priority High labels
  [ "$status" -eq 0 ]
  [ "$output" = "{\"error\":\"priority must be Must, Should, Could or Wont, got 'High'.\"}" ]
  run plan "$(issue_with '[]')" set-kind Bug labels
  [ "$status" -eq 0 ]
  [ "$output" = "{\"error\":\"kind must be Epic or Story, got 'Bug'.\"}" ]
}

# apply_plan <plan> <label>...: the issue's labels once gh has run the plan,
# one per line, sorted. Fails if the plan adds a label it did not first ask
# to create.
apply_plan() {
  local plan="$1" line flag
  shift
  local -A have=() ensured=()
  local -a args
  for flag in "$@"; do [ -z "$flag" ] || have[$flag]=1; done
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    eval "args=($line)"
    case "${args[0]}" in
      ensure-label) ensured[${args[1]}]=1 ;;
      issue)
        set -- "${args[@]:3}"
        while [ $# -gt 0 ]; do
          case "$1" in
            --add-label)
              [ -n "${ensured[$2]:-}" ] || { echo "added $2 without creating it"; return 1; }
              have[$2]=1
              ;;
            --remove-label)
              local name
              for name in ${2//,/ }; do unset "have[$name]"; done
              ;;
          esac
          shift 2
        done
        ;;
    esac
  done < <(jq -r '@sh' <<<"$plan")
  printf '%s\n' "${!have[@]}" | grep -v '^$' | sort || true
}

# expected_labels <op> <value> <mode> <label>...: the labels a write should
# leave, worked out apart from backlog-plan.jq.
expected_labels() {
  local op="$1" value="$2" mode="$3"
  shift 3
  {
    printf '%s\n' "$@" | grep -v '^$' |
      if [ "$op" = set-priority ]; then grep -v '^priority/'; else grep -vx kind/epic; fi
    if [ "$op" = set-priority ] && [ "$mode" = labels ]; then
      echo "priority/$(tr A-Z a-z <<<"$value")"
    fi
    if [ "$op" = set-kind ] && [ "$mode" = labels ] && [ "$value" = Epic ]; then
      echo kind/epic
    fi
  } | sort
}

@test "property: a write sets what it is asked to, keeps every other label, and a second run changes nothing" {
  RANDOM=1
  local -a all=(priority/must priority/should priority/could priority/wont kind/epic area/ui)
  local -a priorities=(Must Should Could Wont) kinds=(Epic Story) modes=(labels fields)
  local round op value mode labels label json after again expected
  for round in $(seq 60); do
    labels=()
    for label in "${all[@]}"; do
      ((RANDOM % 2)) || labels+=("$label")
    done
    mode="${modes[RANDOM % 2]}"
    if ((RANDOM % 2)); then
      op=set-priority value="${priorities[RANDOM % 4]}"
    else
      op=set-kind value="${kinds[RANDOM % 2]}"
    fi
    json="$(issue_with "$(printf '%s\n' ${labels[@]+"${labels[@]}"} | grep -v '^$' | jq -R . | jq -cs .)")"
    expected="$(expected_labels "$op" "$value" "$mode" ${labels[@]+"${labels[@]}"})"

    after="$(apply_plan "$(plan "$json" "$op" "$value" "$mode" 42)" ${labels[@]+"${labels[@]}"})"
    [ "$after" = "$expected" ] || {
      printf '%s %s in %s mode on: %s\nexpected:\n%s\ngot:\n%s\n' "$op" "$value" "$mode" "${labels[*]:-}" "$expected" "$after"
      false
    }

    mapfile -t labels <<<"$after"
    json="$(issue_with "$(printf '%s\n' ${labels[@]+"${labels[@]}"} | grep -v '^$' | jq -R . | jq -cs .)")"
    again="$(apply_plan "$(plan "$json" "$op" "$value" "$mode" 42)" ${labels[@]+"${labels[@]}"})"
    [ "$again" = "$after" ] || { printf 'a second %s %s changed the labels to:\n%s\n' "$op" "$value" "$again"; false; }
  done
}
