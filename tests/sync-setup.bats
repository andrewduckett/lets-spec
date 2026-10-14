load support/common
load support/release
load support/project

# lets-sync creates the files a project owns when they are missing, then
# never edits them. It warns about their settings, and exits 0 when it
# warns, so a problem never stops a dev shell from starting.

@test "sync creates each file the project needs, and names each one" {
  rm openspec/config.yaml
  run sync_project
  [ "$status" -eq 0 ]
  diff "$release/init/openspec/config.yaml" openspec/config.yaml
  [ "$(readlink CLAUDE.md)" = AGENTS.md ]
  [ "$(readlink .claude/skills)" = ../.agents/skills ]
  [[ "$output" == *"created AGENTS.md"* ]]
  [[ "$output" == *"created openspec/config.yaml"* ]]
  [[ "$output" == *"linked CLAUDE.md to AGENTS.md"* ]]
  [[ "$output" == *"linked .claude/skills to ../.agents/skills"* ]]
}

@test "a config sync just created needs no settings" {
  rm openspec/config.yaml
  init_project
  run sync_project
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "sync never edits the project's own config" {
  printf '# Our config\nschema: lets-standard\ncontext: |\n  Our context.\n' >openspec/config.yaml
  cp openspec/config.yaml before
  run sync_project
  [ "$status" -eq 0 ]
  cmp before openspec/config.yaml
}

@test "sync keeps a CLAUDE.md that is a file, and warns" {
  echo "claude text" >CLAUDE.md
  run sync_project
  [ "$status" -eq 0 ]
  [ "$(cat CLAUDE.md)" = "claude text" ]
  [[ "$output" == *"CLAUDE.md is not a link to AGENTS.md"* ]]
}

@test "sync keeps a .claude/skills that is a folder, and warns" {
  mkdir -p .claude/skills/mine
  run sync_project
  [ "$status" -eq 0 ]
  [ -d .claude/skills/mine ]
  [[ "$output" == *".claude/skills is not a link to ../.agents/skills"* ]]
}

@test "sync warns when the config names another schema" {
  edit_config '.schema = "spec-driven"'
  run sync_project
  [ "$status" -eq 0 ]
  [[ "$output" == *"openspec/config.yaml sets schema to 'spec-driven'; it must be lets-standard"* ]]
}

@test "sync warns when the config sets no schema" {
  edit_config 'del(.schema)'
  run sync_project
  [ "$status" -eq 0 ]
  [[ "$output" == *"openspec/config.yaml sets no schema; it must be lets-standard"* ]]
}

@test "sync warns when the config is not valid YAML" {
  printf 'schema: [lets-standard\n' >openspec/config.yaml
  run sync_project
  [ "$status" -eq 0 ]
  [[ "$output" == *"openspec/config.yaml is not valid YAML"* ]]
}

@test "sync keeps a config link that points nowhere, and warns" {
  rm openspec/config.yaml
  ln -s ../nowhere.yaml openspec/config.yaml
  run sync_project
  [ "$status" -eq 0 ]
  [ "$(readlink openspec/config.yaml)" = ../nowhere.yaml ]
  [[ "$output" == *"openspec/config.yaml is missing, and could not be created"* ]]
}

@test "sync works on the whole project when run from a folder inside it" {
  mkdir -p src/deep
  cd src/deep
  run sync_project
  [ "$status" -eq 0 ]
  [ -f "$project/AGENTS.md" ]
  [ -L "$project/.agents/skills/lets-build" ]
  [ ! -e AGENTS.md ]
}

@test "sync warns and exits 0 outside a git repo" {
  mkdir "$BATS_TEST_TMPDIR/outside"
  cd "$BATS_TEST_TMPDIR/outside"
  GIT_CEILING_DIRECTORIES="$BATS_TEST_TMPDIR" run sync_project
  [ "$status" -eq 0 ]
  [[ "$output" == *"not inside a git repo"* ]]
  [ -z "$(ls -A)" ]
}

@test "sync prints its usage" {
  run sync_project --help
  [ "$status" -eq 0 ]
  [[ "$output" == "lets-sync: set up a project"* ]]
  [[ "$output" == *"Usage: lets-sync [--check]"* ]]
}

@test "sync refuses an unknown option" {
  run sync_project --force
  [ "$status" -eq 1 ]
  [[ "$output" == *"unknown option --force"* ]]
}

@test "sync refuses to run without a release" {
  run env -u WORKFLOW_RELEASE bash "$repo/bin/lets-sync.sh"
  [ "$status" -eq 1 ]
  [[ "$output" == *"WORKFLOW_RELEASE is not set"* ]]
}

@test "sync refuses a folder that is not a release" {
  mkdir "$BATS_TEST_TMPDIR/empty"
  WORKFLOW_RELEASE="$BATS_TEST_TMPDIR/empty" run sync_project
  [ "$status" -eq 1 ]
  [[ "$output" == *"is not a release of lets-spec"* ]]
}

# release_with_schemas <n>: a release like $release with n schemas, and print
# its path.
release_with_schemas() {
  local dir="$BATS_TEST_TMPDIR/store/n-lets-spec-release" i
  mkdir -p "$BATS_TEST_TMPDIR/store"
  cp -R "$release" "$dir"
  chmod -R u+w "$dir"
  rm -r "$dir/overlay/openspec/schemas/lets-standard"
  for ((i = 0; i < $1; i++)); do
    cp -R "$release/overlay/openspec/schemas/lets-standard" "$dir/overlay/openspec/schemas/s$i"
  done
  echo "$dir"
}

@test "sync refuses a release that holds no schema" {
  WORKFLOW_RELEASE="$(release_with_schemas 0)" run sync_project
  [ "$status" -eq 1 ]
  [[ "$output" == *"holds 0 schemas"* ]]
  [ ! -e AGENTS.md ]
}

@test "sync refuses a release that holds more than one schema" {
  WORKFLOW_RELEASE="$(release_with_schemas 2)" run sync_project
  [ "$status" -eq 1 ]
  [[ "$output" == *"holds 2 schemas"* ]]
  [ ! -e AGENTS.md ]
}
