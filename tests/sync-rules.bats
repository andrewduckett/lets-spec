load support/common
load support/release
load support/project

# lets-spec-sync keeps the release's rules in a marked block of the project's
# AGENTS.md. The project owns the rest of the file. --check reports on the
# block and changes nothing.

stale_block=$'<!-- BEGIN lets-spec rules -->\nold rules\n<!-- END lets-spec rules -->\n'

@test "sync creates AGENTS.md holding only the rules block" {
  run sync_project
  [ "$status" -eq 0 ]
  [ "$(rules_in AGENTS.md)" = "$(fragment)" ]
  [ "$(grep -vc 'lets-spec rules' AGENTS.md)" -eq "$(fragment | wc -l)" ]
  [[ "$output" == *"created AGENTS.md"* ]]
}

@test "sync appends the rules after a blank line, and keeps the project's text" {
  printf '# My project\n' >AGENTS.md
  run sync_project
  [ "$status" -eq 0 ]
  [ "$(sed -n 1p AGENTS.md)" = "# My project" ]
  [ -z "$(sed -n 2p AGENTS.md)" ]
  [ "$(rules_in AGENTS.md)" = "$(fragment)" ]
  [[ "$output" == *"added the lets-spec rules to AGENTS.md"* ]]
}

@test "sync ends the project's last line before it appends the rules" {
  printf '# My project' >AGENTS.md
  sync_project
  [ "$(sed -n 1p AGENTS.md)" = "# My project" ]
  [ -z "$(sed -n 2p AGENTS.md)" ]
  [[ "$(sed -n 3p AGENTS.md)" == "<!-- BEGIN lets-spec rules"* ]]
}

@test "sync replaces stale rules, and keeps every byte around them" {
  init_project
  cp AGENTS.md "$BATS_TEST_TMPDIR/block"

  # Text that awk, sed or a shell could mangle.
  local -a around=(
    ""
    $'# My project\n\n'
    $'A backslash \\n, a double \\\\ and an & \n'
    $'Tabs\tand trailing spaces  \n'
    $'Unicode: \xc3\xa9 \xe2\x80\x94 \xe2\x86\x92\n'
    $'A Windows line\r\n'
    $'Inline <!-- BEGIN lets-spec rules --> is not a marker\n'
  )
  local before after expected
  for before in "${around[@]}"; do
    for after in "${around[@]}" "Notes without a final newline"; do
      printf '%s%s%s' "$before" "$stale_block" "$after" >AGENTS.md
      # A file that lacks a final newline gains one.
      expected="$after"
      [ -z "$after" ] || [ "${after: -1}" = $'\n' ] || expected+=$'\n'
      { printf '%s' "$before"; cat "$BATS_TEST_TMPDIR/block"; printf '%s' "$expected"; } >"$BATS_TEST_TMPDIR/expected"

      run sync_project
      [ "$status" -eq 0 ]
      cmp "$BATS_TEST_TMPDIR/expected" AGENTS.md || {
        printf 'before: %q\nafter: %q\n' "$before" "$after"
        false
      }
      [[ "$output" == *"updated the lets-spec rules in AGENTS.md"* ]]
    done
  done
}

@test "sync leaves current rules unchanged" {
  init_project
  printf '# Before\n\n%s\n## After\n' "$(cat AGENTS.md)" >AGENTS.md
  cp AGENTS.md before
  run sync_project
  [ "$status" -eq 0 ]
  [ -z "$output" ]
  cmp before AGENTS.md
}

@test "sync keeps a backslash in the rules as written" {
  release="$(store_release backslash)"
  chmod -R u+w "$release"
  echo 'Run `printf "a\nb"`.' >>"$release/fragments/AGENTS.md"
  printf '%s' "$stale_block" >AGENTS.md
  sync_project
  grep -qxF 'Run `printf "a\nb"`.' AGENTS.md
}

@test "sync writes through a linked AGENTS.md, and keeps its mode" {
  mkdir docs
  printf '%s' "$stale_block" >docs/AGENTS.md
  chmod 600 docs/AGENTS.md
  ln -s docs/AGENTS.md AGENTS.md
  run sync_project
  [ "$status" -eq 0 ]
  [ "$(readlink AGENTS.md)" = docs/AGENTS.md ]
  [ "$(stat -c %a docs/AGENTS.md)" = 600 ]
  [ "$(rules_in docs/AGENTS.md)" = "$(fragment)" ]
}

@test "sync leaves rules with an unpaired marker unchanged, and warns" {
  init_project
  local begin end
  begin="$(head -n 1 AGENTS.md)"
  end="$(tail -n 1 AGENTS.md)"
  local -a broken=(
    "$begin"$'\nrules\n'
    $'rules\n'"$end"$'\n'
    "$end"$'\nrules\n'"$begin"$'\n'
    "$begin"$'\n'"$begin"$'\nrules\n'"$end"$'\n'
  )
  local text
  for text in "${broken[@]}"; do
    printf '# Mine\n%s' "$text" >AGENTS.md
    cp AGENTS.md before
    run sync_project
    [ "$status" -eq 0 ]
    cmp before AGENTS.md || { printf 'text: %q\n' "$text"; false; }
    [[ "$output" == *"AGENTS.md has a lets-spec rules marker without its pair"* ]]
  done
}

@test "check passes when the rules are current" {
  init_project
  run sync_project --check
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "check fails when the rules are stale" {
  init_project
  printf '%s' "$stale_block" >AGENTS.md
  run sync_project --check
  [ "$status" -eq 1 ]
  [[ "$output" == *"AGENTS.md's lets-spec rules are out of date"* ]]
}

@test "check fails when AGENTS.md has no rules" {
  echo "# My project" >AGENTS.md
  run sync_project --check
  [ "$status" -eq 1 ]
  [[ "$output" == *"AGENTS.md has no lets-spec rules"* ]]
}

@test "check fails when there is no AGENTS.md" {
  run sync_project --check
  [ "$status" -eq 1 ]
  [[ "$output" == *"AGENTS.md has no lets-spec rules"* ]]
}

@test "check fails when a rules marker has no pair" {
  init_project
  sed -i '$d' AGENTS.md
  run sync_project --check
  [ "$status" -eq 1 ]
  [[ "$output" == *"AGENTS.md has a lets-spec rules marker without its pair"* ]]
}

@test "check changes nothing in the project" {
  init_project
  printf '%s' "$stale_block" >AGENTS.md
  rm .agents/skills/lets-build
  snapshot >"$BATS_TEST_TMPDIR/before"
  run sync_project --check
  [ "$status" -eq 1 ]
  snapshot | diff "$BATS_TEST_TMPDIR/before" -
}
