load support/common
load support/release
load support/project

# lets sync creates the files a project owns when they are missing, then
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

@test "sync warns when the config has a schema it cannot read" {
  printf 'schema:\n' >openspec/config.yaml
  run sync_project
  [ "$status" -eq 0 ]
  [[ "$output" == *"openspec/config.yaml sets no schema"* ]]
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
  [ -f "$project/.agents/skills/lets-build/SKILL.md" ]
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
  [[ "$output" == "Usage: lets sync [--check]"* ]]
  [[ "$output" == *"Set up a project for lets-spec, and keep it set up."* ]]
  [[ "$output" == *"LETS_SPEC_SKILLS=ignored"* ]]
  [[ "$output" == *"The Nix wrapper sets WORKFLOW_RELEASE." ]]
}

@test "sync refuses an unknown option" {
  run sync_project --force
  [ "$status" -eq 2 ]
  [[ "$output" == *"unknown option '--force'"* ]]
}

@test "sync refuses to run without a release" {
  run env -u WORKFLOW_RELEASE node "$repo/lets/bin/lets" sync
  [ "$status" -eq 1 ]
  [[ "$output" == *"there is no release for flow"* ]]
}

@test "sync refuses a folder that is not a release" {
  mkdir "$BATS_TEST_TMPDIR/empty"
  WORKFLOW_RELEASE="$BATS_TEST_TMPDIR/empty" run sync_project
  [ "$status" -eq 1 ]
  [[ "$output" == *"is not a release of lets-spec"* ]]
}

# release_with_schemas <n>: a copy of $release that ships n schemas: none,
# or lets-standard plus n-1 copies named lets-extra<i>. Prints its path.
# lets sync owns only schemas named lets-*, so the copies are too.
release_with_schemas() {
  local dir="$BATS_TEST_TMPDIR/store/n-lets-spec-release" i
  mkdir -p "$BATS_TEST_TMPDIR/store"
  cp -R "$release" "$dir"
  chmod -R u+w "$dir"
  if [ "$1" -eq 0 ]; then rm -r "$dir/overlay/openspec/schemas/lets-standard"; fi
  for ((i = 1; i < $1; i++)); do
    cp -R "$release/overlay/openspec/schemas/lets-standard" "$dir/overlay/openspec/schemas/lets-extra$i"
  done
  echo "$dir"
}

@test "sync refuses a release that holds no schema" {
  WORKFLOW_RELEASE="$(release_with_schemas 0)" run sync_project
  [ "$status" -eq 1 ]
  [[ "$output" == *"holds no schema"* ]]
  [ ! -e AGENTS.md ]
}

@test "sync copies every schema a release holds" {
  WORKFLOW_RELEASE="$(release_with_schemas 2)" run sync_project
  [ "$status" -eq 0 ]
  [ -f openspec/schemas/lets-standard/schema.yaml ]
  [ -f openspec/schemas/lets-extra1/schema.yaml ]
}

@test "sync refuses a release whose config names a schema it does not ship" {
  local dir
  dir="$(release_with_schemas 2)"
  rm -r "$dir/overlay/openspec/schemas/lets-standard"
  WORKFLOW_RELEASE="$dir" run sync_project
  [ "$status" -eq 1 ]
  [[ "$output" == *"names 'lets-standard', which the release does not ship"* ]]
  [ ! -e AGENTS.md ]
}
