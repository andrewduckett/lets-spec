# Pick the next story from a GitHub issue search result.
#
# The search has already left out closed, assigned and blocked issues, and
# epics. This ranks what is left: Must, then Should, then Could, then the
# lowest number. Priority comes from the Priority issue field, or from the
# highest priority/* label when the field has no value. Issues with no
# priority, or Wont, are skipped.
#
# Prints "#<n> [<priority>] <title>", then the issue's URL, or nothing.

def rank: if . == null then null else {"must": 0, "should": 1, "could": 2}[.] end;

def field_priority:
  [.issue_field_values[]? | select(.issue_field_name == "Priority")
   | .single_select_option.name? // empty | ascii_downcase]
  | first;

# Wont, and a label this does not know, rank below Could.
def label_priority:
  [.labels[].name | select(startswith("priority/")) | ltrimstr("priority/")]
  | sort_by(rank // 3)
  | first;

def priority: field_priority // label_priority;

[.items[] | {number, title, url: .html_url, priority: priority}
 | select(.priority | rank != null)]
| sort_by((.priority | rank), .number)
| first // empty
| "#\(.number) [\(.priority)] \(.title)", .url
