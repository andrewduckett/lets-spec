load support/common
load support/release
load support/project

# lets-sync links each skill and the schema from the release into the
# project, and lists the links in a section of .git/info/exclude, so git
# ignores them. The section is also its record of what to clean up.

# managed_links: every path lets-sync should link in this project.
managed_links() {
  local skill
  for skill in $(shipped_skills); do
    echo ".agents/skills/$skill"
  done
  echo openspec/schemas/standard
}

@test "sync links each skill and the schema into the release" {
  init_project
  local skill
  for skill in $(shipped_skills); do
    [ "$(readlink ".agents/skills/$skill")" = "$release/overlay/.agents/skills/$skill" ]
  done
  [ "$(readlink openspec/schemas/standard)" = "$release/overlay/openspec/schemas/standard" ]
}

@test "sync makes every file the release ships reachable at the same path" {
  init_project
  local file
  while IFS= read -r file; do
    [ "$(readlink -f "$file")" = "$release/overlay/$file" ] || { echo "not linked: $file"; false; }
  done < <(cd "$release/overlay" && find . -type f | sed 's#^\./##')
}

@test "git ignores every link, so none can be committed" {
  init_project
  local link
  for link in $(managed_links); do
    git check-ignore -q "$link" || { echo "not ignored: $link"; false; }
  done
  git add -A
  [ -z "$(git ls-files .agents openspec/schemas)" ]
}

@test "a second sync is quiet and changes nothing" {
  init_project
  snapshot >"$BATS_TEST_TMPDIR/before"
  run sync_project
  [ "$status" -eq 0 ]
  [ -z "$output" ]
  snapshot | diff "$BATS_TEST_TMPDIR/before" -
}

@test "sync keeps every byte of the project's own exclude lines" {
  local exclude=.git/info/exclude
  local -a own=(
    ""
    $'/local-notes\n'
    $'# A comment\n*.log\n\n'
    $'!/keep-me\n/\xc3\xa9t\xc3\xa9\n'
  )
  local before after section
  for before in "${own[@]}"; do
    for after in "${own[@]}"; do
      printf '%s' "$before" >"$exclude"
      run sync_project
      [ "$status" -eq 0 ]
      section="$(sed -n '/^# BEGIN lets-spec links/,/^# END lets-spec links$/p' "$exclude")"
      printf '%s' "$after" >>"$exclude"
      run sync_project
      [ "$status" -eq 0 ]
      # The project's lines keep their order, and the section moves last.
      printf '%s%s%s\n' "$before" "$after" "$section" | cmp - "$exclude" || {
        printf 'before: %q\nafter: %q\n' "$before" "$after"
        false
      }
    done
  done
}

@test "sync leaves an exclude section with an unpaired marker unchanged, links nothing, and warns" {
  local exclude=.git/info/exclude
  local -a broken=(
    $'# BEGIN lets-spec links. lets-sync rewrites this section.\n/.agents/skills/lets-build\n/mine\n'
    $'/mine\n# END lets-spec links\n'
    $'# END lets-spec links\n/mine\n# BEGIN lets-spec links. lets-sync rewrites this section.\n'
  )
  local text
  for text in "${broken[@]}"; do
    rm -rf .agents openspec/schemas
    printf '%s' "$text" >"$exclude"
    cp "$exclude" before
    run sync_project
    [ "$status" -eq 0 ]
    cmp before "$exclude" || { printf 'text: %q\n' "$text"; false; }
    [ ! -e .agents/skills/lets-build ]
    [[ "$output" == *"has a lets-spec links marker without its pair"* ]]
  done
}

@test "sync links the release in a git worktree, and git ignores the links there" {
  init_project
  git add -A
  git commit --quiet -m init
  git worktree add --quiet "$BATS_TEST_TMPDIR/tree"
  cd "$BATS_TEST_TMPDIR/tree"
  run sync_project
  [ "$status" -eq 0 ]
  [ -L .agents/skills/lets-build ]
  git check-ignore -q .agents/skills/lets-build
}

