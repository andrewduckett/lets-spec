# Build releases with build/build-release.mjs, as the flake does.

# The skills a test release ships. A fixture, not a copy of flows.json: it
# needs one entry point of each kind, a skill that only some flows ship,
# and a skill with a script.
fixture_skills=(lets-build lets-shape lets-test-first lets-review-code lets-spawn)

# generated_skills <dir>: make a folder that stands in for the generated
# openspec-* skills, and print its path.
generated_skills() {
  mkdir -p "$1/openspec-propose"
  echo "generated" >"$1/openspec-propose/SKILL.md"
  echo "$1"
}

# build <out> <schemas> [skill...]: run the release build on this repo.
# <schemas> is comma-separated; the first is the default.
build() {
  local out="$1" schemas="$2"
  shift 2
  node "$repo/build/build-release.mjs" "$repo" "$(generated_skills "$out.generated")" \
    "$out" "$schemas" "$@"
}

# make_release <dir> [extra skill...]: build a read-only release of the
# standard flow in <dir>. Each extra skill is added beside the fixture's,
# to stand for an earlier release.
make_release() {
  local dir="$1" skill
  shift
  build "$dir" lets-standard "${fixture_skills[@]}" >&2
  for skill in "$@"; do
    mkdir -p "$dir/overlay/.agents/skills/$skill"
    echo "$skill" >"$dir/overlay/.agents/skills/$skill/SKILL.md"
  done
  chmod -R a-w "$dir"
}
