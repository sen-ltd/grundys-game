// Compare runs/compute.json with Flammenkamp's tables and the OEIS, print the
// comparison and write src/findings.json for the demo.
//
//   node tools/report.mts [runs/compute.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { values, isCommon } from '../src/grundy.ts';

type Stats = {
  N: number;
  n: number;
  stopped: string | null;
  seconds: number;
  sparse: [number, number][];
  records: [number, number][];
  freq: number[];
  last: number[];
  maxDepth: number;
  maxDepthAt: number;
  avgDepth: number;
  checkpoints: { n: number; seconds: number; sparse: number; avgDepth: number; maxDepth: number }[];
};
type Flam = {
  sparseCount: number;
  lastSparse: number;
  depth: number;
  avgDepth: number;
  sparse: [number, number][];
  records: [number, number][];
  freq2pow35: { value: number; sparse: boolean; count: number; last: number }[];
};

const run = JSON.parse(readFileSync(process.argv[2] ?? 'runs/compute.json', 'utf8')) as Stats;
const flam = JSON.parse(readFileSync('tools/data/flammenkamp.json', 'utf8')) as Flam;
const bfile = (name: string) =>
  readFileSync(`tests/data/${name}`, 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => l.trim().split(/\s+/).map(Number));
const N = run.n;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// 1. sparse heaps: the whole list
const sparseAgree = run.sparse.filter(([n, v], i) => flam.sparse[i] && flam.sparse[i][0] === n && flam.sparse[i][1] === v).length;
const sparse = {
  ours: run.sparse.length,
  theirs: flam.sparse.length,
  agree: sparseAgree,
  identical: same(run.sparse, flam.sparse),
  last: run.sparse.at(-1)!,
  late: run.sparse.filter(([n]) => n > 100_000),
  upTo100k: run.sparse.filter(([n]) => n <= 100_000).length,
};

// 2. records: Flammenkamp's list (from G(3) = 1) and OEIS A180120/A180121 (from G(0) = 0)
const flamRec = flam.records.filter(([n]) => n <= N);
const oeisAt = bfile('b180120.txt').map(([, v]) => v);
const oeisVal = bfile('b180121.txt').map(([, v]) => v);
const oeisRec = oeisAt.map((n, i) => [n, oeisVal[i]]).filter(([n]) => n <= N);
const records = {
  ours: run.records.length,
  flam: [run.records.slice(1).filter(([n], i) => flamRec[i] && flamRec[i][0] === n && flamRec[i][1] === run.records[i + 1][1]).length, flamRec.length],
  oeis: [run.records.filter(([n, v], i) => oeisRec[i] && oeisRec[i][0] === n && oeisRec[i][1] === v).length, oeisRec.length],
  last: run.records.at(-1)!,
  next: flam.records.find(([n]) => n > N) ?? null,
};

// 3. frequency table 0..2^35: the sparse-type values (all of them occur below 48.4 million)
const sparseRows = flam.freq2pow35.filter((r) => r.sparse);
const freqAgree = sparseRows.filter((r) => (run.freq[r.value] ?? 0) === r.count && (r.count === 0 || run.last[r.value] === r.last)).length;
const unmarked = run.freq.filter((c, v) => c > 0 && !isCommon(v) && !flam.freq2pow35[v]?.sparse).length;
const freq = { rows: sparseRows.length, agree: freqAgree, unmarked, total: sparseRows.reduce((a, r) => a + r.count, 0) };

// 4. P-positions
const zeros = bfile('b036685.txt').map(([, v]) => v);
const pPositions = { count: run.freq[0], oeis: zeros.length, last: run.last[0], match: run.freq[0] === zeros.length && run.last[0] === zeros.at(-1) };

// 5. OEIS A002188: the 200,001-term a-file
let aFile: { agree: number; terms: number } | null = null;
try {
  const txt = await (await fetch('https://oeis.org/A002188/a002188.txt')).text();
  const rows = txt.split('\n').filter((l) => /^\d+\s+\d+/.test(l)).map((l) => l.trim().split(/\s+/).map(Number));
  const g = values(rows.at(-1)![0]);
  aFile = { agree: rows.filter(([n, v]) => g[n] === v).length, terms: rows.length };
} catch (e) {
  console.error('a-file not fetched:', (e as Error).message);
}

// 6. the scan: how many splits to rule out every sparse value below the answer
// the longest scan ends at a = maxDepth; is that the first heap with some value?
const firstOf = run.records.find(([n]) => n === run.maxDepth) ?? null;
const depth = { avg: run.avgDepth, max: run.maxDepth, maxAt: run.maxDepthAt, firstOf, theirsAvg: flam.avgDepth, theirsMax: flam.depth };

const maxValue = run.freq.length - 1;
const findings = {
  N,
  seconds: Math.round(run.seconds),
  stopped: run.stopped,
  sparse,
  records,
  freq,
  pPositions,
  aFile,
  depth,
  maxValue,
  checkpoints: run.checkpoints.map((c) => [c.n, Math.round(c.seconds), c.sparse, Math.round(c.avgDepth), c.maxDepth]),
};
writeFileSync('src/findings.json', JSON.stringify(findings, null, 1) + '\n');

console.log(`G(0..${N.toLocaleString('en')}) in ${Math.round(run.seconds)} s (${run.stopped})`);
console.log(`sparse heaps: ${sparse.ours} here, ${sparse.theirs} in Flammenkamp's list, ${sparse.agree} agree position and value, identical=${sparse.identical}; last ${sparse.last}`);
console.log(`  ${sparse.upTo100k} up to 100,000; after: ${sparse.late.map(([n, v]) => `${n}:${v}`).join(' ')}`);
console.log(`records: ${records.ours} (to G(${records.last[0]}) = ${records.last[1]}); Flammenkamp ${records.flam[0]}/${records.flam[1]}, OEIS A180120/1 ${records.oeis[0]}/${records.oeis[1]}; next listed ${JSON.stringify(records.next)}`);
console.log(`frequency table 0..2^35, sparse-type rows: ${freq.agree}/${freq.rows} agree on count and last heap (${freq.total} heaps); sparse values here not marked there: ${freq.unmarked}`);
console.log(`P-positions: ${pPositions.count} (last ${pPositions.last}); OEIS A036685 has ${pPositions.oeis}; match=${pPositions.match}`);
console.log(`OEIS A002188 a-file: ${aFile ? `${aFile.agree}/${aFile.terms}` : 'not checked'}`);
console.log(`scan depth: average ${depth.avg.toFixed(2)} (Flammenkamp ${depth.theirsAvg} to 2^38), max ${depth.max} at ${depth.maxAt} (Flammenkamp ${depth.theirsMax}); a = ${depth.max} is ${firstOf ? `the first heap with G = ${firstOf[1]}` : 'not a record heap'}`);
console.log(`largest value ${maxValue}`);
