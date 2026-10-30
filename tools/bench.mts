// Time the definition (every split, O(n²)) against the sparse sweep.
//
//   node tools/bench.mts [out]
import { writeFileSync } from 'node:fs';
import { naiveValues, values } from '../src/grundy.ts';

const out = process.argv[2] ?? 'runs/bench.json';
const rows: { N: number; naiveMs: number; sweepMs: number; same: boolean }[] = [];
const time = (f: () => Uint16Array): [number, Uint16Array] => {
  const t = performance.now();
  const r = f();
  return [performance.now() - t, r];
};
time(() => values(20_000)); // warm up
time(() => naiveValues(20_000));
for (const N of [25_000, 50_000, 100_000, 200_000, 400_000]) {
  const [naiveMs, a] = time(() => naiveValues(N));
  const [sweepMs, b] = time(() => values(N));
  const same = a.every((v, i) => v === b[i]);
  rows.push({ N, naiveMs: Math.round(naiveMs), sweepMs: Math.round(sweepMs), same });
  console.log(JSON.stringify(rows.at(-1)));
}
writeFileSync(out, JSON.stringify({ node: process.version, rows }, null, 1) + '\n');
