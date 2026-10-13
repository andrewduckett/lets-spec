# Plan the gh command that claims one issue, from the issue as GitHub's
# REST API returns it.
#
# Prints one JSON array of gh arguments. When the issue already has an
# assignee, it prints {"error": message} instead.

if (.assignees | length) > 0 then
  {error: "#\(.number) is already assigned to \([.assignees[].login] | join(", ")). Run backlog.sh next for another story."}
else
  ["issue", "edit", (.number | tostring), "--add-assignee", "@me"]
end
