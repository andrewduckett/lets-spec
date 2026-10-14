load support/common
load support/release

# build/build-release.sh lays out a release for one flow and one backlog. The
# flake runs it for each recipe in flows.json and each backlog; these tests
# run it directly.

setup() {
  out="$BATS_TEST_TMPDIR/out"
}

# build_from <generated> [args...]: run the build with this generated folder.
build_from() {
  bash "$repo/build/build-release.sh" "$repo" "$1" "$out" "${@:2}"
}

@test "the release links exactly the schema and the skills it is given" {
  build "$out" lets-standard labels lets-test-first lets-build
  [ "$(cd "$out/overlay" && ls -A | tr '\n' ' ')" = ".agents openspec " ]
  [ "$(ls -A "$out/overlay/openspec")" = schemas ]
  [ "$(ls "$out/overlay/openspec/schemas")" = lets-standard ]
  [ "$(ls "$out/overlay/.agents/skills" | tr '\n' ' ')" = "lets-build lets-test-first openspec-propose " ]
}

@test "the release's schema is a full copy of the source's" {
  build "$out" lets-standard labels lets-test-first
  diff -r "$repo/schemas/lets-standard" "$out/overlay/openspec/schemas/lets-standard"
}

@test "the release holds the rules sync keeps in AGENTS.md, and creates no AGENTS.md" {
  build "$out" lets-standard labels lets-test-first
  diff "$repo/overlays/AGENTS.md" "$out/fragments/AGENTS.md"
  [ ! -e "$out/init/AGENTS.md" ]
}

@test "the release's config template names the flow's schema" {
  build "$out" lets-minimal labels lets-test-first
  [ "$(yq -o json -I0 . "$out/init/openspec/config.yaml")" = '{"schema":"lets-minimal"}' ]
}

@test "the build writes the backlog mode into lets-shape's script, and keeps it executable" {
  local mode script
  for mode in labels fields; do
    rm -rf "$out"
    build "$out" lets-standard "$mode" lets-shape
    script="$out/overlay/.agents/skills/lets-shape/scripts/backlog.mjs"
    grep -qxF "const MODE = '$mode';" "$script"
    [ -x "$script" ]
    run grep -rqF @backlog-mode@ "$out/overlay"
    [ "$status" -eq 1 ]
  done
}

@test "the build leaves the source's scripts unchanged" {
  build "$out" lets-standard fields lets-shape
  grep -qxF "const MODE = '@backlog-mode@';" "$repo/skills/lets-shape/scripts/backlog.mjs"
}

@test "the build works from a read-only source, as in the Nix store" {
  local source="$BATS_TEST_TMPDIR/source"
  mkdir -p "$source"
  cp -R "$repo/schemas" "$repo/skills" "$repo/overlays" "$source/"
  chmod -R a-w "$source"
  run bash "$repo/build/build-release.sh" "$source" "$(generated_skills "$BATS_TEST_TMPDIR/generated")" "$out" lets-standard fields lets-shape
  [ "$status" -eq 0 ]
  grep -qxF "const MODE = 'fields';" "$out/overlay/.agents/skills/lets-shape/scripts/backlog.mjs"
}

@test "the build works when there are no generated skills" {
  mkdir "$BATS_TEST_TMPDIR/generated"
  run build_from "$BATS_TEST_TMPDIR/generated" lets-standard labels lets-test-first
  [ "$status" -eq 0 ]
  [ "$(ls "$out/overlay/.agents/skills")" = lets-test-first ]
}

@test "the build fails when the generated skills' folder is missing" {
  run build_from "$BATS_TEST_TMPDIR/nosuch" lets-standard labels lets-test-first
  [ "$status" -eq 1 ]
  [[ "$output" == *"there is no folder of generated skills at $BATS_TEST_TMPDIR/nosuch"* ]]
}

@test "the build fails with too few arguments, and prints its usage" {
  run bash "$repo/build/build-release.sh" "$repo" "$BATS_TEST_TMPDIR" "$out" lets-standard
  [ "$status" -eq 1 ]
  [[ "$output" == *"usage: build-release.sh <source> <generated> <out> <schema> <mode> [skill...]"* ]]
}

@test "the build fails on an unknown schema" {
  run build "$out" nosuch labels lets-test-first
  [ "$status" -eq 1 ]
  [[ "$output" == *"there is no schema named nosuch"* ]]
}

@test "the build fails on an unknown backlog mode" {
  run build "$out" lets-standard board lets-test-first
  [ "$status" -eq 1 ]
  [[ "$output" == *"the backlog mode must be labels or fields, got 'board'"* ]]
}

@test "the build fails on an unknown skill" {
  run build "$out" lets-standard labels lets-test-first nosuch
  [ "$status" -eq 1 ]
  [[ "$output" == *"there is no skill named nosuch"* ]]
}

@test "the build fails on a skill listed twice" {
  run build "$out" lets-standard labels lets-test-first lets-test-first
  [ "$status" -eq 1 ]
  [[ "$output" == *"lets-test-first is listed twice"* ]]
}

@test "the build fails when an authored skill has a generated skill's name" {
  local generated
  generated="$(generated_skills "$BATS_TEST_TMPDIR/generated")"
  mkdir -p "$generated/lets-test-first"
  run build_from "$generated" lets-standard labels lets-test-first
  [ "$status" -eq 1 ]
  [[ "$output" == *"lets-test-first has the same name as a generated OpenSpec skill"* ]]
}
