load support/common
load support/release

# build/build-release.mjs lays out a release for one flow. The flake runs it
# for each recipe in flows.json; these tests run it directly.

setup() {
  out="$BATS_TEST_TMPDIR/out"
}

# build_from <generated> [args...]: run the build with this generated folder.
build_from() {
  node "$repo/build/build-release.mjs" "$repo" "$1" "$out" "${@:2}"
}

@test "the release links exactly the schemas and the skills it is given" {
  build "$out" lets-standard,lets-minimal lets-test-first lets-build
  [ "$(cd "$out/overlay" && ls -A | tr '\n' ' ')" = ".agents openspec " ]
  [ "$(ls -A "$out/overlay/openspec")" = schemas ]
  [ "$(ls "$out/overlay/openspec/schemas" | tr '\n' ' ')" = "lets-minimal lets-standard " ]
  [ "$(ls "$out/overlay/.agents/skills" | tr '\n' ' ')" = "lets-build lets-test-first openspec-propose " ]
}

@test "the release's schema is a full copy of the source's" {
  build "$out" lets-standard lets-test-first
  diff -r "$repo/schemas/lets-standard" "$out/overlay/openspec/schemas/lets-standard"
}

@test "the release holds the rules sync keeps in AGENTS.md, and creates no AGENTS.md" {
  build "$out" lets-standard lets-test-first
  diff "$repo/overlays/AGENTS.md" "$out/fragments/AGENTS.md"
  [ ! -e "$out/init/AGENTS.md" ]
}

@test "the release's config is the first schema's own, and names it" {
  build "$out" lets-standard,lets-minimal lets-test-first
  diff "$repo/overlays/openspec/config.d/lets-standard.yaml" "$out/init/openspec/config.yaml"
  rm -rf "$out"
  build "$out" lets-minimal lets-test-first
  [ "$(yq -r .schema "$out/init/openspec/config.yaml")" = lets-minimal ]
  [ ! -e "$out/init/openspec/config.d" ]
}

@test "the standard release's config holds the code review as archive guidance, and the minimal release's holds none" {
  build "$out" lets-standard lets-test-first
  [ "$(yq -o json -I0 '.operations | keys' "$out/init/openspec/config.yaml")" = '["archive"]' ]
  [ "$(yq '.operations.archive.guidance | length' "$out/init/openspec/config.yaml")" -eq 1 ]
  grep -q '`lets-review-code` skill' "$out/init/openspec/config.yaml"
  rm -rf "$out"
  build "$out" lets-minimal lets-test-first
  [ "$(yq -o json -I0 . "$out/init/openspec/config.yaml")" = '{"schema":"lets-minimal"}' ]
}

@test "the build works from a read-only source, as in the Nix store" {
  local source="$BATS_TEST_TMPDIR/source"
  mkdir -p "$source"
  cp -R "$repo/schemas" "$repo/skills" "$repo/overlays" "$source/"
  chmod -R a-w "$source"
  run node "$repo/build/build-release.mjs" "$source" "$(generated_skills "$BATS_TEST_TMPDIR/generated")" "$out" lets-standard lets-shape
  [ "$status" -eq 0 ]
  [ -f "$out/overlay/.agents/skills/lets-shape/SKILL.md" ]
}

@test "the build works when there are no generated skills" {
  mkdir "$BATS_TEST_TMPDIR/generated"
  run build_from "$BATS_TEST_TMPDIR/generated" lets-standard lets-test-first
  [ "$status" -eq 0 ]
  [ "$(ls "$out/overlay/.agents/skills")" = lets-test-first ]
}

@test "the build fails when the generated skills' folder is missing" {
  run build_from "$BATS_TEST_TMPDIR/nosuch" lets-standard lets-test-first
  [ "$status" -eq 1 ]
  [[ "$output" == *"there is no folder of generated skills at $BATS_TEST_TMPDIR/nosuch"* ]]
}

