# For the lets-sync tests. Load after common and release.
#
# Each test file builds one release, $release, in setup_file. Each test then
# gets $project: a fresh git repo, and the working directory, holding only
# openspec/config.yaml set to the standard schema.

setup_file() {
  export release="$BATS_FILE_TMPDIR/store/abc-lets-spec-release"
  make_release "$release"
}

teardown_file() {
  chmod -R u+w "$BATS_FILE_TMPDIR"
}

setup() {
  project="$BATS_TEST_TMPDIR/project"
  mkdir -p "$project/openspec"
  git -C "$project" init --quiet
  cd "$project"
  printf 'schema: lets-standard\n' >openspec/config.yaml
}

# store_release <hash> [extra skill...]: build another release in the test's
# own store folder, and print its path.
store_release() {
  local dir="$BATS_TEST_TMPDIR/store/$1-lets-spec-release"
  shift
  make_release "$dir" "$@"
  echo "$dir"
}

# Run lets-sync from bin/, with WORKFLOW_RELEASE pointing at $release,
# as the Nix wrapper does. A test can name another release by setting
# WORKFLOW_RELEASE for one call.
sync_project() {
  WORKFLOW_RELEASE="${WORKFLOW_RELEASE:-$release}" bash "$repo/bin/lets-sync.sh" "$@"
}

# Run lets-sync once and check that it succeeded, so the project has its
# files and links, and a test sees only the problem it sets up.
init_project() {
  run sync_project
  [ "$status" -eq 0 ]
}

# Set or delete a key in openspec/config.yaml, such as `.schema = "x"`.
edit_config() {
  yq -i "$1" openspec/config.yaml
}

# Every skill the release ships, by folder name.
shipped_skills() {
  local dir
  for dir in "$release"/overlay/.agents/skills/*/; do
    basename "$dir"
  done
}

# rules_in <file>: print the text between the lets-spec rules markers.
rules_in() {
  sed -n '/^<!-- BEGIN lets-spec rules/,/^<!-- END lets-spec rules -->$/p' "$1" | sed '1d;$d'
}

# The release's rules, as lets-sync writes them between the markers.
fragment() {
  cat "$release/fragments/AGENTS.md"
}

# Print every path in the project with its type, mode, and content hash or
# link target, so two snapshots differ when anything in it changed. Covers
# .git/info but not git's own objects.
snapshot() {
  find . -path ./.git -prune -o -print | sort | while IFS= read -r path; do
    if [ -L "$path" ]; then
      echo "$path -> $(readlink "$path")"
    elif [ -f "$path" ]; then
      echo "$path $(stat -c %a "$path") $(cksum <"$path")"
    else
      echo "$path/ $(stat -c %a "$path")"
    fi
  done
  cat .git/info/exclude 2>/dev/null || true
}
