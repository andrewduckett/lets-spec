#!/usr/bin/env bash
# lets-spec-sync: set up a project for lets-spec, and keep it set up. The dev
# shell runs it each time it starts, and it is safe to run any number of
# times.
#
# Usage: lets-spec-sync [--check]
#
# Keeps the lets-spec rules in a marked block of AGENTS.md: creates
# AGENTS.md with only the block when it is missing, appends the block when
# AGENTS.md lacks it, and rewrites the block when it is out of date. The
# project owns the rest of the file, and commits the block with it.
#
# Creates each other file the project owns when it is missing:
# openspec/config.yaml from the release's template, and the CLAUDE.md and
# .claude/skills links. It never edits one that exists, and names each file
# it creates or changes.
#
# Links each skill into .agents/skills, and the schema into
# openspec/schemas. Each link points into the Nix store, and git ignores it
# through a section of .git/info/exclude, so nothing it links is ever
# committed. A link to an earlier release is replaced, and one the release
# no longer ships is removed. A file or folder the project owns is never
# replaced; lets-spec-sync warns instead.
#
# Then it warns if:
# - the rules block in AGENTS.md has a marker without its pair
# - openspec/config.yaml is invalid, or names a schema other than the release's
# - CLAUDE.md is not a link to AGENTS.md, or .claude/skills is not a link to
#   ../.agents/skills
#
# It prints nothing when all is well, and exits 0 even when it warns, so a
# problem never stops the shell from starting.
#
# With --check, it changes nothing, and exits 1 if the rules block in
# AGENTS.md is missing or out of date. Run it in CI.
#
# WORKFLOW_RELEASE names the release. The Nix wrapper sets it.
set -euo pipefail

# Where release files live, relative to the release and the project. The
# release is the Nix store path that WORKFLOW_RELEASE names, built by
# nix/build-release.sh for one flow and one backlog. It holds:
#   overlay/  files linked into a project, at the same paths. Its
#             .agents/skills/ holds every skill: the flow's, the backlog's
#             and the generated openspec-*. Its openspec/schemas/ holds the
#             flow's one schema.
#   init/       files lets-spec-sync creates when missing, which the project
#               then owns
#   fragments/  the rules lets-spec-sync keeps in a marked block of AGENTS.md
skills_dst=".agents/skills"
config="openspec/config.yaml"
schemas_dst="openspec/schemas"
agents="AGENTS.md"

# The markers around the rules block in AGENTS.md. HTML comments, so they
# do not show when the file is rendered.
rules_begin="<!-- BEGIN lets-spec rules. lets-spec-sync rewrites this block: change lets-spec, not this text. -->"
rules_end="<!-- END lets-spec rules -->"
rules_begin_pattern='^<!-- BEGIN lets-spec rules'
rules_end_pattern='^<!-- END lets-spec rules -->$'

# The name of the release's store path, which the Nix build sets. A link
# whose target contains it was made by lets-spec-sync, so lets-spec-sync may
# replace or remove it. Anything else belongs to the project.
release_name="-lets-spec-release/"

die() {
  echo "error: $*" >&2
  exit 1
}

# Fail unless the folder holds a release of lets-spec.
require_release() {
  local release="$1"
  if [ ! -d "$release/overlay/$skills_dst" ] || [ ! -d "$release/init" ] ||
    [ ! -f "$release/fragments/$agents" ]; then
    die "$release is not a release of lets-spec: it lacks overlay/$skills_dst/, init/ or fragments/$agents."
  fi
}

