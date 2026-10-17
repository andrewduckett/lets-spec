# The flake-parts module that projects import. It defines options of its own,
# so it works in any project, whatever that project calls its shell.
#
#   imports = [ inputs.lets-spec.flakeModules.default ];
#   perSystem = { config, pkgs, ... }: {
#     letsSpec = {
#       flow = "standard";            # or "minimal"
#       skills = "committed";        # or "ignored"
#     };
#     devShells.default = pkgs.mkShell {
#       packages = config.letsSpec.packages;
#       shellHook = config.letsSpec.shellHook;
#     };
#   };
#
# `self` is this repo's flake. So lets-sync, the skills and the OpenSpec CLI
# come from the commit the project pins, not from the project's nixpkgs. The
# wrapper that sets the skills mode is built with the project's own pkgs.
# `flows` are the choices the flake builds a package for.
{ self, flows }:
{ flake-parts-lib, lib, ... }:
{
  options.perSystem = flake-parts-lib.mkPerSystemOption ({ config, system, pkgs, ... }:
    let
      cfg = config.letsSpec;
      package = self.packages.${system}.${cfg.flow};
      # The package, with lets-sync wrapped to pass on the skills mode. So
      # lets-sync uses the mode whether the shell hook runs it or you do.
      wrapped = pkgs.symlinkJoin {
        name = "lets-spec-${cfg.flow}-${cfg.skills}";
        paths = [ package ];
        nativeBuildInputs = [ pkgs.makeWrapper ];
        postBuild = "wrapProgram $out/bin/lets-sync --set LETS_SPEC_SKILLS ${cfg.skills}";
      };
    in
    {
      options.letsSpec = {
        flow = lib.mkOption {
          type = lib.types.enum (lib.attrNames flows);
          default = "standard";
          description = ''
            The flow: the OpenSpec schema the project plans its changes with,
            and the skills that schema calls. Set `schema:` in
            openspec/config.yaml to the same name.
          '';
        };
        skills = lib.mkOption {
          type = lib.types.enum [ "committed" "ignored" ];
          default = "committed";
          description = ''
            Whether git tracks the skills and the schema that lets-sync
            copies into the project. "committed" (the default): the project
            commits them, so every clone has them. "ignored": lets-sync keeps
            a block in .gitignore that ignores them. lets-sync writes the
            same files in both modes.
          '';
        };
        packages = lib.mkOption {
          type = lib.types.listOf lib.types.package;
          readOnly = true;
          default = [ wrapped ];
          defaultText = lib.literalExpression ''[ inputs.lets-spec.packages.''${system}.''${flow}, with lets-sync wrapped to set LETS_SPEC_SKILLS ]'';
          description = ''
            The pinned OpenSpec CLI and lets-sync for the chosen flow,
            with the gh the skills call. lets-sync uses the chosen skills
            mode. Add these to the project's development shell.
          '';
        };
        shellHook = lib.mkOption {
          type = lib.types.str;
          readOnly = true;
          # In CI, `lets-sync --check` must see the tree the project
          # committed. So the hook does not sync when CI is set.
          default = ''
            if [ -z "''${CI:-}" ]; then
              ${wrapped}/bin/lets-sync
            fi
          '';
          defaultText = lib.literalMD "Runs lets-sync, wrapped to set LETS_SPEC_SKILLS, unless the CI environment variable is set.";
          description = ''
            Creates the project's missing files, keeps the workflow rules in
            AGENTS.md, copies the skills and the schema into the project, and
            warns about anything to fix. When the CI environment variable is
            set, it does nothing, so `lets-sync --check` checks the committed
            tree. Use it as the shell's shellHook.
          '';
        };
      };
    });
}