@test "sync moves its links to a new release" {
  WORKFLOW_RELEASE="$(store_release old)" init_project
  run sync_project
  [ "$status" -eq 0 ]
  [ "$(readlink .agents/skills/lets-build)" = "$release/overlay/.agents/skills/lets-build" ]
  [ "$(readlink openspec/schemas/standard)" = "$release/overlay/openspec/schemas/standard" ]
}

@test "sync removes a skill an earlier release shipped and this one does not" {
  WORKFLOW_RELEASE="$(store_release old renamed-skill)" init_project
  [ -L .agents/skills/renamed-skill ]
  run sync_project
  [ "$status" -eq 0 ]
  [ ! -L .agents/skills/renamed-skill ]
  run grep -qxF /.agents/skills/renamed-skill .git/info/exclude
  [ "$status" -eq 1 ]
}

@test "sync keeps a dropped skill's path once the project has put its own copy there" {
  WORKFLOW_RELEASE="$(store_release old renamed-skill)" init_project
  rm .agents/skills/renamed-skill
  mkdir .agents/skills/renamed-skill
  echo mine >.agents/skills/renamed-skill/SKILL.md
  run sync_project
  [ "$status" -eq 0 ]
  [ "$(cat .agents/skills/renamed-skill/SKILL.md)" = mine ]
}

@test "sync replaces its own link when the store path is gone" {
  init_project
  ln -sfn "$BATS_TEST_TMPDIR/store/gone-lets-spec-release/overlay/.agents/skills/lets-build" .agents/skills/lets-build
  run sync_project
  [ "$status" -eq 0 ]
  [ "$(readlink .agents/skills/lets-build)" = "$release/overlay/.agents/skills/lets-build" ]
}

# own <kind> <path>: put something the project owns at <path>.
own() {
  mkdir -p "$(dirname "$2")"
  case "$1" in
    file) echo mine >"$2" ;;
    folder) mkdir -p "$2" && echo mine >"$2/SKILL.md" ;;
    link) mkdir -p mine && ln -s ../../mine "$2" ;;
    dangling-link) ln -s ../../nowhere "$2" ;;
  esac
}

@test "sync never replaces what the project owns at a path it would link, and says how to remove it" {
  local kind path
  for path in .agents/skills/lets-build openspec/schemas/standard; do
    for kind in file folder link dangling-link; do
      rm -rf .agents openspec/schemas mine .git/info/exclude
      own "$kind" "$path"
      local before
      before="$(snapshot)"
      run sync_project
      [ "$status" -eq 0 ]
      [ "$(snapshot | grep -F "./$path")" = "$(grep -F "./$path" <<<"$before")" ] ||
        { echo "replaced: $kind at $path"; false; }
      [[ "$output" == *"$path belongs to the project"*"git rm -r $path"* ]]
      run grep -qxF "/$path" .git/info/exclude
      [ "$status" -eq 1 ]
    done
  done
}

@test "sync leaves the project's own skills alone" {
  own folder .agents/skills/visual-options
  run sync_project
  [ "$status" -eq 0 ]
  [ ! -L .agents/skills/visual-options ]
  [ "$(cat .agents/skills/visual-options/SKILL.md)" = mine ]
}

@test "sync links a minimal release's schema, and only its skills" {
  local minimal="$BATS_TEST_TMPDIR/store/min-lets-spec-release"
  build "$minimal" minimal labels test-driven-development
  edit_config '.schema = "minimal"'
  WORKFLOW_RELEASE="$minimal" init_project
  WORKFLOW_RELEASE="$minimal" run sync_project
  [ "$status" -eq 0 ]
  [ -z "$output" ]
  [ "$(readlink openspec/schemas/minimal)" = "$minimal/overlay/openspec/schemas/minimal" ]
  [ ! -e .agents/skills/lets-build ]
}
