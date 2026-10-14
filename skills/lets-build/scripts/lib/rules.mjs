// The rules for picking and claiming a story. Pure functions over issues as
// GitHub returns them; main.mjs runs gh and hands the results here.

const RANKS = { must: 0, should: 1, could: 2 };

// The rank of a priority: Must first. null for Wont, an unknown priority
// and no priority.
function rank(priority) {
  return priority != null && Object.hasOwn(RANKS, priority) ? RANKS[priority] : null;
}

// The Priority field's option, lowercased, or null when the field is unset
// or cleared.
function fieldPriority(issue) {
  const value = (issue.issue_field_values ?? [])
    .find((each) => each.issue_field_name === 'Priority' && each.single_select_option?.name != null);
  return value ? value.single_select_option.name.toLowerCase() : null;
}

// The highest priority/* label. Wont, and a label this does not know, rank
// below Could.
function labelPriority(issue) {
  const priorities = (issue.labels ?? [])
    .map((label) => label.name)
    .filter((name) => name.startsWith('priority/'))
    .map((name) => name.slice('priority/'.length));
  const ranked = priorities
    .map((priority, index) => ({ priority, index, rank: rank(priority) ?? 3 }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index);
  return ranked.length ? ranked[0].priority : null;
}

// Pick the next story from the items of a GitHub issue search.
//
// The search has already left out closed, assigned and blocked issues, and
// epics. This ranks what is left: Must, then Should, then Could, then the
// lowest number. Priority comes from the Priority issue field, or from the
// highest priority/* label when the field has no value. Issues with no
// priority, or Wont, are skipped. Answers null when no story is ready.
export function nextStory(items) {
  const stories = items
    .map((item) => ({
      number: item.number,
      title: item.title,
      url: item.html_url,
      priority: fieldPriority(item) ?? labelPriority(item),
    }))
    .filter((story) => rank(story.priority) !== null)
    .sort((a, b) => rank(a.priority) - rank(b.priority) || a.number - b.number);
  return stories[0] ?? null;
}

// What next prints for a story: "#<n> [<priority>] <title>", then its URL.
export function formatStory({ number, title, url, priority }) {
  return `#${number} [${priority}] ${title}\n${url}`;
}

// Why an issue cannot be claimed, or null when it can. An issue that
// already has an assignee is refused.
export function claimRefusal(issue) {
  if (issue.assignees.length === 0) return null;
  const logins = issue.assignees.map((assignee) => assignee.login);
  return `#${issue.number} is already assigned to ${logins.join(', ')}. Run backlog.mjs next for another story.`;
}
