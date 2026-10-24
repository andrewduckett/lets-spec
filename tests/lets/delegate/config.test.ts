import assert from 'node:assert/strict';
import { test } from 'node:test';
import { configPath, guidanceFor, parseConfig, readConfig } from '../../../lets/src/delegate/config.ts';
import { UsageError } from '../../../lets/src/resolvers/kit/errors.ts';
import { fakeIo } from './fixtures/fake-io.ts';

const HOME_CONFIG = '/home/u/.config/lets/config.yaml';

// The deps readConfig takes, with a config file holding text, when given.
function depsWith(text?: string, env: Record<string, string> = {}) {
  const path = env.XDG_CONFIG_HOME ? `${env.XDG_CONFIG_HOME}/lets/config.yaml` : HOME_CONFIG;
  const files: Record<string, string> = text === undefined ? {} : { [path]: text };
  return { env, io: fakeIo({ files, homedir: () => '/home/u' }) };
}

test('the config file is under ~/.config when XDG_CONFIG_HOME is unset', () => {
  assert.equal(configPath(depsWith()), HOME_CONFIG);
});

test('the config file is under XDG_CONFIG_HOME when it is set', () => {
  assert.equal(configPath(depsWith(undefined, { XDG_CONFIG_HOME: '/tmp/cfg' })), '/tmp/cfg/lets/config.yaml');
});

test('no config file reads as null', () => {
  assert.equal(readConfig(depsWith()), null);
});

test('a valid config reads as its chain of names, in order', () => {
  const text = 'version: 3\ndelegate:\n  resolvers:\n    - t3\n    - cli\n    - subagent\n';
  assert.deepEqual(readConfig(depsWith(text)), { version: 3, delegate: { resolvers: ['t3', 'cli', 'subagent'] } });
});

test('a config with no delegate key, or a null one, has no chain', () => {
  for (const text of ['version: 3\n', 'version: 3\ndelegate:\n', 'version: 3\ndelegate: null\n']) {
    assert.deepEqual(readConfig(depsWith(text)), { version: 3, delegate: {} }, text);
  }
});

test('a delegate key with no resolvers, or null ones, has no chain', () => {
  for (const text of ['version: 3\ndelegate: {}\n', 'version: 3\ndelegate:\n  resolvers:\n']) {
    assert.deepEqual(readConfig(depsWith(text)), { version: 3, delegate: {} }, text);
  }
});

test('an entry that is not t3, cli or subagent names the file, the entry and the three names', () => {
  for (const entry of ['/opt/r/old-resolver', 'codex', 'T3', '7']) {
    assert.throws(() => readConfig(depsWith(`version: 3\ndelegate:\n  resolvers:\n    - t3\n    - ${entry}\n`)),
      (error) => error instanceof UsageError && error.message.includes(HOME_CONFIG) && error.message.includes('delegate.resolvers[1]')
        && error.message.includes(entry) && /t3, cli or subagent/.test(error.message), entry);
  }
});

test('an empty chain is a valid config', () => {
  assert.deepEqual(readConfig(depsWith('version: 3\ndelegate: { resolvers: [] }\n')), { version: 3, delegate: { resolvers: [] } });
});

test('a key this lets does not know is ignored, at the top level and under delegate', () => {
  const text = 'version: 3\nsync: true\ndelegate:\n  resolvers: [subagent]\n  telemetry: true\n';
  assert.deepEqual(readConfig(depsWith(text)), { version: 3, delegate: { resolvers: ['subagent'] } });
});

test('review and handoff under delegate are kept as written, unchecked', () => {
  const text = 'version: 3\ndelegate:\n  resolvers: [subagent]\n  review:\n    code:\n      guidance: 42\n  handoff: apply\n';
  assert.deepEqual(readConfig(depsWith(text)), { version: 3, delegate: { resolvers: ['subagent'], review: { code: { guidance: 42 } }, handoff: 'apply' } });
});

const CONFIG = '/c/config.yaml';
const withDelegate = (yaml: string) => parseConfig(`version: 3\n${yaml}`, CONFIG);

