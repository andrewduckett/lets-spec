// Read the schema name from openspec/config.yaml.
// Node has no YAML parser, so this reads only the top-level `schema:` line.

// The value of the first top-level `schema:` line, or null when absent or empty.
// Removes surrounding whitespace, a trailing `# comment`, and one pair of
// matching quotes.
export function schemaOf(text) {
  for (const line of text.split(/\r?\n/)) {
    const match = /^schema:(.*)$/.exec(line);
    if (!match) continue;
    const value = unquote(match[1].trim());
    return value === '' ? null : value;
  }
  return null;
}

function unquote(raw) {
  const quote = raw[0];
  if (quote === '"' || quote === "'") {
    const end = raw.indexOf(quote, 1);
    if (end !== -1) return raw.slice(1, end).trim();
  }
  return raw.replace(/(^|\s)#.*$/, '').trim();
}

// The warnings about the project's config. Returns lines; prints nothing.
export function checkConfig({ io, configPath, schemaName }) {
  const text = io.readFile(configPath);
  if (text === null) return [`${configPath} is missing, and could not be created.`];
  const schema = schemaOf(text);
  if (schema === null) return [`${configPath} sets no schema; it must be ${schemaName}.`];
  if (schema !== schemaName) {
    return [`${configPath} sets schema to '${schema}'; it must be ${schemaName}.`];
  }
  return [];
}
