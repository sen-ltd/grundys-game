// Sweep G(0..N) of Grundy's game in sparse space and record what Flammenkamp's
// tables can be checked against: the sparse heaps, the record values, the
// frequency and last occurrence of every value, and the scan depth.
//
//   node tools/compute.mts N [out]
import { writeFileSync, renameSync } from 'node:fs';
import { Sweep } from '../src/grundy.ts';

const N = Number(process.argv[2] ?? 2 ** 20);
const out = process.argv[3] ?? `runs/compute-${N}.json`;
const STEP = 2 ** 21;
const s = new Sweep(N);
const started = Date.now();
const checkpoints: { n: number; seconds: number; sparse: number; avgDepth: number; maxDepth: number }[] = [];

function save(stopped: string | null) {
  const st = s.stats;
  const body = {
    N,
    stopped,
    seconds: (Date.now() - started) / 1000,
    node: process.version,
    ...st,
    avgDepth: st.depthSum / Math.max(1, st.commonHeaps),
    checkpoints,
  };
  writeFileSync(out + '.tmp', JSON.stringify(body));
  renameSync(out + '.tmp', out);
}

for (let n = 0; n < N; ) {
  n = Math.min(N, n + STEP);
  s.run(n);
  const st = s.stats;
  checkpoints.push({
    n,
    seconds: (Date.now() - started) / 1000,
    sparse: st.sparse.length,
    avgDepth: st.depthSum / Math.max(1, st.commonHeaps),
    maxDepth: st.maxDepth,
  });
  console.log(JSON.stringify(checkpoints.at(-1)));
  save(null);
}
save('done');
