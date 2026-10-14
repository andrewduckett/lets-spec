// The tripwire after a read-only review: did anything change outside
// .workspace/, where scratch files belong?

export async function isTreeClean(cwd, { execFile }) {
  const { stdout } = await execFile('git', ['status', '--porcelain', '--untracked-files=all'], { cwd });
  // Each line is two status letters, a space, then the path.
  return stdout.split('\n').filter((line) => line !== '').every((line) => line.slice(3).startsWith('.workspace/'));
}
