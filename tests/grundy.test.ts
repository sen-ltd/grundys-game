import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { naiveValues, values, Sweep, isCommon, moves, apply, nimSum, winningMove } from '../src/grundy.ts';

const bfile = (name: string): [number, number][] =>
  readFileSync(new URL(`./data/${name}`, import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => l.trim().split(/\s+/).map(Number) as [number, number]);

const flam = JSON.parse(readFileSync(new URL('../tools/data/flammenkamp.json', import.meta.url), 'utf8')) as {
  sparse: [number, number][];
  records: [number, number][];
};

const N = 100_000;
const s = new Sweep(N);
s.run(N);
const g = s.g;

describe('values', () => {
  it('the sparse sweep equals the definition up to 20,000', () => {
    const want = naiveValues(20_000);
    expect(Array.from(g.subarray(0, 20_001))).toEqual(Array.from(want));
  });

  it('matches OEIS A002188 (b-file, n = 0..20,000)', () => {
    const want = bfile('b002188.txt');
    expect(want.length).toBe(20_001);
    for (const [n, v] of want) expect(g[n]).toBe(v);
  });

  it('runs in pieces exactly as in one go', () => {
    const t = new Sweep(30_000);
    for (const to of [1, 2, 17, 999, 5000, 29_999, 30_000]) t.run(to);
    expect(Array.from(t.g)).toEqual(Array.from(values(30_000)));
  });
});

describe('the literature, up to 100,000', () => {
  it('P-positions are OEIS A036685 (42 heaps, the last 1222)', () => {
    const zeros: number[] = [];
    for (let n = 0; n <= N; n++) if (g[n] === 0) zeros.push(n);
    expect(zeros).toEqual(bfile('b036685.txt').map(([, v]) => v));
  });

  it('record values are OEIS A180120 / A180121', () => {
    const at = bfile('b180120.txt').map(([, v]) => v);
    const val = bfile('b180121.txt').map(([, v]) => v);
    const want = at.map((n, i) => [n, val[i]]).filter(([n]) => n <= N);
    expect(want.length).toBe(65);
    expect(s.stats.records).toEqual(want);
  });

  it("sparse heaps are the start of Flammenkamp's list of 1287", () => {
    const want = flam.sparse.filter(([n]) => n <= N);
    expect(want.length).toBe(1274);
    expect(s.stats.sparse).toEqual(want);
  });

  it('frequencies and last occurrences add up', () => {
    expect(s.stats.freq.reduce((a, b) => a + b, 0)).toBe(N + 1);
    s.stats.last.forEach((n, v) => s.stats.freq[v] && expect(g[n]).toBe(v));
  });
});

describe('sparse space', () => {
  it('splits the values into two classes closed the right way under xor', () => {
    for (let a = 0; a < 512; a++)
      for (let b = 0; b < 512; b++) expect(isCommon(a ^ b)).toBe(isCommon(a) !== isCommon(b));
  });
});

describe('play', () => {
  // win/lose of every position by plain search, heaps of 1 and 2 dropped
  const memo = new Map<string, boolean>();
  function wins(heaps: number[]): boolean {
    const h = heaps.filter((x) => x > 2).sort((a, b) => a - b);
    const key = h.join(',');
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    const r = moves(h).some((m) => !wins(apply(h, m)));
    memo.set(key, r);
    return r;
  }
  function* partitions(n: number, max = n): Generator<number[]> {
    if (n === 0) yield [];
    for (let k = Math.min(n, max); k >= 1; k--) for (const p of partitions(n - k, k)) yield [k, ...p];
  }

  it('xor of the values decides every position of up to 24 tokens (plain search)', () => {
    let count = 0;
    for (let t = 0; t <= 24; t++)
      for (const p of partitions(t)) {
        expect(wins(p)).toBe(nimSum(p, g) !== 0);
        count++;
      }
    expect(count).toBe(7_338); // partitions of 0..24
  });

  it('a winning move always leaves xor 0', () => {
    for (const p of [[7], [100], [5, 9, 12], [30, 41, 77, 8], [1222], [1223]]) {
      const m = winningMove(p, g);
      if (nimSum(p, g) === 0) expect(m).toBeNull();
      else expect(nimSum(apply(p, m!), g)).toBe(0);
    }
  });

  it('splits into two different non-empty heaps only', () => {
    expect(moves([1, 2])).toEqual([]);
    expect(moves([6]).map((m) => [m.a, m.b])).toEqual([[1, 5], [2, 4]]);
    expect(apply([4, 6, 9], { heap: 1, a: 2, b: 4 })).toEqual([4, 2, 4, 9]);
  });
});
