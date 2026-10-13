#!/usr/bin/env bash
# backlog.sh: set the kind and priority of the project's issues on GitHub.
#
# Usage:
#   backlog.sh set-priority <n> <Must|Should|Could|Wont>
#   backlog.sh set-kind <n> <Epic|Story>
#
# Run it from the project root as
# bash .agents/skills/lets-shape/scripts/backlog.sh. It needs gh and jq.
#
# A repo records kind and priority with labels (kind/epic, priority/must)
# or with issue fields (the Epic type, the Priority field). A write uses
# the one this copy's mode names, labels or fields, and clears the other
# on that issue. nix/build-release.sh writes the mode from the project's
# backlog choice in its flake.
#
# The rules live in backlog-plan.jq beside this script. This script only
# runs gh and hands the results to it.
set -euo pipefail

here="$(dirname "${BASH_SOURCE[0]}")"
mode="@backlog-mode@"

die() {
  echo "backlog.sh: $*" >&2
  exit 1
}

usage() {
  sed -n '2,/^$/s/^# \{0,1\}//p' "${BASH_SOURCE[0]}"
}

require_number() {
  [[ "${1:-}" =~ ^[0-9]+$ ]] || die "expected an issue number, got '${1:-}'."
}

require_mode() {
  case "$mode" in
    labels | fields) ;;
    *) die "this copy has no backlog mode. Run the copy lets-spec-sync links into .agents/skills/lets-shape/." ;;
  esac
}

# Run gh, and succeed with no output when it answers 404. Any other failure
# stops the command, so a network error is never read as "not found".
gh_unless_missing() {
  local err status=0 out
  err="$(mktemp)"
  out="$(gh "$@" 2>"$err")" || status=$?
  if [ "$status" -ne 0 ] && ! grep -q "HTTP 404" "$err"; then
    cat "$err" >&2
    rm -f "$err"
    die "gh $* failed."
  fi
  rm -f "$err"
  [ "$status" -ne 0 ] || printf '%s\n' "$out"
}

# Print the id of the owner's Priority issue field. A priority write in
# fields mode needs it.
priority_field() {
  local owner id
  owner="$(gh api "repos/{owner}/{repo}" --jq .owner.login)"
  id="$(gh_unless_missing api "orgs/$owner/issue-fields" |
    jq -r '.[]? | select(.name == "Priority") | .id')"
  [ -n "$id" ] || die "$owner has no Priority issue field. Use the github-labels backlog in the flake, or add the field."
  printf '%s\n' "$id"
}

# Create a label unless the repo already has it. A new repo has none of the
# backlog labels yet. The lookup is its own step, so its failure stops the
# command, and is never read as a missing label.
ensure_label() {
  local name="$1" description="$2" found
  found="$(gh_unless_missing api "repos/{owner}/{repo}/labels/${name//\//%2F}")"
  if [ -z "$found" ]; then
    gh label create "$name" --description "$description" --color ededed
  fi
}

# write <op> <n> <value>: plan the gh commands for one write, then run them.
write() {
  local op="$1" number="$2" value="$3" field="" plan error step
  local -a args
  require_mode
  if [ "$mode" = fields ] && [ "$op" = set-priority ]; then
    field="$(priority_field)"
  fi

  plan="$(gh api "repos/{owner}/{repo}/issues/$number" |
    jq -c -f "$here/backlog-plan.jq" --arg op "$op" --arg value "$value" --arg mode "$mode" --arg field "$field")"
  error="$(jq -r 'objects | .error' <<<"$plan")"
  [ -z "$error" ] || die "$error"

  while IFS= read -r step; do
    [ -n "$step" ] || continue
    mapfile -t args < <(jq -r '.[]' <<<"$step")
    if [ "${args[0]}" = ensure-label ]; then
      ensure_label "${args[1]}" "${args[2]}"
    else
      gh "${args[@]}"
    fi
  done <<<"$plan"
}

command="${1:-}"
case "$command" in
  -h | --help | "")
    usage
    [ -n "$command" ]
    exit
    ;;
  set-priority | set-kind)
    require_number "${2:-}"
    write "$command" "$2" "${3:-}"
    ;;
  *) die "unknown command '$command'. Use set-priority or set-kind." ;;
esac
