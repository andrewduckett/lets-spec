import assert from 'node:assert/strict';
import { test } from 'node:test';
import { configPath, readConfig } from '../../../lets/src/delegate/config.ts';
import { UsageError } from '../../../lets/src/delegate/errors.ts';
import { fakeIo } from './fixtures/fake-io.ts';

const HOME_CONFIG = '/home/u/.config/lets-delegate/config.json';
const valid = { version: 1, resolver: null, reviewers: [{ family: 'gpt', model: 'gpt-6-luna', efforts: ['high'] }] };

// The deps readConfig takes, with a config file holding text, when given.
function depsWith(text?: string, env: Record<string, string> = {}) {
  const path = env.XDG_CONFIG_HOME ? `${env.XDG_CONFIG_HOME}/lets-delegate/config.json` : HOME_CONFIG;
  const files: Record<string, string> = text === undefined ? {} : { [path]: text };
  return { env, io: fakeIo({ files, homedir: () => '/home/u' }) };
}

test('the config file is under ~/.config when XDG_CONFIG_HOME is unset', () => {
  assert.equal(configPath(depsWith()), HOME_CONFIG);
});

test('the config file is under XDG_CONFIG_HOME when it is set', () => {
  assert.equal(configPath(depsWith(undefined, { XDG_CONFIG_HOME: '/tmp/cfg' })), '/tmp/cfg/lets-delegate/config.json');
});

test('no config file reads as null', () => {
  assert.equal(readConfig(depsWith()), null);
});

test('a valid config reads as the config it holds', () => {
  assert.deepEqual(readConfig(depsWith(JSON.stringify(valid))), valid);
  const named = { version: 1, resolver: '/opt/r/resolver', reviewers: [{ family: 'claude', model: null }] };
  assert.deepEqual(readConfig(depsWith(JSON.stringify(named))), named);
});

test('an invalid config is a usage error that names the file and the bad value', () => {
  const cases: [unknown, string][] = [
    ['not json', 'not JSON'],
    [{ ...valid, version: 2 }, '2'],
    [{ ...valid, resolver: 'relative/path' }, 'relative/path'],
    [{ ...valid, reviewers: 'gpt' }, 'reviewers'],
    [{ ...valid, reviewers: [{ family: 'mistral', model: null }] }, 'mistral'],
    [{ ...valid, reviewers: [{ family: 'gpt', model: 7 }] }, '7'],
    [{ ...valid, reviewers: [{ family: 'gpt', model: null, efforts: ['max'] }] }, 'max'],
    [{ ...valid, reviewers: [{ family: 'gpt', model: null, efforts: 'high' }] }, 'high'],
  ];
  for (const [content, named] of cases) {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    assert.throws(() => readConfig(depsWith(text)),
      (error) => error instanceof UsageError && error.message.includes(HOME_CONFIG) && error.message.includes(named), text);
  }
});
