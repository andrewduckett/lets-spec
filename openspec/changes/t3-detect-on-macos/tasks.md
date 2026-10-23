## 1. Find parent processes without /proc

- [x] 1.1 [easy] The resolver kit's exported `parentPid(pid, sys)` returns the `PPid` from `/proc/<pid>/status` when that file can be read, and runs no `ps` (verify: node --test tests/resolver-kit/io.test.ts) (✓ node --test tests/resolver-kit/io.test.ts passed)
- [x] 1.2 [easy] When `/proc/self` does not exist, `parentPid` runs `ps -o ppid= -p <pid>` and returns the number it prints, trimmed (verify: node --test tests/resolver-kit/io.test.ts) (✓ node --test tests/resolver-kit/io.test.ts passed)
- [x] 1.3 [easy] When `/proc/self` exists but `/proc/<pid>/status` cannot be read, as for a process that has exited, `parentPid` returns `null` and runs no `ps` (verify: node --test tests/resolver-kit/io.test.ts) (✓ node --test tests/resolver-kit/io.test.ts passed)
- [x] 1.4 [easy] When `ps` prints nothing or something that is not a number, `parentPid` returns `null` (verify: node --test tests/resolver-kit/io.test.ts) (✓ node --test tests/resolver-kit/io.test.ts passed)
- [x] 1.5 [easy] `realIo().parentPid` uses the exported `parentPid` with the real `readFileSync`, `existsSync` and `spawnSync`, so `realIo().parentPid(process.pid)` equals `process.ppid` (verify: node --test tests/resolver-kit/io.test.ts) (✓ node --test tests/resolver-kit/io.test.ts passed)
- [x] 1.6 [medium] `lets-delegate-t3 probe` on a system with no `/proc`, where a fake `ps` shows the running T3 server as an ancestor and T3 has no model manifest, exits 0 and prints `{"resolver":"t3","options":[]}` (verify: node --test tests/t3-resolver/resolver.test.ts) (✓ node --test tests/t3-resolver/resolver.test.ts passed)
- [ ] 1.7 [easy] The t3 README's *Install it* section says "It runs on Linux and macOS." next to the Node version (verify: grep -q 'It runs on Linux and macOS.' contrib/t3-resolver/README.md)
- [ ] 1.8 [easy] Every project check passes with the change in place (verify: pnpm test && nix flake check)
