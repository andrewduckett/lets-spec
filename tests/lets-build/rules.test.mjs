// The rules lets-build's backlog.mjs uses to pick and claim a story. They
// run on objects shaped like GitHub's responses, so they need no gh.
//
// The property test makes many random inputs from a fixed seed, so a run is
// repeatable, and checks a rule that must hold for each one. On a failure it
// prints the input that broke the rule.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { claimRefusal, formatStory, nextStory } from '../../skills/lets-build/scripts/lib/rules.mjs';

// A Priority field whose option was cleared.
const CLEARED = Symbol('cleared');

// An issue as GitHub's search returns it. Its Priority field is field, unset
// when it is null, or cleared when it is CLEARED. Each label is a priority/*
// label.
function issue(n, field, ...labels) {
  const fields = field === null ? [] : [{
    issue_field_name: 'Priority',
    single_select_option: field === CLEARED ? null : { name: field },
  }];
  return {
    number: n,
    title: `story-${n}`,
    html_url: `https://github.com/o/r/issues/${n}`,
    labels: labels.map((label) => ({ name: `priority/${label}` })),
    issue_field_values: fields,
  };
}

// The story nextStory picks for issue n.
function story(n, priority) {
  return { number: n, title: `story-${n}`, url: `https://github.com/o/r/issues/${n}`, priority };
}

// An issue as GitHub's REST API returns it, numbered 7.
function issueWith(labels, assignees = []) {
  return { number: 7, labels: labels.map((name) => ({ name })), assignees: assignees.map((login) => ({ login })) };
}

test('next picks a Must before a Should, and a Should before a Could', () => {
  assert.deepEqual(nextStory([issue(1, null, 'should'), issue(2, null, 'must'), issue(3, null, 'could')]), story(2, 'must'));
  assert.deepEqual(nextStory([issue(1, null, 'could'), issue(2, null, 'should')]), story(2, 'should'));
});

test('next picks the lowest number within a priority', () => {
  assert.deepEqual(nextStory([issue(7, null, 'must'), issue(3, null, 'must')]), story(3, 'must'));
});

test('next reads priority from the Priority field, in any case', () => {
  assert.deepEqual(nextStory([issue(1, null, 'should'), issue(2, 'MUST')]), story(2, 'must'));
});

test('next prefers the Priority field to a priority label', () => {
  assert.deepEqual(nextStory([issue(1, 'Could', 'must'), issue(2, null, 'should')]), story(2, 'should'));
});

test('next falls back to the label when the Priority field is cleared', () => {
  assert.deepEqual(nextStory([issue(1, CLEARED, 'must'), issue(2, null, 'should')]), story(1, 'must'));
});

test('next takes the highest of several priority labels', () => {
  assert.deepEqual(nextStory([issue(1, null, 'could', 'must'), issue(2, null, 'should')]), story(1, 'must'));
});

test('next skips a Wont, and an issue with no priority', () => {
  assert.deepEqual(nextStory([issue(1, null, 'wont'), issue(2, null), issue(3, null, 'could')]), story(3, 'could'));
});

test('next prints nothing when no story is ready', () => {
  assert.equal(nextStory([issue(1, null, 'wont')]), null);
  assert.equal(nextStory([]), null);
});

test('a story prints as its number, priority and title, then its URL', () => {
  assert.equal(formatStory(story(4, 'should')), '#4 [should] story-4\nhttps://github.com/o/r/issues/4');
});

// A small seeded generator, so a failure is repeatable.
function rng(seed) {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x80000000;
  };
}

// Issue n, with a random Priority field, unset or cleared, and a random set
// of priority labels in a random order.
function randomIssue(random, n) {
  const fields = [null, CLEARED, 'Must', 'Should', 'Could', 'Wont'];
  const labels = ['must', 'should', 'could', 'wont'].filter(() => random() < 1 / 3);
  for (let i = labels.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [labels[i], labels[j]] = [labels[j], labels[i]];
  }
  return issue(n, fields[Math.floor(random() * fields.length)], ...labels);
}

// What nextStory should pick, worked out apart from rules.mjs. The field
// wins over labels; among labels, the highest priority wins. Then rank
// Must, Should, Could, then the number.
function expectedNext(issues) {
  const ranks = { must: 0, should: 1, could: 2 };
  const candidates = [];
  for (const each of issues) {
    let p = (each.issue_field_values[0]?.single_select_option?.name ?? '').toLowerCase();
    if (!p) p = ['must', 'should', 'could'].find((rank) => each.labels.some((label) => label.name === `priority/${rank}`)) ?? '';
    if (p in ranks) candidates.push({ rank: ranks[p], n: each.number, p });
  }
  candidates.sort((a, b) => a.rank - b.rank || a.n - b.n);
  return candidates.length ? story(candidates[0].n, candidates[0].p) : null;
}

test('property: next picks the highest priority, then the lowest number, whatever the order', () => {
  const random = rng(1);
  for (let round = 0; round < 40; round++) {
    const count = Math.floor(random() * 7);
    const seen = new Set();
    const issues = [];
    while (issues.length < count) {
      const n = Math.floor(random() * 20) + 1;
      if (seen.has(n)) continue;
      seen.add(n);
      issues.push(randomIssue(random, n));
    }
    const expected = expectedNext(issues);
    assert.deepEqual(nextStory(issues), expected, `issues:\n${JSON.stringify(issues, null, 1)}`);
    assert.deepEqual(nextStory([...issues].reverse()), expected, 'the order of the issues changed the pick');
  }
});

test('claim assigns an unassigned issue to the current user', () => {
  assert.equal(claimRefusal(issueWith([])), null);
});

test('claim refuses an issue that already has an assignee', () => {
  assert.equal(claimRefusal(issueWith([], ['octocat', 'hubot'])),
    '#7 is already assigned to octocat, hubot. Run backlog.mjs next for another story.');
  assert.equal(claimRefusal(issueWith([])), null);
});
