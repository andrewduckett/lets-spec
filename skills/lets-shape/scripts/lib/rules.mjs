// The rule for one backlog write. A pure function over the issue as GitHub's
// REST API returns it; main.mjs turns its decision into gh calls.
//
// A write in one convention clears the other on the same issue, so an old
// label never contradicts a new field.

const PRIORITIES = ['Must', 'Should', 'Could', 'Wont'];
const KINDS = ['Epic', 'Story'];
const EPIC_LABEL = { name: 'kind/epic', description: 'A parent issue whose stories are its sub-issues' };

function decision(changes) {
  return { ensureLabels: [], addLabels: [], removeLabels: [], setPriorityField: null, setType: null, ...changes };
}

function setPriority(labels, value, mode) {
  if (!PRIORITIES.includes(value)) return { error: `priority must be Must, Should, Could or Wont, got '${value}'.` };
  const priorityLabels = labels.filter((name) => name.startsWith('priority/'));
  if (mode === 'fields') return decision({ setPriorityField: value, removeLabels: priorityLabels });
  const label = `priority/${value.toLowerCase()}`;
  return decision({
    ensureLabels: [{ name: label, description: `MoSCoW priority: ${value}` }],
    addLabels: [label],
    removeLabels: priorityLabels.filter((name) => name !== label),
  });
}

function setKind(labels, value, mode) {
  if (!KINDS.includes(value)) return { error: `kind must be Epic or Story, got '${value}'.` };
  const removeEpic = labels.includes(EPIC_LABEL.name) ? [EPIC_LABEL.name] : [];
  if (mode === 'fields') return decision({ setType: value, removeLabels: removeEpic });
  if (value === 'Epic') return decision({ ensureLabels: [EPIC_LABEL], addLabels: [EPIC_LABEL.name] });
  return decision({ removeLabels: removeEpic });
}

// What a write changes on the issue. op is set-priority or set-kind; value
// is the priority (Must, Should, Could, Wont) or the kind (Epic, Story);
// mode is labels or fields, how the repo records kind and priority.
//
// Answers { ensureLabels, addLabels, removeLabels, setPriorityField,
// setType }, or { error } on a refusal. ensureLabels are the labels to
// create if the repo lacks them; removeLabels keep the issue's order.
export function writeDecision({ issue, op, value, mode }) {
  const labels = issue.labels.map((label) => label.name);
  if (op === 'set-priority') return setPriority(labels, value, mode);
  if (op === 'set-kind') return setKind(labels, value, mode);
  return { error: `unknown operation '${op}'.` };
}
