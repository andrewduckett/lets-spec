# The flows. Each is a recipe: one schema from schemas/, and the skills from
# skills/ that the schema calls. A flow is named after its schema. The build
# fails if a recipe names a schema or skill that does not exist.
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
    ];
  };
}
