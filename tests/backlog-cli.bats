load support/common
load support/release
load support/fake-gh

# Each entry point ships its own backlog.sh: lets-build's picks and claims a
# story, and lets-shape's sets kind and priority. These tests run each
# script against a fake gh, and check the calls it makes, in order.

export issue7='{"number": 7, "labels": [], "assignees": []}'

# shape <mode> <args>...: run lets-shape's backlog.sh as a release built
# with the backlog mode ships it.
shape() {
  local mode="$1" out="$BATS_TEST_TMPDIR/release-$1"
  shift
  [ -d "$out" ] || build "$out" lets-standard "$mode" lets-shape >/dev/null
  bash "$out/overlay/.agents/skills/lets-shape/scripts/backlog.sh" "$@"
}

lets_build() {
  bash "$repo/skills/lets-build/scripts/backlog.sh" "$@"
}

# The answers of a repo that records kind and priority with labels, and has
# none of them yet.
labels_repo() {
  case "$*" in
    "api repos/{owner}/{repo}/issues/7") echo "$issue7" ;;
    "api repos/{owner}/{repo}/labels/"*) not_found ;;
  esac
}

# The answers of a repo in the org "o", whose Priority field has id 42.
fields_repo() {
  case "$*" in
    "api repos/{owner}/{repo} --jq .owner.login") echo o ;;
    "api orgs/o/issue-fields") echo '[{"id": 42, "name": "Priority"}]' ;;
    "api repos/{owner}/{repo}/issues/7") echo '{"number": 7, "labels": [{"name": "priority/must"}], "assignees": []}' ;;
  esac
}
export -f labels_repo fields_repo

@test "set-priority with labels creates a missing label, then adds it" {
  gh_answer() { labels_repo "$@"; }
  use_fake_gh
  run shape labels set-priority 7 Must
  [ "$status" -eq 0 ]
  [ "$(gh_calls)" = "api repos/{owner}/{repo}/issues/7
api repos/{owner}/{repo}/labels/priority%2Fmust
label create priority/must --description MoSCoW priority: Must --color ededed
issue edit 7 --add-label priority/must" ]
}

@test "set-priority with labels does not create a label the repo has" {
  gh_answer() {
    case "$*" in
      "api repos/{owner}/{repo}/labels/"*) echo '{"name": "priority/must"}' ;;
      *) labels_repo "$@" ;;
    esac
  }
  use_fake_gh
  run shape labels set-priority 7 Must
  [ "$status" -eq 0 ]
  run grep -c '^label create' "$gh_log"
  [ "$output" -eq 0 ]
}

@test "a write stops, and creates no label, when looking up the label fails" {
  gh_answer() {
    case "$*" in
      "api repos/{owner}/{repo}/labels/"*) echo "gh: Server Error (HTTP 500)" >&2; return 1 ;;
      *) labels_repo "$@" ;;
    esac
  }
  use_fake_gh
  run shape labels set-priority 7 Must
  [ "$status" -ne 0 ]
  [[ "$output" == *"HTTP 500"* ]]
  run grep -E '^(label create|issue edit)' "$gh_log"
  [ "$status" -eq 1 ]
}

@test "set-priority with fields sets the field, then removes the priority label" {
  gh_answer() { fields_repo "$@"; }
  use_fake_gh
  run shape fields set-priority 7 Should
  [ "$status" -eq 0 ]
  [ "$(gh_calls | tail -n 2)" = "api --method POST repos/{owner}/{repo}/issues/7/issue-field-values -F issue_field_values[][field_id]=42 -f issue_field_values[][value]=Should
issue edit 7 --remove-label priority/must" ]
}

@test "a write stops at the first gh command that fails" {
  gh_answer() {
    case "$*" in
      "api --method POST"*) return 1 ;;
      *) fields_repo "$@" ;;
    esac
  }
  use_fake_gh
  run shape fields set-priority 7 Should
  [ "$status" -ne 0 ]
  run grep -c '^issue edit' "$gh_log"
  [ "$output" -eq 0 ]
}

@test "set-priority with fields fails when the owner has no Priority field" {
  local answer
  for answer in '[]' 404; do
    gh_answer() {
      case "$*" in
        "api orgs/o/issue-fields") if [ "$answer" = 404 ]; then not_found; else echo "$answer"; fi ;;
        *) fields_repo "$@" ;;
      esac
    }
    export answer
    use_fake_gh
    run shape fields set-priority 7 Should
    [ "$status" -eq 1 ]
    [[ "$output" == *"o has no Priority issue field"* ]]
  done
}

@test "set-kind with fields needs no Priority field" {
  gh_answer() {
    case "$*" in
      "api orgs/o/issue-fields") echo '[]' ;;
      *) fields_repo "$@" ;;
    esac
  }
  use_fake_gh
  run shape fields set-kind 7 Epic
  [ "$status" -eq 0 ]
  [ "$(gh_calls)" = "api repos/{owner}/{repo}/issues/7
issue edit 7 --type Epic" ]
}

@test "a write refuses a value it does not know, and changes nothing" {
  gh_answer() { labels_repo "$@"; }
  use_fake_gh
  run shape labels set-priority 7 High
  [ "$status" -eq 1 ]
  [[ "$output" == *"priority must be Must, Should, Could or Wont, got 'High'"* ]]
  [ "$(gh_calls)" = "api repos/{owner}/{repo}/issues/7" ]
}

