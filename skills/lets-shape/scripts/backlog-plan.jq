# Plan the gh commands for one backlog write, from the issue as GitHub's
# REST API returns it. backlog.sh runs them in order.
#
# Arguments:
#   $op     set-priority or set-kind
#   $value  the priority (Must, Should, Could, Wont) or the kind (Epic, Story)
#   $mode   labels or fields: how the repo records kind and priority
#   $field  the Priority field's id, in fields mode
#
# Prints one JSON array of gh arguments per line. ["ensure-label", name,
# description] asks for a label to be created if the repo lacks it. On a
# refusal it prints {"error": message} instead.
#
# A write in one convention clears the other on the same issue, so an old
# label never contradicts a new field.

def n: .number | tostring;
def labels: [.labels[].name];
def priority_labels: [labels[] | select(startswith("priority/"))];
def has_epic_label: labels | index("kind/epic") != null;
def remove(names): if names == [] then [] else ["--remove-label", (names | join(","))] end;

def set_priority:
  if ($value | IN("Must", "Should", "Could", "Wont") | not) then
    {error: "priority must be Must, Should, Could or Wont, got '\($value)'."}
  elif $mode == "fields" then
    ["api", "--method", "POST", "repos/{owner}/{repo}/issues/\(n)/issue-field-values",
     "-F", "issue_field_values[][field_id]=\($field)",
     "-f", "issue_field_values[][value]=\($value)"],
    (select(priority_labels != []) | ["issue", "edit", n] + remove(priority_labels))
  else
    ("priority/" + ($value | ascii_downcase)) as $label
    | ["ensure-label", $label, "MoSCoW priority: \($value)"],
      ["issue", "edit", n, "--add-label", $label] + remove(priority_labels - [$label])
  end;

def set_kind:
  if ($value | IN("Epic", "Story") | not) then
    {error: "kind must be Epic or Story, got '\($value)'."}
  elif $mode == "fields" then
    ["issue", "edit", n, "--type", $value],
    (select(has_epic_label) | ["issue", "edit", n, "--remove-label", "kind/epic"])
  elif $value == "Epic" then
    ["ensure-label", "kind/epic", "A parent issue whose stories are its sub-issues"],
    ["issue", "edit", n, "--add-label", "kind/epic"]
  else
    select(has_epic_label) | ["issue", "edit", n, "--remove-label", "kind/epic"]
  end;

if $op == "set-priority" then set_priority
elif $op == "set-kind" then set_kind
else {error: "unknown operation '\($op)'."}
end