# Print the name of the one schema folder the release holds.
release_schema() {
  local release="$1" dirs=()
  for dir in "$release/overlay/$schemas_dst"/*/; do
    [ ! -d "$dir" ] || dirs+=("$(basename "$dir")")
  done
  [ ${#dirs[@]} -eq 1 ] ||
    die "$release holds ${#dirs[@]} schemas in overlay/$schemas_dst/; a release holds one."
  echo "${dirs[0]}"
}

# Print a value from the project's config, or nothing if it is unset.
# Takes a yq path, such as .schema.
config_value() {
  yq -r "$1 // \"\"" "$config"
}

# Print the rules block as lets-spec-sync writes it.
rules_block() {
  echo "$rules_begin"
  cat "$release/fragments/$agents"
  echo "$rules_end"
}

# Print the state of the rules block in AGENTS.md: absent when there is no
# AGENTS.md, missing when it has no markers, unpaired when its markers are
# not one begin and one end in that order, and otherwise current or stale.
rules_state() {
  [ -e "$agents" ] || {
    echo absent
    return
  }
  local markers
  markers="$(awk -v b="$rules_begin_pattern" -v e="$rules_end_pattern" '
    $0 ~ b { printf "b" }
    $0 ~ e { printf "e" }' "$agents")"
  case "$markers" in
    "") echo missing ;;
    be)
      if [ "$(awk -v b="$rules_begin_pattern" -v e="$rules_end_pattern" '
        $0 ~ b { on = 1 }
        on { print }
        $0 ~ e { on = 0 }' "$agents")" = "$(rules_block)" ]; then
        echo current
      else
        echo stale
      fi
      ;;
    *) echo unpaired ;;
  esac
}

usage() {
  sed -n '2,/^$/s/^# \{0,1\}//p' "${BASH_SOURCE[0]}"
}

check=false
case "${1:-}" in
  "") ;;
  --check) check=true ;;
  -h | --help)
    usage
    exit 0
    ;;
  *) die "unknown option $1. Usage: lets-spec-sync [--check]" ;;
esac

release="${WORKFLOW_RELEASE:-}"
[ -n "$release" ] || die "WORKFLOW_RELEASE is not set. Run lets-spec-sync from the lets-spec flake."
require_release "$release"
schema_name="$(release_schema "$release")"

if ! root="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "lets-spec: not inside a git repo, so nothing was linked." >&2
  exit 0
fi
cd "$root"

if $check; then
  case "$(rules_state)" in
    current) exit 0 ;;
    absent | missing) echo "lets-spec: $agents has no lets-spec rules. Run lets-spec-sync, then commit $agents." >&2 ;;
    stale) echo "lets-spec: $agents's lets-spec rules are out of date. Run lets-spec-sync, then commit $agents." >&2 ;;
    unpaired) echo "lets-spec: $agents has a lets-spec rules marker without its pair." >&2 ;;
  esac
  exit 1
fi

warnings=()

# Keep the rules block in AGENTS.md. Write through the file, not over it,
# so a link or the file's permissions are kept.
case "$(rules_state)" in
  absent)
    rules_block >"$agents"
    echo "lets-spec: created $agents."
    ;;
  missing)
    # End the project's last line, then leave a blank line before the block.
    unended=false
    if [ -s "$agents" ] && [ -n "$(tail -c 1 "$agents")" ]; then unended=true; fi
    {
      if $unended; then echo; fi
      echo
      rules_block
    } >>"$agents"
    echo "lets-spec: added the lets-spec rules to $agents. Commit it."
    ;;
  stale)
    new="$(mktemp "$agents.XXXXXX")"
    # The block goes through the environment: awk -v would read a backslash
    # in the rules as an escape.
    block="$(rules_block)" awk -v b="$rules_begin_pattern" -v e="$rules_end_pattern" '
      $0 ~ b { print ENVIRON["block"]; skip = 1 }
      !skip { print }
      $0 ~ e { skip = 0 }' "$agents" >"$new"
    cat "$new" >"$agents"
    rm "$new"
    echo "lets-spec: updated the lets-spec rules in $agents. Commit it."
    ;;
  unpaired)
    warnings+=("$agents has a lets-spec rules marker without its pair, so its rules were not updated. Delete the marker, and the rules text with it, then run lets-spec-sync again.")
    ;;
esac

# Create each init/ file the project does not have yet. The project owns it
# from then on.
while IFS= read -r file; do
  if [ ! -e "$file" ] && [ ! -L "$file" ]; then
    mkdir -p "$(dirname "$file")"
    cp "$release/init/$file" "$file"
    chmod u+w,go+r "$file"
    echo "lets-spec: created $file."
  fi
done < <(cd "$release/init" && find . -type f | sed 's#^\./##' | sort)

# Claude Code reads CLAUDE.md and .claude/skills. Link both to the files
# every other agent reads, unless the project already has its own.
if [ ! -e CLAUDE.md ] && [ ! -L CLAUDE.md ]; then
  ln -s AGENTS.md CLAUDE.md
  echo "lets-spec: linked CLAUDE.md to AGENTS.md."
fi
if [ ! -e .claude/skills ] && [ ! -L .claude/skills ]; then
  mkdir -p .claude
  ln -s ../.agents/skills .claude/skills
  echo "lets-spec: linked .claude/skills to ../.agents/skills."
fi

# Succeed if the path is a link that lets-spec-sync made.
ours() {
  [ -L "$1" ] && [[ "$(readlink "$1")" == *"$release_name"* ]]
}

# What this release links, as two lists in step: where each link goes in the
# project, and what it points to.
dsts=()
srcs=()
for dir in "$release/overlay/$skills_dst"/*/; do
  dsts+=("$skills_dst/$(basename "$dir")")
  srcs+=("${dir%/}")
done
dsts+=("$schemas_dst/$schema_name")
srcs+=("$release/overlay/$schemas_dst/$schema_name")

# The exclude section lists what the last run linked, so it is also the
# record of what to clean up.
exclude="$(git rev-parse --git-path info/exclude)"
section_begin="# BEGIN lets-spec links. lets-spec-sync rewrites this section."
section_end="# END lets-spec links"
begin_pattern='^# BEGIN lets-spec links'
end_pattern='^# END lets-spec links$'

# Link the release, remove the links it no longer ships, and rewrite the
# exclude section to list what is linked now.
link_release() {
  local previous=() linked=() line path i dst new
  if [ -f "$exclude" ]; then
    while IFS= read -r line; do
      previous+=("${line#/}")
    done < <(awk -v b="$begin_pattern" -v e="$end_pattern" '
      $0 ~ e { on = 0 }
      on && /^\// { print }
      $0 ~ b { on = 1 }' "$exclude")
  fi

  # Remove each link the last run made that this release no longer ships.
  for path in ${previous[@]+"${previous[@]}"}; do
    case " ${dsts[*]} " in
      *" $path "*) ;;
      *) if ours "$path"; then rm "$path"; fi ;;
    esac
  done

  for i in "${!dsts[@]}"; do
    dst="${dsts[$i]}"
    if ours "$dst" || { [ ! -e "$dst" ] && [ ! -L "$dst" ]; }; then
      mkdir -p "$(dirname "$dst")"
      ln -sfn "${srcs[$i]}" "$dst"
      linked+=("/$dst")
    else
      warnings+=("$dst belongs to the project, so it was not linked. To use lets-spec's copy, remove it: git rm -r $dst")
    fi
  done

  # Rewrite the exclude section. Write a new file beside the old one, then
  # move it into place, so a failure never leaves half a section.
  mkdir -p "$(dirname "$exclude")"
  new="$(mktemp "$exclude.XXXXXX")"
  {
    if [ -f "$exclude" ]; then
      awk -v b="$begin_pattern" -v e="$end_pattern" '
        $0 ~ b { skip = 1 }
        !skip { print }
        $0 ~ e { skip = 0 }' "$exclude"
    fi
    echo "$section_begin"
    printf '%s\n' ${linked[@]+"${linked[@]}"}
    echo "$section_end"
  } >"$new"
  mv "$new" "$exclude"
}

