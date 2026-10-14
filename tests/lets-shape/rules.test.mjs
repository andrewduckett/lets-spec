// The rule lets-shape's backlog.mjs uses to plan a write. It runs on issues
// shaped like GitHub's responses, so it needs no gh.
//
// The property test makes many random inputs from a fixed seed, so a run is
// repeatable, and checks a rule that must hold for each one. On a failure it
// prints the input that broke the rule.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { writeDecision } from '../../skills/lets-shape/scripts/lib/rules.mjs';

// An issue as GitHub's REST API returns it, numbered 7.
function issueWith(labels, assignees = []) {
  return { number: 7, labels: labels.map((name) => ({ name })), assignees: assignees.map((login) => ({ login })) };
}

// A decision that changes nothing, to spread the changes over.
const NOTHING = { ensureLabels: [], addLabels: [], removeLabels: [], setPriorityField: null, setType: null };

test('set-priority with labels creates the label if needed, adds it, and removes the old one', () => {
  assert.deepEqual(writeDecision({ issue: issueWith(['priority/could', 'area/ui']), op: 'set-priority', value: 'Must', mode: 'labels' }), {
    ensureLabels: [{ name: 'priority/must', description: 'MoSCoW priority: Must' }],
    addLabels: ['priority/must'], removeLabels: ['priority/could'], setPriorityField: null, setType: null,
  });
});

test('set-priority with fields sets the Priority field, and removes any priority label', () => {
  assert.deepEqual(writeDecision({ issue: issueWith(['priority/must']), op: 'set-priority', value: 'Should', mode: 'fields' }),
    { ...NOTHING, removeLabels: ['priority/must'], setPriorityField: 'Should' });
});

test('set-kind Epic with labels creates the label if needed, then adds it', () => {
  assert.deepEqual(writeDecision({ issue: issueWith([]), op: 'set-kind', value: 'Epic', mode: 'labels' }), {
    ...NOTHING,
    ensureLabels: [{ name: 'kind/epic', description: 'A parent issue whose stories are its sub-issues' }],
    addLabels: ['kind/epic'],
  });
});

test('set-kind Story with labels removes the epic label, and does nothing on a story', () => {
  assert.deepEqual(writeDecision({ issue: issueWith(['kind/epic']), op: 'set-kind', value: 'Story', mode: 'labels' }),
    { ...NOTHING, removeLabels: ['kind/epic'] });
  assert.deepEqual(writeDecision({ issue: issueWith([]), op: 'set-kind', value: 'Story', mode: 'labels' }), NOTHING);
});

test('set-kind with fields sets the issue type, and removes the epic label', () => {
  assert.deepEqual(writeDecision({ issue: issueWith(['kind/epic']), op: 'set-kind', value: 'Epic', mode: 'fields' }),
    { ...NOTHING, removeLabels: ['kind/epic'], setType: 'Epic' });
});

test('a write refuses a value it does not know', () => {
  assert.deepEqual(writeDecision({ issue: issueWith([]), op: 'set-priority', value: 'High', mode: 'labels' }),
    { error: "priority must be Must, Should, Could or Wont, got 'High'." });
  assert.deepEqual(writeDecision({ issue: issueWith([]), op: 'set-kind', value: 'Bug', mode: 'labels' }),
    { error: "kind must be Epic or Story, got 'Bug'." });
});

test('a write refuses an operation it does not know', () => {
  assert.deepEqual(writeDecision({ issue: issueWith([]), op: 'set-size', value: 'L', mode: 'labels' }),
    { error: "unknown operation 'set-size'." });
});

// A small seeded generator, so a failure is repeatable.
function rng(seed) {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x80000000;
  };
}

// The issue's labels once gh has carried out the decision, sorted. Fails if
// the decision adds a label it did not first ask to create.
function applyDecision(decision, labels) {
  const ensured = new Set(decision.ensureLabels.map((label) => label.name));
  for (const name of decision.addLabels) {
    assert.ok(ensured.has(name), `added ${name} without creating it`);
  }
  const have = new Set(labels.filter((name) => !decision.removeLabels.includes(name)));
  for (const name of decision.addLabels) have.add(name);
  return [...have].sort();
}

// The labels a write should leave, worked out apart from rules.mjs.
function expectedLabels(op, value, mode, labels) {
  const kept = labels.filter((name) => (op === 'set-priority' ? !name.startsWith('priority/') : name !== 'kind/epic'));
  if (op === 'set-priority' && mode === 'labels') kept.push(`priority/${value.toLowerCase()}`);
  if (op === 'set-kind' && mode === 'labels' && value === 'Epic') kept.push('kind/epic');
  return kept.sort();
}

test('property: a write sets what it is asked to, keeps every other label, and a second run changes nothing', () => {
  const random = rng(1);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const all = ['priority/must', 'priority/should', 'priority/could', 'priority/wont', 'kind/epic', 'area/ui'];
  for (let round = 0; round < 60; round++) {
    const labels = all.filter(() => random() < 0.5);
    const mode = pick(['labels', 'fields']);
    const [op, value] = random() < 0.5
      ? ['set-priority', pick(['Must', 'Should', 'Could', 'Wont'])]
      : ['set-kind', pick(['Epic', 'Story'])];
    const expected = expectedLabels(op, value, mode, labels);
    const context = `${op} ${value} in ${mode} mode on: ${labels.join(' ')}`;

    const after = applyDecision(writeDecision({ issue: issueWith(labels), op, value, mode }), labels);
    assert.deepEqual(after, expected, context);

    const again = applyDecision(writeDecision({ issue: issueWith(after), op, value, mode }), after);
    assert.deepEqual(again, after, `a second ${context} changed the labels`);
  }
});
