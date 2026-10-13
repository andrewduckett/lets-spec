# A stand-in for gh, for the scripts that call it.
#
# A test defines gh_answer, which gets gh's arguments, prints what gh would
# print and returns its status, then calls use_fake_gh. The scripts under
# test then call this gh, not the real one, and each call is logged, one
# line of arguments each, in $gh_log.

gh() {
  printf '%s\n' "$*" >>"$gh_log"
  gh_answer "$@"
}

use_fake_gh() {
  export gh_log="$BATS_TEST_TMPDIR/gh.log"
  : >"$gh_log"
  export -f gh gh_answer
}

# gh's answer when the API has no such thing.
not_found() {
  echo "gh: Not Found (HTTP 404)" >&2
  return 1
}
export -f not_found

# gh_calls: the logged calls, one per line.
gh_calls() {
  cat "$gh_log"
}
