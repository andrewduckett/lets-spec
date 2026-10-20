import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// The files the contrib resolver copies from lets, so it installs on its own.
const COPIES = ['protocol', 'errors'];
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('each copied file is the original under a three-line header', () => {
  for (const name of COPIES) {
    const copy = read(`contrib/lets-delegate-resolver/src/${name}.ts`);
    const header = copy.split('\n').slice(0, 4);
    assert.match(header[0], new RegExp(`^// Copied from lets/src/delegate/${name}\\.ts`), name);
    assert.equal(header[3], '', name);
    assert.equal(copy.split('\n').slice(4).join('\n'), read(`lets/src/delegate/${name}.ts`), `${name}.ts has drifted from lets/src/delegate/${name}.ts`);
  }
});