test('guidanceFor gives the guidance for the strategy and the intent', () => {
  const config = withDelegate('delegate:\n  review:\n    code:\n      guidance: Use the strongest gpt model.\n');
  assert.equal(guidanceFor(config, 'review', 'code', CONFIG), 'Use the strongest gpt model.');
});

test('guidanceFor keeps a multi-line block whole', () => {
  const config = withDelegate('delegate:\n  handoff:\n    apply:\n      guidance: |\n        First line.\n        Second line.\n');
  assert.equal(guidanceFor(config, 'handoff', 'apply', CONFIG), 'First line.\nSecond line.\n');
});

test('guidanceFor gives null when any level is missing', () => {
  assert.equal(guidanceFor(null, 'review', 'code', CONFIG), null);
  for (const yaml of ['', 'delegate:\n', 'delegate:\n  review:\n', 'delegate:\n  handoff:\n    apply:\n      guidance: x\n',
    'delegate:\n  review:\n    plan:\n      guidance: x\n', 'delegate:\n  review:\n    code:\n      other: x\n', 'delegate:\n  review:\n    code: {}\n']) {
    assert.equal(guidanceFor(withDelegate(yaml), 'review', 'code', CONFIG), null, yaml);
  }
});

test('guidanceFor rejects a bad level, naming the file and the dotted key', () => {
  const cases: [string, string][] = [
    ['delegate:\n  review: [a]\n', 'delegate.review must be a mapping'],
    ['delegate:\n  review:\n    code: text\n', 'delegate.review.code must be a mapping'],
    ['delegate:\n  review:\n    code:\n      guidance: 42\n', 'delegate.review.code.guidance must be a string'],
  ];
  for (const [yaml, key] of cases) {
    assert.throws(() => guidanceFor(withDelegate(yaml), 'review', 'code', CONFIG),
      (error) => error instanceof UsageError && error.message.includes(CONFIG) && error.message.includes(key), yaml);
  }
});

test('guidanceFor ignores a bad entry for another intent or the other strategy', () => {
  assert.equal(guidanceFor(withDelegate('delegate:\n  review:\n    plan:\n      guidance: [a, b]\n'), 'review', 'code', CONFIG), null);
  assert.equal(guidanceFor(withDelegate('delegate:\n  handoff: 42\n'), 'review', 'code', CONFIG), null);
});

test('an invalid config is a usage error that names the file and the bad value', () => {
  const cases: [string, string][] = [
    ['version: 3\ndelegate: { resolvers: [unclosed\n', 'not YAML'],
    ['- just\n- a list\n', 'mapping'],
    ['version: 2\nresolvers: []\n', 'version must be 3, got 2'],
    ['version: 2\ndelegate: [t3]\n', 'version must be 3, got 2'],
    ['version: "3"\n', '"3"'],
    ['delegate: { resolvers: [] }\n', 'version must be 3'],
    ['version: 3\ndelegate: [t3]\n', 'delegate must be a mapping'],
    ['version: 3\ndelegate: t3\n', 'delegate must be a mapping'],
    ['version: 3\ndelegate: { resolvers: t3 }\n', 'delegate.resolvers must be a list'],
    ['version: 3\ndelegate:\n  resolvers:\n    - bin/old-resolver\n', 'bin/old-resolver'],
    ['version: 3\ndelegate:\n  resolvers:\n    - ~/bin/old-resolver\n', '~/bin/old-resolver'],
    ['version: 3\ndelegate:\n  resolvers:\n    - 7\n', '7'],
  ];
  for (const [text, named] of cases) {
    assert.throws(() => readConfig(depsWith(text)),
      (error) => error instanceof UsageError && error.message.includes(HOME_CONFIG) && error.message.includes(named), text);
  }
});

test('a config.json with no config.yaml is not read', () => {
  const deps = { env: {}, io: fakeIo({ files: { '/home/u/.config/lets/config.json': '{"version":1}' } }) };
  assert.equal(readConfig(deps), null);
});

test('a config that is not YAML says where the parser stopped, in one sentence', () => {
  assert.throws(() => readConfig(depsWith('version: 3\ndelegate: { resolvers: [/x\n')),
    (error) => error instanceof UsageError && /line 3, column 1\.$/.test(error.message));
});
