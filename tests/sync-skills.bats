load support/common
load support/release
load support/project

# lets-sync copies each skill and the schema from the release into the
# project. LETS_SPEC_SKILLS decides whether git tracks the copies:
# committed, the default, or ignored through a marked block in .gitignore.

skills_block=$'# BEGIN lets-spec skills. lets-sync rewrites this block: change lets-spec, not this text.\n/.agents/skills/lets-*\n/.agents/skills/openspec-*\n/openspec/schemas/lets-*\n# END lets-spec skills\n'

# managed_paths: every path lets-sync should write in this project.
managed_paths() {
  local skill
  for skill in $(shipped_skills); do
    echo ".agents/skills/$skill"
  done
  echo openspec/schemas/lets-standard
}

# release_files: every file the release ships, relative to its overlay.
release_files() {
  (cd "$release/overlay" && find . -type f | sed 's#^\./##' | sort)
}

# edit_copy <path>: change a copied file.
edit_copy() {
  echo "a local edit" >>"$1"
}

@test "sync copies each skill and the schema into the project" {
  init_project
  local file
  while IFS= read -r file; do
    [ ! -L "$file" ] || { echo "a link: $file"; false; }
    cmp "$release/overlay/$file" "$file" || { echo "differs: $file"; false; }
  done < <(release_files)
  [ -z "$(find .agents/skills openspec/schemas -type l)" ]
}

@test "a script keeps its executable bit" {
  init_project
  [ "$(stat -c %a .agents/skills/lets-build/scripts/backlog.sh)" = 755 ]
  [ "$(stat -c %a .agents/skills/lets-build/SKILL.md)" = 644 ]
  bash .agents/skills/lets-build/scripts/backlog.sh --help
}

@test "a fresh clone of a committed project passes --check and syncs quietly" {
  init_project
  git add -A
  git commit --quiet -m init
  git clone --quiet "$project" "$BATS_TEST_TMPDIR/clone"
  cd "$BATS_TEST_TMPDIR/clone"
  run sync_project --check
  [ "$status" -eq 0 ]
  [ -z "$output" ]
  run sync_project
  [ "$status" -eq 0 ]
  [[ "$output" != *"wrote"* ]]
}

@test "sync copies the release in a git worktree, and git tracks the copies there" {
  init_project
  git add -A
  git commit --quiet -m init
  git worktree add --quiet "$BATS_TEST_TMPDIR/tree"
  cd "$BATS_TEST_TMPDIR/tree"
  run sync_project
  [ "$status" -eq 0 ]
  [[ "$output" != *"wrote"* ]]
  [ -f .agents/skills/lets-build/SKILL.md ]
  ! git check-ignore -q .agents/skills/lets-build
}

@test "git does not ignore a managed path" {
  init_project
  local path
  for path in $(managed_paths); do
    ! git check-ignore -q "$path" || { echo "ignored: $path"; false; }
  done
  git add -A
  [ -n "$(git ls-files .agents/skills/lets-build openspec/schemas/lets-standard)" ]
}

@test "a second sync is quiet and changes nothing" {
  init_project
  snapshot >"$BATS_TEST_TMPDIR/before"
  run sync_project
  [ "$status" -eq 0 ]
  [ -z "$output" ]
  snapshot | diff "$BATS_TEST_TMPDIR/before" -
}

@test "a changed file is rewritten and reported" {
  init_project
  edit_copy .agents/skills/lets-build/SKILL.md
  run sync_project
  [ "$status" -eq 0 ]
  [[ "$output" == *"lets-spec: wrote 1 files. Commit them."* ]]
  cmp "$release/overlay/.agents/skills/lets-build/SKILL.md" .agents/skills/lets-build/SKILL.md
}

@test "a skill the new release no longer ships is removed" {
  WORKFLOW_RELEASE="$(store_release old lets-retired)" init_project
  [ -f .agents/skills/lets-retired/SKILL.md ]
  run sync_project
  [ "$status" -eq 0 ]
  [ ! -e .agents/skills/lets-retired ]
  [[ "$output" == *"lets-spec: removed .agents/skills/lets-retired."* ]]
}

