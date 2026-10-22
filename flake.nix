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
      inherit (lib.importJSON ./flows.json) flows;

      # Only the folders a release is built from, so a change elsewhere, such
      # as to the README, does not make a new release.
      releaseSource = lib.fileset.toSource {
        root = ./.;
        fileset = lib.fileset.unions [ ./schemas ./skills ./overlays ];
      };

      # Only the pnpm workspace, so a skill edit does not rebuild the CLI.
      # Every workspace package must be here, or the lockfile does not match.
      # lets/contrib/ holds only the source tree's link to the default
      # resolver, which points outside lets/. The build never reads it.
      workspaceSource = lib.fileset.toSource {
        root = ./.;
        fileset = lib.fileset.difference
          (lib.fileset.unions ([
            ./package.json ./pnpm-workspace.yaml ./pnpm-lock.yaml ./tsconfig.json ./lets
          ] ++ lib.optional (builtins.pathExists ./contrib) ./contrib))
          (lib.fileset.maybeMissing ./lets/contrib);
      };

      # The workspace's dependencies from pnpm-lock.yaml. When the lockfile
      # changes, set hash to lib.fakeHash, build, and copy in the hash Nix
      # prints.
      pnpmDepsFor = pkgs: pkgs.fetchPnpmDeps {
        pname = "lets-spec";
        version = "0.0.0";
        src = workspaceSource;
        fetcherVersion = 4;
        # Fetch esbuild's and TypeScript's binaries for every system above,
        # so the hash is the same on each. pnpm fetches only the host's
        # unless told.
        pnpmInstallFlags = [ "--os=linux,darwin" "--cpu=x64,arm64" ];
        hash = "sha256-qx8RTpo/oR00t8b5kQcOg1noEyPLgBLlIwsytgGyF5I=";
      };

      app = pkgs: name: description: {
        type = "app";
        meta.description = description;
        program = "${(packagesFor pkgs).default}/bin/${name}";
      };
    in
    {
      flakeModules.default = import ./nix/flake-module.nix { inherit self flows; };

      packages = forAllSystems (pkgs: let
        pnpmDeps = pnpmDepsFor pkgs;

        # The pinned CLI, without its check for npm updates.
        openspec = pkgs.symlinkJoin {
          name = "openspec-${pkgs.openspec.version}";
          paths = [ pkgs.openspec ];
          nativeBuildInputs = [ pkgs.makeWrapper ];
          postBuild = "wrapProgram $out/bin/openspec --set OPENSPEC_NO_UPDATE_CHECK 1";
        };

        # The openspec-* skills for the workflows in build/openspec.json.
        openspec-skills = pkgs.runCommand "openspec-skills-${pkgs.openspec.version}"
          { nativeBuildInputs = [ pkgs.openspec pkgs.nodejs_26 ]; }
          ''
            export HOME="$TMPDIR"
            node ${./build/generate-skills.mjs} ${./build/openspec.json} "$out"
          '';

        # What lets sync copies and creates for one flow.
        release = flow: let recipe = flows.${flow}; in
          pkgs.runCommand "lets-spec-release" { nativeBuildInputs = [ pkgs.nodejs_26 ]; } ''
            node ${./build/build-release.mjs} ${releaseSource} ${openspec-skills} $out \
              ${lib.concatStringsSep "," recipe.schemas} \
              ${lib.escapeShellArgs recipe.skills}
          '';

        # The lets command: the bundle esbuild makes, in libexec, and a
        # bin/lets that runs it with Node 26. The bundle keeps its
        # #!/usr/bin/env node, because the tarball ships it as it is. lets
        # runs its default resolver from contrib/ beside libexec/.
        lets-cli = pkgs.stdenv.mkDerivation {
          pname = "lets";
          version = "0.0.0";
          src = workspaceSource;
          nativeBuildInputs = [ pkgs.nodejs_26 pkgs.pnpm pkgs.pnpmConfigHook pkgs.makeWrapper ];
          inherit pnpmDeps;
          dontPatchShebangs = true;
          buildPhase = ''
            runHook preBuild
            pnpm --filter lets build
            runHook postBuild
          '';
          installPhase = ''
            runHook preInstall
            install -Dm755 lets/dist/lets $out/libexec/lets
            install -Dm755 ${lets-delegate-subagent}/libexec/lets-delegate-subagent $out/contrib/lets-delegate-subagent
            makeWrapper ${pkgs.nodejs_26}/bin/node $out/bin/lets --add-flags $out/libexec/lets
            runHook postInstall
          '';
        };

        # A resolver program, for a user's profile: the bundle esbuild makes,
        # in libexec, and a bin/<program> that runs it with Node 26. Never in
        # a dev shell: it answers for the machine, not the project. It runs
        # its harness's commands, such as git and t3, from PATH, because they
        # are the user's own install.
        resolver = program: dir: pkgs.stdenv.mkDerivation {
          pname = program;
          version = "0.0.0";
          src = workspaceSource;
          nativeBuildInputs = [ pkgs.nodejs_26 pkgs.pnpm pkgs.pnpmConfigHook pkgs.makeWrapper ];
          inherit pnpmDeps;
          dontPatchShebangs = true;
          buildPhase = ''
            runHook preBuild
            pnpm --filter ${program} build
            runHook postBuild
          '';
          installPhase = ''
            runHook preInstall
            install -Dm755 contrib/${dir}/dist/${program} $out/libexec/${program}
            makeWrapper ${pkgs.nodejs_26}/bin/node $out/bin/${program} \
              --add-flags $out/libexec/${program}
            runHook postInstall
          '';
          meta.mainProgram = program;
        };
        lets-delegate-t3 = resolver "lets-delegate-t3" "t3-resolver";
        lets-delegate-herdr = resolver "lets-delegate-herdr" "herdr-resolver";
        # The default resolver, for lets-cli and dist only. lets runs it from
        # beside itself, so it is not exported, and no one puts it on PATH.
        lets-delegate-subagent = resolver "lets-delegate-subagent" "subagent-resolver";

        # lets, bound to one release.
        lets = flow:
          pkgs.runCommand "lets"
            { nativeBuildInputs = [ pkgs.makeWrapper ]; }
            ''
              makeWrapper ${lets-cli}/bin/lets $out/bin/lets \
                --set WORKFLOW_RELEASE ${release flow} \
                --prefix PATH : ${lib.makeBinPath [ pkgs.git ]}
            '';

        # The folder the release tarball is made from: the lets bundle, one
        # release for every flow, and the contrib resolvers outside bin/, so
        # mise never puts them on a project's PATH. CI sets the real version.
        dist = pkgs.runCommand "lets-spec-dist" { } ''
          mkdir -p $out/bin $out/releases $out/contrib
          cp ${lets-cli}/libexec/lets $out/bin/lets
          cp ${lets-delegate-t3}/libexec/lets-delegate-t3 $out/contrib/lets-delegate-t3
          cp ${lets-delegate-herdr}/libexec/lets-delegate-herdr $out/contrib/lets-delegate-herdr
          cp ${lets-delegate-subagent}/libexec/lets-delegate-subagent $out/contrib/lets-delegate-subagent
          install -m755 ${./contrib/headless-resolver} $out/contrib/headless-resolver
          ${lib.concatMapStringsSep "\n" (flow: "cp -R ${release flow} $out/releases/${flow}") (lib.attrNames flows)}
          cp ${pkgs.writeText "release.json" (builtins.toJSON {
            version = "0.0.0-dev";
            openspec = pkgs.openspec.version;
            commit = self.rev or "dirty";
          })} $out/release.json
        '';

        # Everything a project's dev shell needs from this repo. It carries
        # Node for lets, and the gh the skills call.
        bundle = flow: pkgs.buildEnv {
          name = "lets-spec-${flow}";
          paths = [ openspec (lets flow) pkgs.gh pkgs.nodejs_26 ];
        };
      in
        { inherit openspec openspec-skills lets-cli lets-delegate-t3 lets-delegate-herdr dist; default = bundle "standard"; }
        // lib.genAttrs (lib.attrNames flows) bundle);

      apps = forAllSystems (pkgs: {
        lets = app pkgs "lets" "The lets-spec command. lets sync sets up this project, copies in the skills, and warns about anything to fix";
      });

      checks = forAllSystems (pkgs: {
        # Builds the package for every flow, so a broken recipe never
        # reaches a project.
        flows = pkgs.linkFarmFromDrvs "every-flow"
          (map (flow: (packagesFor pkgs).${flow}) (lib.attrNames flows));

        # The bats tests run the scripts directly, so they need the
        # workspace's node_modules. The smoke test then sets up a project with
        # the packaged commands, to prove the wrappers find the release, and
        # that the pinned OpenSpec CLI works with the result.
        commands = pkgs.runCommand "commands-check"
          {
            nativeBuildInputs = [ pkgs.bats pkgs.git pkgs.yq-go pkgs.jq pkgs.nodejs_26 pkgs.pnpm pkgs.pnpmConfigHook (packagesFor pkgs).default ];
            pnpmDeps = pnpmDepsFor pkgs;
          }
          ''
            export HOME="$TMPDIR" OPENSPEC_TELEMETRY=0
            cp -R ${self} repo
            chmod -R u+w repo
            (cd repo && pnpmConfigHook)
            bats repo/tests

            mkdir project
            cd project
            git init --quiet
            # The first run creates the project's files.
            lets sync >/dev/null 2>&1
            # A context the pinned OpenSpec CLI must pass on to agents.
            yq -i '.context = "CONTEXT-MARKER"' openspec/config.yaml
            lets sync 2>warnings
            if [ -s warnings ]; then cat warnings >&2; exit 1; fi
            # lets sync copies the skills in. It does not link them.
            [ ! -L .agents/skills/openspec-propose ]
            [ -f .agents/skills/openspec-propose/SKILL.md ]
            [ -f .claude/skills/lets-test-first/SKILL.md ]
            # Agents read the rules from AGENTS.md, through CLAUDE.md for Claude.
            grep -q '^## Workflow$' CLAUDE.md
            # Once the project commits the copies, the check passes.
            git add -A
            lets sync --check

            openspec new change gate </dev/null >/dev/null 2>&1
            openspec instructions brainstorm --change gate </dev/null >instructions 2>stderr
            if grep -i warning stderr || ! grep -q CONTEXT-MARKER instructions; then
              echo "The pinned OpenSpec CLI did not read openspec/config.yaml." >&2
              cat stderr >&2
              exit 1
            fi
            # A standard project also gets lets-minimal, for chores and
            # small stories, and the skill that sets up its backlog.
            [ -f openspec/schemas/lets-minimal/schema.yaml ]
            [ -f .agents/skills/lets-setup-backlog/SKILL.md ]
            # With no other resolver on PATH and no delegate config, the
            # packaged lets runs the default it carries.
            echo 'Run lets-build on branch build-x' > p.md
            [ "$(lets delegate handoff --name build-x --prompt-file p.md | jq -r .resolver)" = subagent ]

            # A minimal project gets the minimal schema and only its skills.
            cd ..
            mkdir minimal
            cd minimal
            git init --quiet
            minimal=${(packagesFor pkgs).minimal}
            $minimal/bin/lets sync >/dev/null 2>&1
            $minimal/bin/lets sync 2>warnings
            if [ -s warnings ]; then cat warnings >&2; exit 1; fi
            [ "$(yq -r .schema openspec/config.yaml)" = lets-minimal ]
            [ -f openspec/schemas/lets-minimal/schema.yaml ]
            [ ! -e openspec/schemas/lets-standard ]
            [ -f .agents/skills/lets-test-first/SKILL.md ]
            [ ! -e .agents/skills/lets-review-plan ]
            openspec new change small </dev/null >/dev/null 2>&1
            # Write to a file: the CLI spins if a reader such as grep -q
            # closes the pipe early.
            openspec instructions brainstorm --change small </dev/null >instructions 2>&1
            grep -qF '**Why:**' instructions
            touch "$out"
          '';

        # The folder the release tarball is made from. Run its lets as a
        # project would after installing the tarball: one script, run by the
        # project's own node, with no node_modules.
        dist = let
          dist = (packagesFor pkgs).dist;
          names = lib.concatStringsSep "\n" (lib.sort (a: b: a < b) (lib.attrNames flows));
        in pkgs.runCommand "dist-check"
          { nativeBuildInputs = [ pkgs.nodejs_26 pkgs.git pkgs.jq (packagesFor pkgs).openspec ]; }
          ''
            export HOME="$TMPDIR"
            [ "$(ls ${dist}/bin)" = lets ]
            [ -x ${dist}/bin/lets ]
            [ "$(head -n 1 ${dist}/bin/lets)" = '#!/usr/bin/env node' ]
            [ ! -e ${dist}/node_modules ]
            # The resolvers are per user, so they are never on a project's PATH.
            [ "$(ls ${dist}/contrib | tr '\n' ' ')" = "headless-resolver lets-delegate-herdr lets-delegate-subagent lets-delegate-t3 " ]
            [ -x ${dist}/contrib/headless-resolver ]
            [ "$(head -n 1 ${dist}/contrib/headless-resolver)" = '#!/bin/sh' ]
            for program in lets-delegate-herdr lets-delegate-subagent lets-delegate-t3; do
              [ -x ${dist}/contrib/$program ]
              [ "$(head -n 1 ${dist}/contrib/$program)" = '#!/usr/bin/env node' ]
            done
            [ "$(ls ${dist}/releases)" = "${names}" ]
            [ "$(jq -r .openspec ${dist}/release.json)" = "${pkgs.openspec.version}" ]
            mkdir project
            cd project
            git init --quiet
            export LETS_SPEC_FLOW=minimal
            # The build sandbox has no /usr/bin/env, so node runs the script.
            [ "$(node ${dist}/bin/lets --version)" = 0.0.0-dev ]
            node ${dist}/bin/lets sync >/dev/null 2>stderr
            if grep -qi 'openspec' stderr; then cat stderr >&2; exit 1; fi
            grep -q 'schema: lets-minimal' openspec/config.yaml
            git add -A
            node ${dist}/bin/lets sync --check
            # Outside its harness each resolver declines, with no node_modules,
            # and says which harness it needs.
            declines() {
              status=0
              echo "{\"protocol\":1,\"cwd\":\"$PWD\"}" | node ${dist}/contrib/$1 probe 2>stderr || status=$?
              [ "$status" -eq 75 ]
              [ "$(cat stderr)" = "$2" ]
            }
            declines lets-delegate-t3 'lets-delegate-t3: not inside T3 Code'
            declines lets-delegate-herdr 'lets-delegate-herdr: not inside herdr'
            # The default never declines. A copy alone answers for itself.
            mkdir ../alone
            cp ${dist}/contrib/lets-delegate-subagent ../alone/
            [ "$(echo "{\"protocol\":1,\"cwd\":\"$PWD\"}" | node ../alone/lets-delegate-subagent probe)" = '{"resolver":"subagent"}' ]
            # With nothing else installed or configured, the tarball's lets
            # finds the default beside it.
            echo 'Run lets-build on branch build-x' > p.md
            [ "$(node ${dist}/bin/lets delegate handoff --name build-x --prompt-file p.md | jq -r .resolver)" = subagent ]
            touch "$out"
          '';

        # The unit tests for the lets package and the contrib resolvers, and
        # the type check. They use fakes, so no harness and no real gh
        # run here.
        node-tests = pkgs.runCommand "node-tests"
          {
            # jq is the one tool the shell example needs.
            nativeBuildInputs = [ pkgs.nodejs_26 pkgs.pnpm pkgs.pnpmConfigHook pkgs.git pkgs.jq ];
            pnpmDeps = pnpmDepsFor pkgs;
          }
          ''
            cp -R ${self} repo
            chmod -R u+w repo
            cd repo
            export HOME="$TMPDIR"
            pnpmConfigHook
            # The test fixtures and the resolvers run as programs, and the
            # sandbox has no /usr/bin/env or /bin/sh.
            patchShebangs tests contrib/t3-resolver/bin contrib/herdr-resolver/bin contrib/subagent-resolver/bin contrib/headless-resolver
            # Node's runner expands the glob itself. It does not take a folder.
            node --test "tests/lets/**/*.test.ts" "tests/resolver-kit/*.test.ts" "tests/t3-resolver/*.test.ts" "tests/herdr-resolver/*.test.ts" "tests/subagent-resolver/*.test.ts"
            pnpm check
            # The default, lets-delegate-subagent, the contrib resolvers and the shell example
            # keep the shape of the contract. None starts a session here.
            pnpm conformance
            touch "$out"
          '';

        # A flake-parts project can import the module, choose its flow and
        # skills mode, and read the packages and shell hook those give.
        flake-module = let
          system = pkgs.stdenv.hostPlatform.system;
          consumerInputs = { inherit nixpkgs; self = { inputs = consumerInputs; outPath = ./.; }; };
          consumer = flake-parts.lib.mkFlake { inputs = consumerInputs; } {
            systems = [ system ];
            imports = [ self.flakeModules.default ];
            perSystem = { config, pkgs, ... }: {
              letsSpec = { flow = "standard"; skills = "ignored"; };
              devShells.default = pkgs.mkShell {
                packages = config.letsSpec.packages;
                shellHook = config.letsSpec.shellHook;
              };
            };
          };
          shell = consumer.devShells.${system}.default;
          hook = pkgs.writeText "shell-hook" shell.shellHook;
        in pkgs.runCommand "flake-module-check" { nativeBuildInputs = [ pkgs.git ]; } ''
          export HOME="$TMPDIR"
          lets="$(grep -o '/nix/store/[^ "'"'"';]*/bin/lets' ${hook} | head -n 1)"
          # The module wraps lets to pass on the skills mode.
          if ! grep -q "LETS_SPEC_SKILLS.*ignored" "$lets"; then
            echo "The shell hook's lets does not set LETS_SPEC_SKILLS=ignored." >&2
            cat ${hook} "$lets" >&2
            exit 1
          fi
          # In CI the hook syncs nothing, so lets sync --check sees the
          # committed tree. Elsewhere it syncs.
          mkdir project
          cd project
          git init --quiet
          CI=true bash ${hook}
          if [ -n "$(ls -A | grep -Fvx .git)" ]; then
            echo "With CI set, the shell hook wrote files:" >&2
            ls -A >&2
            exit 1
          fi
          CI= bash ${hook} >/dev/null 2>&1
          [ -f AGENTS.md ] || { echo "Without CI, the shell hook did not sync." >&2; exit 1; }
          touch "$out"
        '';
      });

      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = [ (packagesFor pkgs).openspec pkgs.bats pkgs.yq-go pkgs.jq pkgs.nodejs_26 pkgs.pnpm ];
        };
      });
    };
}
