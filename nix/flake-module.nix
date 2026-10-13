# The flake-parts module that projects import. It defines options of its own,
# so it works in any project, whatever that project calls its shell.
#
#   imports = [ inputs.lets-spec.flakeModules.default ];
#   perSystem = { config, pkgs, ... }: {
#     letsSpec = {
#       flow = "standard";            # or "minimal"
#       backlog = "github-labels";   # or "github-fields"
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
  options.perSystem = flake-parts-lib.mkPerSystemOption ({ config, system, ... }:
    let
      cfg = config.letsSpec;
      package = self.packages.${system}."${cfg.flow}-${cfg.backlog}";
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
        packages = lib.mkOption {
          type = lib.types.listOf lib.types.package;
          readOnly = true;
          default = [ package ];
          defaultText = lib.literalExpression ''[ inputs.lets-spec.packages.''${system}."''${flow}-''${backlog}" ]'';
          description = ''
            The pinned OpenSpec CLI and lets-sync for the chosen flow and
            backlog, with the gh and jq the skills' scripts call. Add these
            to the project's development shell.
          '';
        };
        shellHook = lib.mkOption {
          type = lib.types.str;
          readOnly = true;
          default = "${package}/bin/lets-sync";
          defaultText = lib.literalExpression ''"''${inputs.lets-spec.packages.''${system}."''${flow}-''${backlog}"}/bin/lets-sync"'';
          description = ''
            Creates the project's missing files, keeps the workflow rules in
            AGENTS.md, links the skills and the schema into the project, and
            warns about anything to fix. Use it as the shell's shellHook.
          '';
        };
      };
    });
}
