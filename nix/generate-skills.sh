#!/usr/bin/env bash
# Generate the OpenSpec skills for the workflows listed in openspec.json.
# The flake runs it while it builds a release, with the OpenSpec CLI from
# nixpkgs on the PATH.
#
# Usage: generate-skills.sh <openspec.json> <output folder>
set -euo pipefail

[ $# -eq 2 ] || {
  echo "usage: generate-skills.sh <openspec.json> <output folder>" >&2
  exit 1
}
settings="$1" out="$2"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# The CLI reads profile, delivery and workflows only from its global config,
# so point XDG_CONFIG_HOME at a copy of openspec.json for this one command.
# Remove the redirect once the CLI reads those settings from the project:
# https://github.com/Fission-AI/OpenSpec/issues/914
# https://github.com/Fission-AI/OpenSpec/issues/779
mkdir -p "$work/config/openspec" "$work/project"
cp "$settings" "$work/config/openspec/config.json"

# Generate into an empty scratch project. Send all output to a log: when
# stderr is a terminal, init can hang on its progress spinner.
if ! (
  cd "$work/project"
  XDG_CONFIG_HOME="$work/config" OPENSPEC_TELEMETRY=0 OPENSPEC_NO_UPDATE_CHECK=1 \
    openspec init --tools agents --no-animation </dev/null >"$work/init.log" 2>&1
); then
  cat "$work/init.log" >&2
  echo "error: openspec init failed." >&2
  exit 1
fi

# Keep only the skill folders. init also writes a marker file and an
# openspec/ folder, which projects do not need from here.
mkdir -p "$out"
found=0
for dir in "$work"/project/.agents/skills/openspec-*/; do
  [ -d "$dir" ] || continue
  cp -R "$dir" "$out/"
  found=1
done
if [ "$found" = 0 ]; then
  echo "error: openspec init wrote no openspec-* skills." >&2
  exit 1
fi
