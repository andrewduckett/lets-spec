// Runs gh through an execFile, and turns a failure into a GhError.

// A gh call that failed. stderr holds what gh printed.
export class GhError extends Error {
  constructor(args, stderr) {
    super(`gh ${args.join(' ')} failed.`);
    this.stderr = stderr;
  }
}

export function makeGh(execFile) {
  return {
    // gh's stdout. Any failure throws a GhError.
    async run(args) {
      const { stdout, stderr, code } = await execFile('gh', args);
      if (code !== 0) throw new GhError(args, stderr);
      return stdout;
    },

    // gh's stdout, or null when gh answers 404. Any other failure throws, so
    // a network error is never read as "not found".
    async unlessMissing(args) {
      const { stdout, stderr, code } = await execFile('gh', args);
      if (code === 0) return stdout;
      if (code !== null && stderr.includes('HTTP 404')) return null;
      throw new GhError(args, stderr);
    },
  };
}