@test "a skill of another name is left alone" {
  mkdir -p .agents/skills/brainstorming
  echo mine >.agents/skills/brainstorming/SKILL.md
  run sync_project
  [ "$status" -eq 0 ]
  [ "$(cat .agents/skills/brainstorming/SKILL.md)" = mine ]
}

@test "a project synced by the linked layout becomes copied" {
  # Lay the project out as the bash lets-sync did: a link at each managed
  # path into a store-named release, and a section in .git/info/exclude.
  local old="$BATS_TEST_TMPDIR/store/abc-lets-spec-release" path
  make_release "$old"
  mkdir -p .agents/skills openspec/schemas
  printf '/local-notes\n# BEGIN lets-spec links. lets-sync rewrites this section.\n' >.git/info/exclude
  for path in $(managed_paths); do
    ln -s "$old/overlay/$path" "$path"
    echo "/$path" >>.git/info/exclude
  done
  echo "# END lets-spec links" >>.git/info/exclude
  git check-ignore -q .agents/skills/lets-build

  run sync_project
  [ "$status" -eq 0 ]
  [ -z "$(find .agents/skills openspec/schemas -type l)" ]
  [ "$(cat .git/info/exclude)" = /local-notes ]
  for path in $(managed_paths); do
    [ -d "$path" ] || { echo "not a folder: $path"; false; }
    ! git check-ignore -q "$path" || { echo "ignored: $path"; false; }
  done
  [[ "$output" == *"lets-spec: wrote $(release_files | wc -l) files. Commit them."* ]]
}

