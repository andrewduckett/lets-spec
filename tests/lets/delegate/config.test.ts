import assert from 'node:assert/strict';
import { test } from 'node:test';
import { configPath, guidanceFor, parseConfig, readConfig } from '../../../lets/src/delegate/config.ts';
import { UsageError } from '../../../contrib/resolver-kit/src/errors.ts';
import { fakeIo } from './fixtures/fake-io.ts';

const HOME_CONFIG = '/home/u/.config/lets-delegate/config.yaml';

// The deps readConfig takes, with a config file holding text, when given.
function depsWith(text?: string, env: Record<string, string> = {}) {
  const path = env.XDG_CONFIG_HOME ? `${env.XDG_CONFIG_HOME}/lets-delegate/config.yaml` : HOME_CONFIG;
  const files: Record<string, string> = text === undefined ? {} : { [path]: text };
  return { env, io: fakeIo({ files, homedir: () => '/home/u' }) };
}

test('the config file is under ~/.config when XDG_CONFIG_HOME is unset', () => {
  assert.equal(configPath(depsWith()), HOME_CONFIG);
});

test('the config file is under XDG_CONFIG_HOME when it is set', () => {
  assert.equal(configPath(depsWith(undefined, { XDG_CONFIG_HOME: '/tmp/cfg' })), '/tmp/cfg/lets-delegate/config.yaml');
});

test('no config file reads as null', () => {
  assert.equal(readConfig(depsWith()), null);
});

test('a valid config reads as its chain, in order', () => {
  const text = 'version: 2\nresolvers:\n  - /opt/r/lets-delegate-t3\n  - subagent\n';
  assert.deepEqual(readConfig(depsWith(text)), { version: 2, resolvers: ['/opt/r/lets-delegate-t3', 'subagent'] });
});

test('an empty chain is a valid config', () => {
  assert.deepEqual(readConfig(depsWith('version: 2\nresolvers: []\n')), { version: 2, resolvers: [] });
});

test('a key this lets does not know is ignored', () => {
  const text = 'version: 2\nresolvers: [subagent]\ntelemetry: true\n';
  assert.deepEqual(readConfig(depsWith(text)), { version: 2, resolvers: ['subagent'] });
});

test('delegations is kept as written, unchecked', () => {
  const text = 'version: 2\nresolvers: [subagent]\ndelegations:\n  code:\n    guidance: 42\n';
  assert.deepEqual(readConfig(depsWith(text)), { version: 2, resolvers: ['subagent'], delegations: { code: { guidance: 42 } } });
});

const CONFIG = '/c/config.yaml';
const withDelegations = (yaml: string) => parseConfig(`version: 2\nresolvers: []\n${yaml}`, CONFIG);

test('guidanceFor gives the guidance for the intent', () => {
  const config = withDelegations('delegations:\n  code:\n    guidance: Use the strongest gpt model.\n');
  assert.equal(guidanceFor(config, 'code', CONFIG), 'Use the strongest gpt model.');
});

test('guidanceFor keeps a multi-line block whole', () => {
  const config = withDelegations('delegations:\n  apply:\n    guidance: |\n      First line.\n      Second line.\n');
  assert.equal(guidanceFor(config, 'apply', CONFIG), 'First line.\nSecond line.\n');
});

test('guidanceFor gives null when any level is missing', () => {
  assert.equal(guidanceFor(null, 'code', CONFIG), null);
  for (const yaml of ['', 'delegations:\n  plan:\n    guidance: x\n', 'delegations:\n  code:\n    other: x\n', 'delegations:\n  code: {}\n']) {
    assert.equal(guidanceFor(withDelegations(yaml), 'code', CONFIG), null, yaml);
  }
});

test('guidanceFor rejects a bad level, naming the file and the key', () => {
  const cases: [string, string][] = [
    ['delegations: [a]\n', 'delegations'],
    ['delegations:\n  code: text\n', 'delegations.code'],
    ['delegations:\n  code:\n    guidance: 42\n', 'delegations.code.guidance'],
  ];
  for (const [yaml, key] of cases) {
    assert.throws(() => guidanceFor(withDelegations(yaml), 'code', CONFIG),
      (error) => error instanceof UsageError && error.message.includes(CONFIG) && error.message.includes(key), yaml);
  }
});

test('guidanceFor ignores a bad entry for another intent', () => {
  assert.equal(guidanceFor(withDelegations('delegations:\n  plan:\n    guidance: [a, b]\n'), 'code', CONFIG), null);
});

test('an invalid config is a usage error that names the file and the bad value', () => {
  const cases: [string, string][] = [
    ['version: 2\nresolvers: [unclosed\n', 'not YAML'],
    ['- just\n- a list\n', 'mapping'],
    ['version: 1\nresolvers: []\n', 'version must be 2'],
    ['version: "2"\nresolvers: []\n', '"2"'],
    ['resolvers: []\n', 'version must be 2'],
    ['version: 2\n', 'resolvers'],
    ['version: 2\nresolvers: subagent\n', 'subagent'],
    ['version: 2\nresolvers:\n  - bin/lets-delegate-t3\n', 'bin/lets-delegate-t3'],
    ['version: 2\nresolvers:\n  - ~/bin/lets-delegate-t3\n', '~/bin/lets-delegate-t3'],
    ['version: 2\nresolvers:\n  - 7\n', '7'],
  ];
  for (const [text, named] of cases) {
    assert.throws(() => readConfig(depsWith(text)),
      (error) => error instanceof UsageError && error.message.includes(HOME_CONFIG) && error.message.includes(named), text);
  }
});

const HOME_JSON = '/home/u/.config/lets-delegate/config.json';

test('a leftover config.json with no config.yaml is a usage error that names both files', () => {
  const deps = { env: {}, io: fakeIo({ files: { [HOME_JSON]: '{"version":1}' } }) };
  assert.throws(() => readConfig(deps), (error) => error instanceof UsageError
    && error.message.includes(HOME_JSON) && error.message.includes(HOME_CONFIG) && error.message.includes('now config.yaml'));
});

test('a config.json beside a config.yaml is ignored', () => {
  const deps = { env: {}, io: fakeIo({ files: { [HOME_JSON]: 'not json', [HOME_CONFIG]: 'version: 2\nresolvers: [subagent]\n' } }) };
  assert.deepEqual(readConfig(deps), { version: 2, resolvers: ['subagent'] });
});

test('a config that is not YAML says where the parser stopped, in one sentence', () => {
  assert.throws(() => readConfig(depsWith('version: 2\nresolvers: [/x\n')),
    (error) => error instanceof UsageError && /line 3, column 1\.$/.test(error.message));
});