@test "the build fails with too few arguments, and prints its usage" {
  run node "$repo/build/build-release.mjs" "$repo" "$BATS_TEST_TMPDIR" "$out"
  [ "$status" -eq 1 ]
  [[ "$output" == *"usage: build-release.mjs <source> <generated> <out> <schemas> [skill...]"* ]]
}

@test "the build fails on an unknown schema in the list" {
  run build "$out" lets-standard,nosuch lets-test-first
  [ "$status" -eq 1 ]
  [[ "$output" == *"there is no schema named nosuch"* ]]
}

@test "the build fails on a schema with no config of its own" {
  local source="$BATS_TEST_TMPDIR/source"
  mkdir -p "$source"
  cp -R "$repo/schemas" "$repo/skills" "$repo/overlays" "$source/"
  rm "$source/overlays/openspec/config.d/lets-minimal.yaml"
  run node "$repo/build/build-release.mjs" "$source" "$(generated_skills "$BATS_TEST_TMPDIR/generated")" "$out" lets-minimal lets-test-first
  [ "$status" -eq 1 ]
  [[ "$output" == *"there is no config for lets-minimal in overlays/openspec/config.d/"* ]]
}

@test "the build fails on an unknown skill" {
  run build "$out" lets-standard lets-test-first nosuch
  [ "$status" -eq 1 ]
  [[ "$output" == *"there is no skill named nosuch"* ]]
}

@test "the build fails on a skill listed twice" {
  run build "$out" lets-standard lets-test-first lets-test-first
  [ "$status" -eq 1 ]
  [[ "$output" == *"lets-test-first is listed twice"* ]]
}

@test "the build fails when an authored skill has a generated skill's name" {
  local generated
  generated="$(generated_skills "$BATS_TEST_TMPDIR/generated")"
  mkdir -p "$generated/lets-test-first"
  run build_from "$generated" lets-standard lets-test-first
  [ "$status" -eq 1 ]
  [[ "$output" == *"lets-test-first has the same name as a generated OpenSpec skill"* ]]
}

# build_bundles: build the lets bundle, as lets/build.mjs does for the
# release, into $BATS_TEST_TMPDIR/build.
build_bundles() {
  (cd "$repo/lets" && node build.mjs "$BATS_TEST_TMPDIR/build")
}

# The tarball's bin/lets is this bundle. A mise project runs it with its own
# node, from anywhere, with no node_modules beside it.
@test "the lets bundle is one executable script that runs with no node_modules" {
  local bin="$BATS_TEST_TMPDIR/bin/lets"
  build_bundles
  mkdir "$BATS_TEST_TMPDIR/bin"
  cp -p "$BATS_TEST_TMPDIR/build/lets" "$bin"
  [ -x "$bin" ]
  [ "$(head -n 1 "$bin")" = '#!/usr/bin/env node' ]
  grep -q 'lets: needs Node 26' "$bin"
  [ "$(ls -A "$BATS_TEST_TMPDIR/bin")" = lets ]
  mkdir "$BATS_TEST_TMPDIR/empty"
  cd "$BATS_TEST_TMPDIR/empty"
  run node "$bin" --version
  [ "$status" -eq 0 ]
  [ "$output" = 0.0.0-dev ]
}

@test "each flow ships the authored domain-language reference" {
  local flow schemas
  for flow in standard minimal; do
    schemas="$(jq -r --arg flow "$flow" '.flows[$flow].schemas | join(",")' "$repo/flows.json")"
    build "$out/$flow" "$schemas" $(jq -r --arg flow "$flow" '.flows[$flow].skills[]' "$repo/flows.json")
    cmp "$repo/skills/lets-shape/references/domain-language.md" \
      "$out/$flow/overlay/.agents/skills/lets-shape/references/domain-language.md"
    [ ! -e "$out/$flow/init/openspec/glossary.md" ]
    [ ! -e "$out/$flow/overlay/openspec/glossary.md" ]
  done
}
