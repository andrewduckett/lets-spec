load support/common
load support/fake-gh

# lets-shape's stale-links.sh lists the issue links in a discovery map that
# point at closed issues. These tests run it against a fake gh.

stale_links() {
  bash "$repo/skills/lets-shape/scripts/stale-links.sh" "$@"
}

# Issues 1 and 3 in o/r are closed; every other issue is open.
gh_answer() {
  case "$*" in
    "issue view 1 -R o/r "*) echo "CLOSED Ship: the first story" ;;
    "issue view 3 -R o/r "*) echo "CLOSED Third" ;;
    "issue view "*) echo "OPEN Still going" ;;
  esac
}

setup() {
  use_fake_gh
  map="$BATS_TEST_TMPDIR/discovery.md"
}

@test "stale-links prints each link to a closed issue, with its line, in file order" {
  cat >"$map" <<'EOF'
# Map
- [one](https://github.com/o/r/issues/1)
- [two](https://github.com/o/r/issues/2)
- [three](https://github.com/o/r/issues/3)
EOF
  run stale_links "$map"
  [ "$status" -eq 0 ]
  [ "$output" = "2: #1 Ship: the first story
4: #3 Third" ]
}

@test "stale-links looks up each issue once, however often the map links it" {
  printf '%s\n' https://github.com/o/r/issues/1 https://github.com/o/r/issues/1 >"$map"
  run stale_links "$map"
  [ "$status" -eq 0 ]
  [ "${#lines[@]}" -eq 2 ]
  [ "$(grep -c 'issue view 1 ' "$gh_log")" -eq 1 ]
}

@test "stale-links tells the same number in two repos apart" {
  printf '%s\n' https://github.com/o/r/issues/1 https://github.com/o/other/issues/1 >"$map"
  run stale_links "$map"
  [ "$status" -eq 0 ]
  [ "$output" = "1: #1 Ship: the first story" ]
}

@test "stale-links prints nothing for a map with no issue links" {
  printf '# Map\nhttps://github.com/o/r/pull/1\nhttps://github.com/o/r/issues/\n' >"$map"
  run stale_links "$map"
  [ "$status" -eq 0 ]
  [ -z "$output" ]
  [ ! -s "$gh_log" ]
}

@test "stale-links fails when the map is missing" {
  run stale_links "$BATS_TEST_TMPDIR/nosuch.md"
  [ "$status" -ne 0 ]
  [[ "$output" == *"nosuch.md"* ]]
}

@test "stale-links fails when an issue cannot be looked up" {
  gh_answer() { echo "gh: Could not resolve to an issue" >&2; return 1; }
  use_fake_gh
  echo https://github.com/o/r/issues/1 >"$map"
  run stale_links "$map"
  [ "$status" -ne 0 ]
  [[ "$output" == *"Could not resolve"* ]]
}

@test "stale-links prints its usage when given no map" {
  run stale_links
  [ "$status" -ne 0 ]
  [[ "$output" == *"usage: stale-links.sh <path/to/discovery.md>"* ]]
}
