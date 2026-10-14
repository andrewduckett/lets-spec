load support/common

# Each schema, read by the pinned OpenSpec CLI as a project links it in.
# lets-build trusts what the CLI reports about a change, so these tests pin
# that for every schema. Each test runs once for each schema.

schemas=(lets-standard lets-minimal)

export OPENSPEC_TELEMETRY=0 OPENSPEC_NO_UPDATE_CHECK=1

# new_change <schema>: a project linked to the schema, with one change named
# demo, as the working directory.
new_change() {
  local dir="$BATS_TEST_TMPDIR/$1"
  mkdir -p "$dir/openspec/schemas"
  cd "$dir"
  ln -s "$repo/schemas/$1" "openspec/schemas/$1"
  printf 'schema: %s\n' "$1" >openspec/config.yaml
  openspec new change demo </dev/null >/dev/null 2>&1
  change=openspec/changes/demo
}

# Write to a file first: the CLI spins if a reader closes the pipe early,
# and a failure then shows here, not as empty output.
status_json() {
  openspec status --change demo --json </dev/null >"$BATS_TEST_TMPDIR/status.json" 2>/dev/null
  cat "$BATS_TEST_TMPDIR/status.json"
}

apply_state() {
  openspec instructions apply --change demo --json </dev/null >"$BATS_TEST_TMPDIR/apply.json" 2>/dev/null
  jq -r .state "$BATS_TEST_TMPDIR/apply.json"
}

# artifact_ids <schema>: the schema's artifacts, in the order it lists them.
artifact_ids() {
  yq -r '.artifacts[].id' "$repo/schemas/$1/schema.yaml"
}

# write_artifact <schema> <id>: write the file the artifact generates, from
# its template, with the brainstorm confirmed and the tasks still to do.
write_artifact() {
  local generates
  generates="$(yq -r ".artifacts[] | select(.id == \"$2\") | .generates" "$repo/schemas/$1/schema.yaml")"
  case "$generates" in
    specs/*)
      mkdir -p "$change/specs/greeting"
      cat >"$change/specs/greeting/spec.md" <<'EOF'
## ADDED Requirements

### Requirement: Greet by name
The app SHALL greet a known user by name when it opens.

#### Scenario: Known user opens the app
- **WHEN** a known user named Ada opens the app
- **THEN** the app shows "Hello, Ada"
EOF
      ;;
    tasks.md) printf '## 1. Greeting\n\n- [ ] 1.1 Greet a known user by name\n' >"$change/tasks.md" ;;
    *) sed 's/^Confirmed by user: no$/Confirmed by user: yes/' "$repo/schemas/$1/templates/$generates" >"$change/$generates" ;;
  esac
}

finish_change() {
  local id
  for id in $(artifact_ids "$1"); do
    write_artifact "$1" "$id"
  done
  sed -i 's/- \[ \]/- [x]/' "$change/tasks.md"
}

@test "each schema is valid" {
  local schema
  for schema in "${schemas[@]}"; do
    new_change "$schema"
    run openspec schema validate "$schema" </dev/null
    [ "$status" -eq 0 ] || { echo "$schema: $output"; false; }
  done
}

# expected_statuses <schema> <written id>...: each artifact's status, worked
# out from the schema's requires: done once written, ready once all it
# requires is written, and blocked before.
expected_statuses() {
  local schema="$1"
  shift
  yq -o json '.artifacts' "$repo/schemas/$schema/schema.yaml" |
    jq -r --args '$ARGS.positional as $done
      | .[] | "\(.id) \(if (.id | IN($done[])) then "done"
                      elif all(.requires[]?; IN($done[])) then "ready"
                      else "blocked" end)"' "$@"
}

@test "each artifact becomes ready exactly when all it requires is written" {
  local schema id written expected actual
  for schema in "${schemas[@]}"; do
    new_change "$schema"
    written=()
    for id in "" $(artifact_ids "$schema"); do
      if [ -n "$id" ]; then
        write_artifact "$schema" "$id"
        written+=("$id")
      fi
      expected="$(expected_statuses "$schema" ${written[@]+"${written[@]}"})"
      actual="$(status_json | jq -r '.artifacts[] | "\(.id) \(.status)"')"
      [ "$actual" = "$expected" ] || {
        printf '%s, after writing: %s\nexpected:\n%s\ngot:\n%s\n' "$schema" "${written[*]:-nothing}" "$expected" "$actual"
        false
      }
    done
  done
}

# lets-build reads these three states, and stops on any other.
@test "apply reports blocked, then ready, then all_done as a change moves" {
  local schema id
  for schema in "${schemas[@]}"; do
    new_change "$schema"
    [ "$(apply_state)" = blocked ] || { echo "$schema: not blocked"; false; }
    for id in $(artifact_ids "$schema"); do
      write_artifact "$schema" "$id"
    done
    [ "$(apply_state)" = ready ] || { echo "$schema: not ready"; false; }
    sed -i 's/- \[ \]/- [x]/' "$change/tasks.md"
    [ "$(apply_state)" = all_done ] || { echo "$schema: not all_done"; false; }
  done
}

@test "a finished change passes strict validation, and archives into a main spec" {
  local schema
  for schema in "${schemas[@]}"; do
    new_change "$schema"
    finish_change "$schema"
    run openspec validate demo --strict </dev/null
    [ "$status" -eq 0 ] || { echo "$schema: $output"; false; }
    run openspec archive demo --yes </dev/null
    [ "$status" -eq 0 ] || { echo "$schema: $output"; false; }
    grep -q 'Requirement: Greet by name' openspec/specs/greeting/spec.md
    [ ! -e "$change" ]
  done
}
