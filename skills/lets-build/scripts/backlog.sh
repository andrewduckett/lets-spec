#!/usr/bin/env bash
# backlog.sh: pick and claim the project's next story on GitHub.
#
# Usage:
#   backlog.sh next        print the next story, then its URL
#   backlog.sh claim <n>   assign issue <n> to you
#
# Run it from the project root as
# bash .agents/skills/lets-build/scripts/backlog.sh. It needs gh and jq.
#
# The rules live in backlog-next.jq and backlog-claim.jq beside this
# script. This script only runs gh and hands the results to them.
set -euo pipefail

here="$(dirname "${BASH_SOURCE[0]}")"

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

cmd_next() {
  local repo story
  repo="$(gh api "repos/{owner}/{repo}" --jq .full_name)"
  # Rank the stories on every page, not just the first 100.
  story="$(gh api --paginate --slurp -X GET search/issues -f advanced_search=true -f per_page=100 \
    -f q="repo:$repo is:issue is:open no:assignee -is:blocked -label:kind/epic -type:Epic" |
    jq '{items: map(.items[])}' |
    jq -r -f "$here/backlog-next.jq")"
  [ -n "$story" ] || die "no story is ready. Every open story is an epic, assigned, blocked, untriaged or Wont."
  printf '%s\n' "$story"
}

cmd_claim() {
  local number="$1" plan error
  local -a args
  plan="$(gh api "repos/{owner}/{repo}/issues/$number" | jq -c -f "$here/backlog-claim.jq")"
  error="$(jq -r 'objects | .error' <<<"$plan")"
  [ -z "$error" ] || die "$error"
  mapfile -t args < <(jq -r '.[]' <<<"$plan")
  gh "${args[@]}"
}

command="${1:-}"
case "$command" in
  -h | --help | "")
    usage
    [ -n "$command" ]
    exit
    ;;
  next) cmd_next ;;
  claim)
    require_number "${2:-}"
    cmd_claim "$2"
    ;;
  *) die "unknown command '$command'. Use next or claim." ;;
esac
