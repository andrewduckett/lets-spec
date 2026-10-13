# Build releases with nix/build-release.sh, as the flake does.

# The skills a test release ships. A fixture, not a copy of flows.nix: it
# needs one entry point of each kind, and a skill that only some flows ship.
fixture_skills=(lets-build lets-shape test-driven-development peer-code-review)

# generated_skills <dir>: make a folder that stands in for the generated
# openspec-* skills, and print its path.
generated_skills() {
  mkdir -p "$1/openspec-propose"
  echo "generated" >"$1/openspec-propose/SKILL.md"
  echo "$1"
}

# build <out> <schema> <mode> [skill...]: run the release build on this repo.
build() {
  local out="$1" schema="$2" mode="$3"
  shift 3
  bash "$repo/nix/build-release.sh" "$repo" "$(generated_skills "$out.generated")" \
    "$out" "$schema" "$mode" "$@"
}

# make_release <dir> [extra skill...]: build a read-only release of the
# standard flow in <dir>. Name <dir> like a store path, <hash>-lets-spec-release,
# because that is how lets-sync knows its own links. Each extra skill is
# added beside the fixture's, to stand for an earlier release.
make_release() {
  local dir="$1" skill
  shift
  build "$dir" standard labels "${fixture_skills[@]}" >&2
  for skill in "$@"; do
    mkdir -p "$dir/overlay/.agents/skills/$skill"
    echo "$skill" >"$dir/overlay/.agents/skills/$skill/SKILL.md"
  done
  chmod -R a-w "$dir"
}
