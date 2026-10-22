import assert from 'node:assert/strict';
import { test } from 'node:test';
import { configPath, readConfig } from '../../../lets/src/delegate/config.ts';
import { UsageError } from '../../../lets/src/delegate/errors.ts';
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
  const text = 'version: 2\nresolvers: [subagent]\ndelegations:\n  review-plan:\n    guidance: Prefer gpt.\n';
  assert.deepEqual(readConfig(depsWith(text)), { version: 2, resolvers: ['subagent'] });
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
