# The flows. Each is a recipe: one schema from schemas/, and the skills from
# skills/ that the schema calls. A flow is named after its schema. The build
# fails if a recipe names a schema or skill that does not exist.
#
# A release also gets the skills of its backlog, from `backlogs` in
# flake.nix. lets-shape comes from there, because its script is built for
# one backlog. A skill listed in both places fails the build.
{
  standard = {
    schema = "standard";
    skills = [
      "lets-build"
      "brainstorming"
      "writing-specs"
      "writing-adrs"
      "writing-tasks"
      "test-driven-development"
      "peer-plan-review"
      "peer-code-review"
      "spawn-session"
    ];
  };
  minimal = {
    schema = "minimal";
    skills = [
      "lets-build"
      "brainstorming"
      "writing-specs"
      "writing-tasks"
      "test-driven-development"
      "spawn-session"
    ];
  };
}
