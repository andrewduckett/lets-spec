// The kit and the adapters import nothing from the command's own files and no
// package but Node's own. Nothing else keeps them apart now that they share
// one package with lets. The test reads text; it parses no TypeScript.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const FOLDER = fileURLToPath(new URL('../../../lets/src/resolvers', import.meta.url));

// An import or export at the start of a statement, with or without from, and
// an import() on a line that is not a comment.
const STATIC = /^\s*(?:import|export)\b(?:[^'";]*?\bfrom)?\s*['"]([^'"]+)['"]/gm;
const DYNAMIC = /^(?!\s*(?:\/\/|\/?\*))[^\n]*?\bimport\(\s*['"]([^'"]+)['"]\s*\)/gm;

// The specifiers in file that break the folder rule.
function violations(file: string, text: string): string[] {
  const specifiers = [...text.matchAll(STATIC), ...text.matchAll(DYNAMIC)].map((match) => match[1]);
  return specifiers.filter((specifier) => {
    if (specifier.startsWith('.')) {
      const inside = relative(FOLDER, resolve(dirname(file), specifier));
      return inside.startsWith('..');
    }
    return !specifier.startsWith('node:');
  });
}

test('no file under lets/src/resolvers imports from outside it', () => {
  const files = readdirSync(FOLDER, { recursive: true, encoding: 'utf8' }).filter((name) => name.endsWith('.ts'));
  assert.ok(files.length > 0);
  const found = files.flatMap((name) => {
    const file = join(FOLDER, name);
    return violations(file, readFileSync(file, 'utf8')).map((specifier) => `${name}: ${specifier}`);
  });
  assert.deepEqual(found, []);
});

test('a relative import that leaves the folder breaks the rule', () => {
  const file = join(FOLDER, 't3', 't3.ts');
  assert.deepEqual(violations(file, "import { EXIT } from '../../delegate/lookup.ts';"), ['../../delegate/lookup.ts']);
  assert.deepEqual(violations(file, "import { EXIT } from '../kit/errors.ts';"), []);
});

test('a package that is not Node\'s own breaks the rule', () => {
  const file = join(FOLDER, 'kit', 'io.ts');
  assert.deepEqual(violations(file, "import YAML from 'yaml';"), ['yaml']);
  assert.deepEqual(violations(file, "import { readFileSync } from 'node:fs';"), []);
});

test('export from, a multi-line import and import() are read', () => {
  const file = join(FOLDER, 'kit', 'main.ts');
  const text = [
    "export { Command } from 'commander';",
    'import {',
    '  a,',
    '  b,',
    "} from '../../io.ts';",
    "const yaml = await import('yaml');",
  ].join('\n');
  assert.deepEqual(violations(file, text), ['commander', '../../io.ts', 'yaml']);
});

test('a comment that names a package is not an import', () => {
  const file = join(FOLDER, 'kit', 'main.ts');
  const text = [
    "// import YAML from 'yaml';",
    "/* import('commander') */",
    " * export { x } from '../../io.ts';",
    "// The release runs it as import('yaml').",
  ].join('\n');
  assert.deepEqual(violations(file, text), []);
});
