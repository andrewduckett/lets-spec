// The prompt a caller wrote to a file. A prompt is long, and shell quoting
// is hostile, so it never travels as a flag's value.
import { resolve } from 'node:path';
import type { Deps } from '../io.ts';
import { UsageError } from '../resolvers/kit/errors.ts';

// The text of promptFile, taken from the working directory.
export function readPromptFile(promptFile: string, { cwd, io }: Pick<Deps, 'cwd' | 'io'>): string {
  const text = io.readFile(resolve(cwd, promptFile));
  if (text === null) throw new UsageError(`cannot read --prompt-file ${promptFile}`);
  if (text.trim() === '') throw new UsageError(`--prompt-file ${promptFile} is empty`);
  return text;
}
