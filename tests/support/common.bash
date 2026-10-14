# Loaded by every test file. Pins what the scripts see, so a developer's git
# config, locale or lets-spec shell never changes a result.

repo="$(cd "$BATS_TEST_DIRNAME/.." && pwd)"

export LC_ALL=C GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.com
export GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.com
unset WORKFLOW_RELEASE LETS_SPEC_SKILLS

# Releases are read-only, as in the Nix store. Make them writable again so
# bats can delete them.
teardown() {
  chmod -R u+w "$BATS_TEST_TMPDIR"
}