@test "ignored mode writes the gitignore block and git ignores every managed path" {
  LETS_SPEC_SKILLS=ignored run sync_project
  [ "$status" -eq 0 ]
  [[ "$output" == *"lets-spec: added the lets-spec skills block to .gitignore. Run: git rm -r --cached .agents/skills/lets-* .agents/skills/openspec-* openspec/schemas/lets-*, then commit."* ]]
  printf '%s' "$skills_block" | cmp - .gitignore
  local path
  for path in $(managed_paths); do
    git check-ignore -q "$path" || { echo "not ignored: $path"; false; }
  done
  LETS_SPEC_SKILLS=ignored run sync_project
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "ignored mode keeps every byte of the project's own gitignore" {
  local -a own=(
    ""
    $'/local-notes\n'
    $'# A comment\n*.log\n\n'
    $'!/keep-me\n/\xc3\xa9t\xc3\xa9\n'
  )
  local stale=$'# BEGIN lets-spec skills. lets-sync rewrites this block: change lets-spec, not this text.\n/old\n# END lets-spec skills\n'
  local before after
  for before in "${own[@]}"; do
    for after in "${own[@]}"; do
      # The block is appended after a blank line.
      printf '%s' "$before" >.gitignore
      LETS_SPEC_SKILLS=ignored run sync_project
      [ "$status" -eq 0 ]
      printf '%s\n%s' "$before" "$skills_block" | cmp - .gitignore || {
        printf 'appended. before: %q\n' "$before"
        false
      }
      # A current block stays where it is.
      printf '%s' "$after" >>.gitignore
      LETS_SPEC_SKILLS=ignored run sync_project
      [ "$status" -eq 0 ]
      printf '%s\n%s%s' "$before" "$skills_block" "$after" | cmp - .gitignore || {
        printf 'kept. before: %q\nafter: %q\n' "$before" "$after"
        false
      }
      # A stale block is rewritten in place.
      printf '%s%s%s' "$before" "$stale" "$after" >.gitignore
      LETS_SPEC_SKILLS=ignored run sync_project
      [ "$status" -eq 0 ]
      [[ "$output" == *"lets-spec: updated the lets-spec skills block in .gitignore. Commit it."* ]]
      printf '%s%s%s' "$before" "$skills_block" "$after" | cmp - .gitignore || {
        printf 'rewritten. before: %q\nafter: %q\n' "$before" "$after"
        false
      }
    done
  done
}

@test "ignored mode leaves a block with an unpaired marker unchanged, and warns" {
  printf '/mine\n# END lets-spec skills\n' >.gitignore
  cp .gitignore before
  LETS_SPEC_SKILLS=ignored run sync_project
  [ "$status" -eq 0 ]
  cmp before .gitignore
  [[ "$output" == *"problem(s) to fix"*".gitignore has a lets-spec skills marker without its pair"* ]]
}

@test "switching to committed removes the block and says what to add" {
  printf '/local-notes\n' >.gitignore
  LETS_SPEC_SKILLS=ignored init_project
  run sync_project
  [ "$status" -eq 0 ]
  [[ "$output" == *"lets-spec: removed the lets-spec skills block from .gitignore. Run: git add .agents/skills openspec/schemas, then commit."* ]]
  [ "$(cat .gitignore)" = /local-notes ]
  ! git check-ignore -q .agents/skills/lets-build
}

@test "switching to committed leaves an empty gitignore when it held only the block" {
  LETS_SPEC_SKILLS=ignored init_project
  run sync_project
  [ "$status" -eq 0 ]
  [ -f .gitignore ]
  [ ! -s .gitignore ]
}

@test "committed mode leaves a block with an unpaired marker unchanged, and warns" {
  printf '/mine\n# END lets-spec skills\n' >.gitignore
  cp .gitignore before
  run sync_project
  [ "$status" -eq 0 ]
  cmp before .gitignore
  [[ "$output" == *"problem(s) to fix"*".gitignore has a lets-spec skills marker without its pair, so its block was not updated."* ]]
}

@test "--check in committed mode fails on an unpaired marker in .gitignore" {
  init_project
  printf '# BEGIN lets-spec skills. lets-sync rewrites this block: change lets-spec, not this text.\n/mine\n' >.gitignore
  run sync_project --check
  [ "$status" -eq 1 ]
  [[ "$output" == *"lets-spec: .gitignore still has the lets-spec skills block. Run lets-sync, then commit .gitignore."* ]]
}

@test "switching to ignored says what to untrack" {
  init_project
  LETS_SPEC_SKILLS=ignored run sync_project
  [ "$status" -eq 0 ]
  [[ "$output" == *"Run: git rm -r --cached .agents/skills/lets-* .agents/skills/openspec-* openspec/schemas/lets-*, then commit."* ]]
  git check-ignore -q .agents/skills/lets-build
}

@test "--check fails on a stale file and names it" {
  init_project
  edit_copy .agents/skills/lets-build/SKILL.md
  run sync_project --check
  [ "$status" -eq 1 ]
  [[ "$output" == *"lets-spec: .agents/skills/lets-build/SKILL.md is out of date. Run lets-sync, then commit it."* ]]
}

@test "--check fails on a missing skill and on an extra file" {
  init_project
  rm -r .agents/skills/lets-shape
  echo extra >.agents/skills/lets-build/extra.md
  run sync_project --check
  [ "$status" -eq 1 ]
  [[ "$output" == *".agents/skills/lets-shape/SKILL.md is out of date"* ]]
  [[ "$output" == *".agents/skills/lets-build/extra.md is out of date"* ]]
}

@test "--check in committed mode fails while .gitignore still has the block" {
  LETS_SPEC_SKILLS=ignored init_project
  run sync_project --check
  [ "$status" -eq 1 ]
  [[ "$output" == *"lets-spec: .gitignore still has the lets-spec skills block. Run lets-sync, then commit .gitignore."* ]]
}

@test "--check in ignored mode passes without the skills present" {
  LETS_SPEC_SKILLS=ignored init_project
  rm -r .agents/skills
  LETS_SPEC_SKILLS=ignored run sync_project --check
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "--check in ignored mode fails without a current block" {
  init_project
  LETS_SPEC_SKILLS=ignored run sync_project --check
  [ "$status" -eq 1 ]
  [[ "$output" == *"lets-spec: .gitignore has no current lets-spec skills block. Run lets-sync, then commit .gitignore."* ]]
}

@test "an unknown LETS_SPEC_SKILLS is a usage error" {
  LETS_SPEC_SKILLS=tracked run sync_project
  [ "$status" -eq 1 ]
  [[ "$output" == *"error: LETS_SPEC_SKILLS must be committed or ignored, got 'tracked'."* ]]
  [ ! -e AGENTS.md ]
}
