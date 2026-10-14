export function fakeAdapter(name, { detects = false, available = { gpt: [], claude: [], gemini: [] }, result = 'FINDINGS', waitError = null, spawnError = null } = {}) {
  const calls = [];
  return { name, calls,
    detect: () => detects,
    availableFamilies: (q) => { calls.push(['availableFamilies', q]); return available; },
    async spawn(req) { calls.push(['spawn', req]); if (spawnError) throw spawnError; return { id: 'thread-1', kind: 'fake' }; },
    async waitForResult(h, o) { calls.push(['wait', h, o]); if (waitError) throw waitError; return { text: result }; },
    async finish(h, ok) { calls.push(['finish', h, ok]); } };
}
