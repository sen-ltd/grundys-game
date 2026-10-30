// Grundy's game: a move splits one heap into two non-empty heaps of different
// sizes. Heaps of 1 and 2 are dead, and the player who cannot move loses.
//
// A heap of n has the Sprague-Grundy value
//   G(n) = mex { G(a) xor G(n − a) : 1 ≤ a < n − a }
// and a position with several heaps is worth the xor of its heaps.

/** Upper bound for the values we expect (the largest known is 297). */
export const MAXV = 1024;

/** O(n²) reference: every split of every heap. */
export function naiveValues(N: number): Uint16Array {
  const g = new Uint16Array(N + 1);
  const seen = new Int32Array(MAXV).fill(-1);
  for (let n = 3; n <= N; n++) {
    for (let a = 1; 2 * a < n; a++) seen[g[a] ^ g[n - a]] = n;
    let v = 0;
    while (seen[v] === n) v++;
    g[n] = v;
  }
  return g;
}

/**
 * Values split into two classes by the parity of every bit but the lowest
 * (Flammenkamp's mask m = 0111…10): "common" when that parity is odd, "sparse"
 * when it is even. common xor common and sparse xor sparse are sparse-type,
 * common xor sparse is common-type.
 */
export function isCommon(v: number): boolean {
  let x = v >> 1;
  let p = 0;
  while (x) {
    p ^= 1;
    x &= x - 1;
  }
  return p === 1;
}

export type SweepStats = {
  /** largest n done */
  n: number;
  /** heaps whose value is sparse-type (n ≥ 1), in order */
  sparse: [number, number][];
  /** first heap reaching each new maximum value */
  records: [number, number][];
  /** count of every value over 0..n */
  freq: number[];
  /** last heap with each value */
  last: number[];
  /** for common-valued heaps: splits scanned to rule out every sparse value below G(n) */
  maxDepth: number;
  maxDepthAt: number;
  depthSum: number;
  commonHeaps: number;
};

/**
 * Exact sweep in "sparse space". For a heap n:
 *  1. Only splits with exactly one sparse-valued part give common-type values,
 *     so looping over the known sparse heaps r (as either part) finds every
 *     common-type option; c = the smallest common-type value missing.
 *  2. Every sparse-type value below c must still be checked. Scan the splits
 *     a = 1, 2, … and mark their values until all sparse-type values below c
 *     have appeared (G(n) = c), or the splits run out (G(n) = the smallest
 *     sparse-type value that never appeared: a new sparse heap).
 * Nothing is assumed about how long the scan in step 2 may be.
 */
export class Sweep {
  readonly g: Uint16Array;
  n = 0;
  private sp: number[] = [];
  private sv: number[] = [];
  private mark = new Int32Array(MAXV).fill(-1);
  private mark2 = new Int32Array(MAXV).fill(-1);
  private common = new Uint8Array(MAXV);
  private sparseVals: number[] = [];
  stats: SweepStats;

  readonly N: number;

  constructor(N: number) {
    this.N = N;
    this.g = new Uint16Array(N + 1);
    for (let v = 0; v < MAXV; v++) {
      this.common[v] = isCommon(v) ? 1 : 0;
      if (!this.common[v]) this.sparseVals.push(v);
    }
    this.stats = {
      n: 0,
      sparse: [[0, 0]],
      records: [[0, 0]],
      freq: [1],
      last: [0],
      maxDepth: 0,
      maxDepthAt: 0,
      depthSum: 0,
      commonHeaps: 0,
    };
  }

  /** Compute up to heap `to` (inclusive, capped at N). */
  run(to: number): void {
    const { g, sp, sv, mark, mark2, common, sparseVals, stats } = this;
    const end = Math.min(to, this.N);
    for (let n = this.n + 1; n <= end; n++) {
      // 1. common-type options via the sparse heaps
      for (let i = 0; i < sp.length; i++) {
        const r = sp[i];
        if (r >= n) break;
        const m = n - r;
        if (m !== r) mark[sv[i] ^ g[m]] = n;
      }
      let c = 2;
      while (!common[c] || mark[c] === n) c++;
      if (c >= MAXV - 2) throw new Error(`value overflow at ${n}`);
      // 2. sparse-type values below c
      const half = (n - 1) >> 1;
      let p = 0;
      let a = 1;
      while (sparseVals[p] < c && mark2[sparseVals[p]] === n) p++;
      while (sparseVals[p] < c && a <= half) {
        mark2[g[a] ^ g[n - a]] = n;
        a++;
        while (sparseVals[p] < c && mark2[sparseVals[p]] === n) p++;
      }
      const v = sparseVals[p] < c ? sparseVals[p] : c;
      g[n] = v;
      if (!common[v]) {
        sp.push(n);
        sv.push(v);
        stats.sparse.push([n, v]);
      } else {
        const depth = a - 1;
        stats.depthSum += depth;
        stats.commonHeaps++;
        if (depth > stats.maxDepth) {
          stats.maxDepth = depth;
          stats.maxDepthAt = n;
        }
      }
      while (stats.freq.length <= v) {
        stats.freq.push(0);
        stats.last.push(0);
      }
      if (v >= stats.freq.length - 1 && stats.freq[v] === 0) stats.records.push([n, v]);
      stats.freq[v]++;
      stats.last[v] = n;
    }
    this.n = Math.max(this.n, end);
    stats.n = this.n;
  }
}

/** Values up to N with the sparse sweep. */
export function values(N: number): Uint16Array {
  const s = new Sweep(N);
  s.run(N);
  return s.g;
}

// ---------------------------------------------------------------- play

/** xor of the heaps' values */
export function nimSum(heaps: number[], g: Uint16Array): number {
  let x = 0;
  for (const h of heaps) x ^= g[h];
  return x;
}

export type Move = { heap: number; a: number; b: number };

/** every legal move: heap index i split into a < b */
export function moves(heaps: number[]): Move[] {
  const out: Move[] = [];
  heaps.forEach((n, heap) => {
    for (let a = 1; 2 * a < n; a++) out.push({ heap, a, b: n - a });
  });
  return out;
}

export function apply(heaps: number[], m: Move): number[] {
  const next = heaps.slice();
  next.splice(m.heap, 1, m.a, m.b);
  return next;
}

/** a move to a position of value 0, if one exists */
export function winningMove(heaps: number[], g: Uint16Array): Move | null {
  const x = nimSum(heaps, g);
  if (x === 0) return null;
  for (const m of moves(heaps)) {
    if ((x ^ g[heaps[m.heap]] ^ g[m.a] ^ g[m.b]) === 0) return m;
  }
  throw new Error('no winning move from a non-zero position');
}
