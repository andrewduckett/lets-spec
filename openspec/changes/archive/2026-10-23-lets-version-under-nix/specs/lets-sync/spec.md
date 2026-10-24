## ADDED Requirements

### Requirement: lets --version prints the release version on every install
`lets --version` SHALL print the version recorded in the repository's one version source, `lets/package.json`, both when `lets` comes from the Nix flake and when it comes from the release tarball. When `lets` runs from the source tree, which has no `release.json`, it SHALL print `0.0.0-dev`.

#### Scenario: Nix install
- **WHEN** `lets --version` runs from the flake's `lets` package, built from a commit whose `lets/package.json` holds version `0.5.0`
- **THEN** stdout is `0.5.0`

#### Scenario: Tarball install
- **WHEN** `node bin/lets --version` runs from the release folder built from the same commit
- **THEN** stdout is `0.5.0`

#### Scenario: Source tree
- **WHEN** `lets --version` runs from the source tree's `lets/bin/lets`
- **THEN** stdout is `0.0.0-dev`

### Requirement: The OpenSpec CLI version warning works on every install
`lets sync` SHALL compare the OpenSpec CLI on PATH with the version recorded in the `release.json` of the `lets` package that runs, whether that package comes from the Nix flake or the release tarball. When the two differ, it SHALL warn: `the OpenSpec CLI on PATH is <found>, but this release's openspec-* skills were generated from <pinned>. Pin the CLI to <pinned>.` When they match, or when either version is unknown, it SHALL NOT warn.

#### Scenario: Nix install with a different CLI on PATH
- **WHEN** `lets sync` runs from the flake's `lets` package, whose `release.json` records OpenSpec `1.2.3`, and `openspec --version` on PATH prints `1.4.0`
- **THEN** stderr holds `the OpenSpec CLI on PATH is 1.4.0, but this release's openspec-* skills were generated from 1.2.3. Pin the CLI to 1.2.3.`

#### Scenario: The same CLI
- **WHEN** `lets sync` runs and `openspec --version` prints the version the package's `release.json` records
- **THEN** the output holds no OpenSpec CLI version warning

#### Scenario: No release.json
- **WHEN** `lets sync` runs from the source tree, which has no `release.json`
- **THEN** the output holds no OpenSpec CLI version warning

### Requirement: A release tag must match the version source
The release workflow SHALL publish a tarball for the tag `v<version>` only when `<version>` equals the version in `lets/package.json` at the tagged commit. Otherwise it SHALL fail before it publishes, with a message that names both versions.

#### Scenario: Matching tag
- **WHEN** the tag `v0.6.0` is pushed on a commit whose `lets/package.json` holds `0.6.0`
- **THEN** the workflow publishes `lets-spec-0.6.0.tar.gz`, whose `release.json` holds version `0.6.0`

#### Scenario: Tag without a version bump
- **WHEN** the tag `v0.6.0` is pushed on a commit whose `lets/package.json` holds `0.5.0`
- **THEN** the workflow fails without publishing, and its log names `v0.6.0` and `0.5.0`
