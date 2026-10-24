import assert from 'node:assert/strict';
import { test } from 'node:test';
import { configDir } from '../../lets/src/config-dir.ts';

const home = '/home/u';

test('the config folder is under XDG_CONFIG_HOME when it is set', () => {
  assert.equal(configDir({ XDG_CONFIG_HOME: '/cfg' }, home), '/cfg/lets');
});

test('the config folder is under ~/.config when XDG_CONFIG_HOME is unset or empty', () => {
  assert.equal(configDir({}, home), '/home/u/.config/lets');
  assert.equal(configDir({ XDG_CONFIG_HOME: '' }, home), '/home/u/.config/lets');
});
