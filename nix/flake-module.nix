# The flake-parts module that projects import. It defines options of its own,
# so it works in any project, whatever that project calls its shell.
#
#   imports = [ inputs.lets-spec.flakeModules.default ];
#   perSystem = { config, pkgs, ... }: {
#     letsSpec = {
#       flow = "standard";            # or "minimal"
#       backlog = "github-labels";   # or "github-fields"
#       skills = "committed";        # or "ignored"
#     };
#     devShells.default = pkgs.mkShell {
#       packages = config.letsSpec.packages;
#       shellHook = config.letsSpec.shellHook;
#     };
#   };
#
# `self` is this repo's flake, so the commands, the skills and the OpenSpec CLI
# always come from the commit the project pins, not from the project's nixpkgs.
# `flows` and `backlogs` are the choices the flake builds a package for.
{ self, flows, backlogs }:
{ flake-parts-lib, lib, ... }:
{
  options.perSystem = flake-parts-lib.mkPerSystemOption ({ config, system, pkgs, ... }:
    let
      cfg = config.letsSpec;
      package = self.packages.${system}."${cfg.flow}-${cfg.backlog}";
      # The package, with lets-sync wrapped to pass on the skills mode. So
      # lets-sync uses the mode whether the shell hook runs it or you do.
      wrapped = pkgs.symlinkJoin {
        name = "lets-spec-${cfg.flow}-${cfg.backlog}-${cfg.skills}";
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
        backlog = lib.mkOption {
          type = lib.types.enum (lib.attrNames backlogs);
          default = "github-labels";
          description = ''
            How the project's GitHub issues record kind and priority:
            "github-labels" (labels, which every repo has) or "github-fields"
            (the Epic issue type and the Priority issue field). lets-shape's
            backlog script writes this convention, and lets-build's reads
            both.
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
          defaultText = lib.literalExpression ''[ inputs.lets-spec.packages.''${system}."''${flow}-''${backlog}", with lets-sync wrapped to set LETS_SPEC_SKILLS ]'';
          description = ''
            The pinned OpenSpec CLI and lets-sync for the chosen flow and
            backlog, with the gh and jq the skills' scripts call. lets-sync
            uses the chosen skills mode. Add these to the project's
            development shell.
          '';
        };
        shellHook = lib.mkOption {
          type = lib.types.str;
          readOnly = true;
          default = "${wrapped}/bin/lets-sync";
          defaultText = lib.literalExpression ''"''${inputs.lets-spec.packages.''${system}."''${flow}-''${backlog}"}/bin/lets-sync", wrapped to set LETS_SPEC_SKILLS'';
          description = ''
            Creates the project's missing files, keeps the workflow rules in
            AGENTS.md, copies the skills and the schema into the project, and
            warns about anything to fix. Use it as the shell's shellHook.
          '';
        };
      };
    });
}
