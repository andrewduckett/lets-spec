{
  description = "Shared OpenSpec schema, agent skills and working rules for my personal projects";

  inputs = {
    # nixpkgs pins the OpenSpec CLI, and so the text of the openspec-* skills
    # the flake generates from it.
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

    # Used only by the check that evaluates flakeModules.default.
    flake-parts.url = "github:hercules-ci/flake-parts";
    flake-parts.inputs.nixpkgs-lib.follows = "nixpkgs";
  };

  outputs = { self, nixpkgs, flake-parts }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "aarch64-darwin" ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
      packagesFor = pkgs: self.packages.${pkgs.stdenv.hostPlatform.system};

      inherit (nixpkgs) lib;
      flows = import ./flows.nix;

      # The backlogs a project can choose. Each names the convention the
      # skills' backlog scripts write, and the skills from skills/ it adds to
      # the flow's.
      backlogs = {
        github-labels = { mode = "labels"; skills = [ "lets-shape" ]; };
        github-fields = { mode = "fields"; skills = [ "lets-shape" ]; };
      };

      # Every flow and backlog pair. The flake has one package for each, named
      # <flow>-<backlog>, such as standard-github-labels.
      pairs = lib.cartesianProduct { flow = lib.attrNames flows; backlog = lib.attrNames backlogs; };

      # Only the folders a release is built from, so a change elsewhere, such
      # as to the README, does not make a new release.
      releaseSource = lib.fileset.toSource {
        root = ./.;
        fileset = lib.fileset.unions [ ./schemas ./skills ./overlays ];
      };

      app = pkgs: name: description: {
        type = "app";
        meta.description = description;
        program = "${(packagesFor pkgs).default}/bin/${name}";
      };
    in
    {
      flakeModules.default = import ./nix/flake-module.nix { inherit self flows backlogs; };

      packages = forAllSystems (pkgs: let
        # The pinned CLI, without its check for npm updates.
        openspec = pkgs.symlinkJoin {
          name = "openspec-${pkgs.openspec.version}";
          paths = [ pkgs.openspec ];
          nativeBuildInputs = [ pkgs.makeWrapper ];
          postBuild = "wrapProgram $out/bin/openspec --set OPENSPEC_NO_UPDATE_CHECK 1";
        };

        # The openspec-* skills for the workflows in nix/openspec.json.
        openspec-skills = pkgs.runCommand "openspec-skills-${pkgs.openspec.version}"
          { nativeBuildInputs = [ pkgs.openspec ]; }
          ''
            export HOME="$TMPDIR"
            bash ${./nix/generate-skills.sh} ${./nix/openspec.json} "$out"
          '';

        # What lets-sync copies and creates for one flow and backlog.
        # The build writes the backlog's mode into the skills' scripts.
        release = flow: backlog: let recipe = flows.${flow}; in
          pkgs.runCommand "lets-spec-release" { } ''
            bash ${./nix/build-release.sh} ${releaseSource} ${openspec-skills} $out \
              ${recipe.schema} ${backlogs.${backlog}.mode} \
              ${lib.escapeShellArgs (recipe.skills ++ backlogs.${backlog}.skills)}
          '';

        # lets-sync, bound to one release.
        lets-sync = flow: backlog:
          pkgs.runCommand "lets-sync"
            { nativeBuildInputs = [ pkgs.makeWrapper ]; }
            ''
              mkdir -p $out/bin $out/libexec
              cp -R ${./lets-sync} $out/libexec/lets-sync
              makeWrapper ${pkgs.nodejs_24}/bin/node $out/bin/lets-sync \
                --add-flags $out/libexec/lets-sync/bin/lets-sync \
                --set WORKFLOW_RELEASE ${release flow backlog} \
                --prefix PATH : ${lib.makeBinPath [ pkgs.git ]}
            '';

        # Everything a project's dev shell needs from this repo. The skills'
        # scripts run in the shell, so it carries the gh and jq they call.
        bundle = flow: backlog: pkgs.buildEnv {
          name = "lets-spec-${flow}-${backlog}";
          paths = [ openspec (lets-sync flow backlog) pkgs.gh pkgs.jq pkgs.nodejs_24 ];
        };
      in
        { inherit openspec openspec-skills; default = bundle "standard" "github-labels"; }
        // lib.listToAttrs (map (p: lib.nameValuePair "${p.flow}-${p.backlog}" (bundle p.flow p.backlog)) pairs));

      apps = forAllSystems (pkgs: {
        lets-sync = app pkgs "lets-sync" "Set up this project for lets-spec, copy in the skills, and warn about anything to fix";
      });

      checks = forAllSystems (pkgs: {
        # Builds the package for every flow and backlog pair, so a broken
        # recipe never reaches a project.
        flows = pkgs.linkFarmFromDrvs "every-flow"
          (map (p: (packagesFor pkgs)."${p.flow}-${p.backlog}") pairs);

        shellcheck = pkgs.runCommand "shellcheck"
          { nativeBuildInputs = [ pkgs.shellcheck ]; }
          ''
            cd ${./.}
            shellcheck -x nix/*.sh skills/*/scripts/*.sh
            touch "$out"
          '';

        # The bats tests run the scripts directly. The smoke test then sets up
        # a project with the packaged commands, to prove the wrappers find the
        # release, and that the pinned OpenSpec CLI works with the result.
        commands = pkgs.runCommand "commands-check"
          { nativeBuildInputs = [ pkgs.bats pkgs.git pkgs.yq-go pkgs.jq pkgs.nodejs_24 (packagesFor pkgs).default ]; }
          ''
            export HOME="$TMPDIR" OPENSPEC_TELEMETRY=0
            cp -R ${self} repo
            chmod -R u+w repo
            bats repo/tests

            mkdir project
            cd project
            git init --quiet
            # The first run creates the project's files.
            lets-sync >/dev/null 2>&1
            # A context the pinned OpenSpec CLI must pass on to agents.
            yq -i '.context = "CONTEXT-MARKER"' openspec/config.yaml
            lets-sync 2>warnings
            if [ -s warnings ]; then cat warnings >&2; exit 1; fi
            # lets-sync copies the skills in. It does not link them.
            [ ! -L .agents/skills/openspec-propose ]
            [ -f .agents/skills/openspec-propose/SKILL.md ]
            [ -f .claude/skills/lets-test-first/SKILL.md ]
            # Agents read the rules from AGENTS.md, through CLAUDE.md for Claude.
            grep -q '^## Workflow$' CLAUDE.md
            # Once the project commits the copies, the check passes.
            git add -A
            lets-sync --check

            openspec new change gate </dev/null >/dev/null 2>&1
            openspec instructions brainstorm --change gate </dev/null >instructions 2>stderr
            if grep -i warning stderr || ! grep -q CONTEXT-MARKER instructions; then
              echo "The pinned OpenSpec CLI did not read openspec/config.yaml." >&2
              cat stderr >&2
              exit 1
            fi
            # Each entry point runs its own backlog script, and lets-shape's
            # copy carries the backlog's mode.
            bash .agents/skills/lets-build/scripts/backlog.sh --help >/dev/null
            bash .agents/skills/lets-shape/scripts/backlog.sh --help >/dev/null
            grep -q '^mode="labels"$' .agents/skills/lets-shape/scripts/backlog.sh

            # A minimal project gets the minimal schema and only its skills.
            cd ..
            mkdir minimal
            cd minimal
            git init --quiet
            minimal=${(packagesFor pkgs).minimal-github-labels}
            $minimal/bin/lets-sync >/dev/null 2>&1
            $minimal/bin/lets-sync 2>warnings
            if [ -s warnings ]; then cat warnings >&2; exit 1; fi
            [ "$(yq -r .schema openspec/config.yaml)" = lets-minimal ]
            [ -f openspec/schemas/lets-minimal/schema.yaml ]
            [ -f .agents/skills/lets-test-first/SKILL.md ]
            [ ! -e .agents/skills/lets-review-plan ]
            openspec new change small </dev/null >/dev/null 2>&1
            # Write to a file: the CLI spins if a reader such as grep -q
            # closes the pipe early.
            openspec instructions brainstorm --change small </dev/null >instructions 2>&1
            grep -qF '**Why:**' instructions
            touch "$out"
          '';

        # The unit tests for the lets-spawn script and the lets-sync package.
        # They use fakes, so no harness runs here.
        node-tests = pkgs.runCommand "node-tests" { nativeBuildInputs = [ pkgs.nodejs_24 pkgs.git ]; } ''
          cp -R ${self} repo
          chmod -R u+w repo
          cd repo
          export HOME="$TMPDIR"
          # Node's runner expands the glob itself. It does not take a folder.
          node --test "tests/lets-spawn/*.test.mjs" "tests/lets-sync/*.test.mjs"
          touch "$out"
        '';

        # A flake-parts project can import the module, choose its flow,
        # backlog and skills mode, and read the packages and shell hook those
        # give.
        flake-module = let
          system = pkgs.stdenv.hostPlatform.system;
          consumerInputs = { inherit nixpkgs; self = { inputs = consumerInputs; outPath = ./.; }; };
          consumer = flake-parts.lib.mkFlake { inputs = consumerInputs; } {
            systems = [ system ];
            imports = [ self.flakeModules.default ];
            perSystem = { config, pkgs, ... }: {
              letsSpec = { flow = "standard"; backlog = "github-fields"; skills = "ignored"; };
              devShells.default = pkgs.mkShell {
                packages = config.letsSpec.packages;
                shellHook = config.letsSpec.shellHook;
              };
            };
          };
          shell = consumer.devShells.${system}.default;
        in pkgs.runCommand "flake-module-check" { } ''
          hook=${shell.shellHook}
          # The module wraps lets-sync to pass on the skills mode.
          if ! grep -q "LETS_SPEC_SKILLS.*ignored" "$hook"; then
            echo "The shell hook's lets-sync does not set LETS_SPEC_SKILLS=ignored." >&2
            cat "$hook" >&2
            exit 1
          fi
          # The wrapped lets-sync names its release in WORKFLOW_RELEASE.
          release="$(grep -oh '/nix/store/[^ "'"'"']*-lets-spec-release' "$hook" "$(dirname "$hook")"/.lets-sync-wrapped | head -n 1)"
          script="$release/overlay/.agents/skills/lets-shape/scripts/backlog.sh"
          if ! grep -q '^mode="fields"$' "$script"; then
            echo "The github-fields backlog did not write mode=\"fields\" into $script." >&2
            exit 1
          fi
          touch "$out"
        '';
      });

      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = [ (packagesFor pkgs).openspec pkgs.bats pkgs.shellcheck pkgs.yq-go pkgs.jq pkgs.nodejs_24 ];
        };
      });
    };
}