# The section's markers must be one begin, then one end, or none. Anything
# else means the section was edited by hand, so its lines cannot be told
# from the project's. Then nothing is linked, and the file is left alone.
exclude_markers=""
if [ -f "$exclude" ]; then
  exclude_markers="$(awk -v b="$begin_pattern" -v e="$end_pattern" '
    $0 ~ b { printf "b" }
    $0 ~ e { printf "e" }' "$exclude")"
fi
case "$exclude_markers" in
  "" | be) link_release ;;
  *) warnings+=("$exclude has a lets-spec links marker without its pair, so nothing was linked. Delete the marker, and the lines between the markers, then run lets-spec-sync again.") ;;
esac

# The files the project owns.
if [ "$(readlink CLAUDE.md || true)" != "AGENTS.md" ]; then
  warnings+=("CLAUDE.md is not a link to AGENTS.md. Move its text into AGENTS.md, then run: ln -sf AGENTS.md CLAUDE.md")
fi
if [ "$(readlink .claude/skills || true)" != "../.agents/skills" ]; then
  warnings+=(".claude/skills is not a link to ../.agents/skills. Move its skills into .agents/skills, then run: rm -r .claude/skills && ln -s ../.agents/skills .claude/skills")
fi

check_settings() {
  if [ ! -f "$config" ]; then
    warnings+=("$config is missing, and could not be created.")
    return
  fi
  if ! yq '.' "$config" >/dev/null 2>&1; then
    warnings+=("$config is not valid YAML.")
    return
  fi

  local schema
  schema="$(config_value .schema)"
  if [ -z "$schema" ]; then
    warnings+=("$config sets no schema; it must be $schema_name.")
  elif [ "$schema" != "$schema_name" ]; then
    warnings+=("$config sets schema to '$schema'; it must be $schema_name.")
  fi
}
check_settings

if [ ${#warnings[@]} -gt 0 ]; then
  echo "lets-spec: ${#warnings[@]} problem(s) to fix:" >&2
  printf -- '- %s\n' "${warnings[@]}" >&2
fi
exit 0
