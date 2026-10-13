#!/usr/bin/env bash
# Build the release for one flow and one backlog: the files lets-spec-sync
# links into a project and creates in it. The flake runs it once for each
# pair of a recipe in flows.nix and a backlog, with the skills of both.
#
# Usage: build-release.sh <source> <generated> <out> <schema> <mode> [skill...]
#   source     this repo, or a copy of its schemas/, skills/ and overlays/
#              folders
#   generated  a folder that holds the generated openspec-* skills
#   out        the release folder to create
#   schema     the folder in schemas/ to ship
#   mode       labels or fields: how the backlog records kind and priority
#   skill      each folder in skills/ to ship
#
# The release has three folders:
#   overlay/    files lets-spec-sync links into a project, at the same
#               paths: the skills and the schema
#   init/       files lets-spec-sync creates in a project when they are
#               missing
#   fragments/  text lets-spec-sync keeps in a marked block of the project's
#               file at the same path
set -euo pipefail

die() {
  echo "error: $*" >&2
  exit 1
}

[ $# -ge 5 ] || die "usage: build-release.sh <source> <generated> <out> <schema> <mode> [skill...]"
source="$1" generated="$2" out="$3" schema="$4" mode="$5"
shift 5

[ -d "$source/schemas/$schema" ] || die "there is no schema named $schema in schemas/."
case "$mode" in
  labels | fields) ;;
  *) die "the backlog mode must be labels or fields, got '$mode'." ;;
esac
[ -d "$generated" ] || die "there is no folder of generated skills at $generated."
for skill in "$@"; do
  [ -d "$source/skills/$skill" ] || die "there is no skill named $skill in skills/."
done

overlay="$out/overlay"
skills="$overlay/.agents/skills"
mkdir -p "$overlay/openspec/schemas" "$skills" "$out/fragments"
cp -R "$source/schemas/$schema" "$overlay/openspec/schemas/$schema"
# overlays/ holds the files a project gets, at their paths in the project.
# AGENTS.md is a fragment, and lets-spec-sync creates each other file.
cp -R "$source/overlays" "$out/init"
# The Nix store is read-only, and so are copies made from it.
chmod -R u+w "$out"
mv "$out/init/AGENTS.md" "$out/fragments/AGENTS.md"

# The config lets-spec-sync creates names the flow's schema, which
# lets-spec-sync then expects.
config="$out/init/openspec/config.yaml"
sed "s/^schema: .*/schema: $schema/" "$config" >"$config.new"
mv "$config.new" "$config"

# Each skill is one folder. A name used twice would hide one of them, so the
# build fails instead.
add_skill() {
  local dir="${1%/}" clash="$2" name
  name="$(basename "$dir")"
  [ ! -e "$skills/$name" ] || die "$name $clash."
  cp -R "$dir" "$skills/$name"
}
for skill in "$@"; do
  add_skill "$source/skills/$skill" "is listed twice"
done
for dir in "$generated"/*/; do
  # With no generated skills, the pattern stays as written.
  [ -d "$dir" ] || continue
  add_skill "$dir" "has the same name as a generated OpenSpec skill"
done

# A skill's script that writes to the backlog holds @backlog-mode@ where
# the mode goes, so the shipped skill needs nothing from outside it. Write
# through the file, not over it, to keep its permissions. grep exits 1 when
# no skill holds it, as in a release without lets-shape. The skills were
# copied from the read-only store, so make them writable first.
chmod -R u+w "$skills"
{ grep -rlF @backlog-mode@ "$skills" || true; } | while IFS= read -r file; do
  sed "s/@backlog-mode@/$mode/g" "$file" >"$file.new"
  cat "$file.new" >"$file"
  rm "$file.new"
done
