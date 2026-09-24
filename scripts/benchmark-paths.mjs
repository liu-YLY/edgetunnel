// 本地微基准，非 Cloudflare CPU 配额/生产吞吐证明。
// npm run build 不使用此脚本；比较本轮优化前固定提交，避免基线随 HEAD 漂移。
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { 随机路径 as current } from '../src/core/paths.js';
const source = execFileSync('git', ['show', 'f14447b:src/core/paths.js'], { encoding: 'utf8' });
const { 随机路径: baseline } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const original = Math.random;
function measure(fn) {
  let calls = 0, seed = 17;
  Math.random = () => { calls++; return ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); };
  const start = performance.now();
  for (let i = 0; i < 1000; i++) fn('/ws?ed=2560');
  return { ms: performance.now() - start, randomCalls: calls };
}
try {
  measure(baseline); measure(current);
  const results = { baseline: [], current: [] };
  for (let i = 0; i < 7; i++) {
    results.baseline.push(measure(baseline)); results.current.push(measure(current));
  }
  for (const [name, rounds] of Object.entries(results)) {
    console.log(JSON.stringify({ name, pathsPerRound: 1000, rounds: 7,
      medianMs: Number(rounds.map(r => r.ms).sort((a,b) => a-b)[3].toFixed(3)), randomCalls: rounds[0].randomCalls }));
  }
} finally { Math.random = original; }