@test "lets-shape's backlog.sh prints its usage" {
  run shape labels --help
  [ "$status" -eq 0 ]
  [[ "$output" == *"backlog.sh set-priority <n> <Must|Should|Could|Wont>"* ]]
  [[ "$output" == *"backlog.sh set-kind <n> <Epic|Story>"* ]]
  run shape labels
  [ "$status" -ne 0 ]
  [[ "$output" == *"Usage:"* ]]
}

@test "lets-shape's backlog.sh only sets kind and priority" {
  run shape labels next
  [ "$status" -eq 1 ]
  [[ "$output" == *"unknown command 'next'. Use set-priority or set-kind."* ]]
}

@test "lets-shape's backlog.sh needs an issue number" {
  run shape labels set-kind seven Epic
  [ "$status" -eq 1 ]
  [[ "$output" == *"expected an issue number, got 'seven'"* ]]
  run shape labels set-kind
  [ "$status" -eq 1 ]
  [[ "$output" == *"expected an issue number, got ''"* ]]
}

@test "lets-shape's backlog.sh writes only in the mode the release build gives it" {
  run bash "$repo/skills/lets-shape/scripts/backlog.sh" set-priority 7 Must
  [ "$status" -eq 1 ]
  [[ "$output" == *"this copy has no backlog mode"* ]]
}

# search_pages <page JSON>...: the pages the story search finds. search_answer
# then answers with them, as gh does: every page with --paginate --slurp,
# and only the first without.
search_pages() {
  printf '%s\n' "$@" >"$BATS_TEST_TMPDIR/pages"
}
search_answer() {
  case "$*" in
    "api repos/{owner}/{repo} --jq .full_name") echo o/r ;;
    *search/issues*)
      if [[ "$*" == *"--paginate"*"--slurp"* ]]; then
        jq -s . "$BATS_TEST_TMPDIR/pages"
      else
        head -n 1 "$BATS_TEST_TMPDIR/pages"
      fi
      ;;
  esac
}
export -f search_answer

# page <n> <priority>: a search page that holds one story.
page() {
  printf '{"items": [{"number": %d, "title": "story-%d", "html_url": "u%d", "labels": [{"name": "priority/%s"}]}]}' "$1" "$1" "$1" "$2"
}

@test "next prints the story to work on, then its URL" {
  search_pages "$(page 4 should)"
  gh_answer() { search_answer "$@"; }
  use_fake_gh
  run lets_build next
  [ "$status" -eq 0 ]
  [ "$output" = $'#4 [should] story-4\nu4' ]
  [[ "$(gh_calls)" == *"q=repo:o/r is:issue is:open no:assignee -is:blocked -label:kind/epic -type:Epic"* ]]
}

@test "next ranks the stories on every page of the search" {
  search_pages "$(page 1 could)" "$(page 200 must)"
  gh_answer() { search_answer "$@"; }
  use_fake_gh
  run lets_build next
  [ "$status" -eq 0 ]
  [ "${lines[0]}" = "#200 [must] story-200" ]
}

@test "next fails when no story is ready" {
  search_pages '{"items": []}'
  gh_answer() { search_answer "$@"; }
  use_fake_gh
  run lets_build next
  [ "$status" -eq 1 ]
  [[ "$output" == *"no story is ready"* ]]
}

@test "next fails when the search fails" {
  gh_answer() {
    case "$*" in
      *search/issues*) echo "gh: Server Error (HTTP 502)" >&2; return 1 ;;
      *) search_answer "$@" ;;
    esac
  }
  use_fake_gh
  run lets_build next
  [ "$status" -ne 0 ]
  [[ "$output" == *"HTTP 502"* ]]
}

@test "claim assigns the story to the current user" {
  gh_answer() { [ "$*" != "api repos/{owner}/{repo}/issues/7" ] || echo "$issue7"; }
  use_fake_gh
  run lets_build claim 7
  [ "$status" -eq 0 ]
  [ "$(gh_calls | tail -n 1)" = "issue edit 7 --add-assignee @me" ]
}

@test "claim refuses a story someone else has, and changes nothing" {
  gh_answer() { echo '{"number": 7, "labels": [], "assignees": [{"login": "octocat"}]}'; }
  use_fake_gh
  run lets_build claim 7
  [ "$status" -eq 1 ]
  [[ "$output" == *"#7 is already assigned to octocat"* ]]
  [ "$(gh_calls)" = "api repos/{owner}/{repo}/issues/7" ]
}

@test "lets-build's backlog.sh prints its usage" {
  run lets_build --help
  [ "$status" -eq 0 ]
  [[ "$output" == *"backlog.sh next"* ]]
  [[ "$output" == *"backlog.sh claim <n>"* ]]
}

@test "lets-build's backlog.sh only picks and claims" {
  run lets_build set-kind 7 Epic
  [ "$status" -eq 1 ]
  [[ "$output" == *"unknown command 'set-kind'. Use next or claim."* ]]
}

@test "lets-build's backlog.sh needs an issue number to claim" {
  run lets_build claim seven
  [ "$status" -eq 1 ]
  [[ "$output" == *"expected an issue number, got 'seven'"* ]]
  run lets_build claim
  [ "$status" -eq 1 ]
  [[ "$output" == *"expected an issue number, got ''"* ]]
}
