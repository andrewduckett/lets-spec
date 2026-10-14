import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkConfig, schemaOf } from '../../lets-sync/lib/config.mjs';
import { fakeIo } from './fixtures/fake-io.mjs';

test('reads a bare value', () => {
  assert.equal(schemaOf('schema: lets-standard\n'), 'lets-standard');
});

test('reads a quoted value', () => {
  assert.equal(schemaOf('schema: "lets-standard"\n'), 'lets-standard');
  assert.equal(schemaOf("schema: 'lets-standard'\n"), 'lets-standard');
});

test('ignores a trailing comment', () => {
  assert.equal(schemaOf('schema: lets-minimal # note\n'), 'lets-minimal');
  assert.equal(schemaOf('schema: "lets-minimal" # note\n'), 'lets-minimal');
});

test('ignores an indented schema key', () => {
  assert.equal(schemaOf('x:\n  schema: nested\n'), null);
});

test('an empty value is null', () => {
  assert.equal(schemaOf('schema:\n'), null);
  assert.equal(schemaOf('schema: # nothing\n'), null);
  assert.equal(schemaOf('other: 1\n'), null);
});

test('uses the first top-level schema line and tolerates CRLF', () => {
  assert.equal(schemaOf('a: 1\r\nschema: lets-standard\r\nschema: other\r\n'), 'lets-standard');
});

const CONFIG = '/p/openspec/config.yaml';

test('checkConfig warns when the config is missing', () => {
  const io = fakeIo();
  assert.deepEqual(checkConfig({ io, configPath: CONFIG, schemaName: 'lets-standard' }), [
    `${CONFIG} is missing, and could not be created.`,
  ]);
});

test('checkConfig warns when no schema is set', () => {
  const io = fakeIo({ files: { [CONFIG]: 'schema:\n' } });
  assert.deepEqual(checkConfig({ io, configPath: CONFIG, schemaName: 'lets-standard' }), [
    `${CONFIG} sets no schema; it must be lets-standard.`,
  ]);
});

test('checkConfig warns on a wrong schema', () => {
  const io = fakeIo({ files: { [CONFIG]: 'schema: lets-minimal\n' } });
  assert.deepEqual(checkConfig({ io, configPath: CONFIG, schemaName: 'lets-standard' }), [
    `${CONFIG} sets schema to 'lets-minimal'; it must be lets-standard.`,
  ]);
});

test('checkConfig is quiet for the right schema, quoted or commented', () => {
  const io = fakeIo({ files: { [CONFIG]: 'schema: "lets-standard" # ok\n' } });
  assert.deepEqual(checkConfig({ io, configPath: CONFIG, schemaName: 'lets-standard' }), []);
});
