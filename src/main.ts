import './style.css';
import { Sweep, isCommon, nimSum, winningMove, apply, type Move } from './grundy.ts';
import findings from './findings.json';

const LIMIT = 30_000; // values computed in the page
const sweep = new Sweep(LIMIT);
const t0 = performance.now();
sweep.run(LIMIT);
const sweepMs = performance.now() - t0;
const g = sweep.g;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const svg = $('board') as unknown as SVGSVGElement;
const statusEl = $('status');
const valueEl = $('value');
const hintsEl = $<HTMLInputElement>('hints');
const countSel = $<HTMLSelectElement>('countSel');
const sizeSel = $<HTMLSelectElement>('sizeSel');
const youSel = $<HTMLSelectElement>('youSel');

let heaps: number[] = [];
let history: { heaps: number[]; human: boolean }[] = [];
let selected = -1;
let humanToMove = true;
let over = false;

const live = (hs: number[]) => hs.some((n) => n > 2);

function newGame() {
  const k = Number(countSel.value);
  const max = Number(sizeSel.value);
  heaps = Array.from({ length: k }, () => 7 + Math.floor(Math.random() * (max - 6)));
  history = [];
  selected = -1;
  over = false;
  humanToMove = youSel.value === 'first';
  render();
  if (!humanToMove) setTimeout(computerMove, 500);
}

function play(m: Move) {
  history.push({ heaps: heaps.slice(), human: humanToMove });
  heaps = apply(heaps, m);
  selected = -1;
  if (!live(heaps)) over = true;
}

function computerMove() {
  if (over || humanToMove) return;
  // a move to XOR 0 if there is one; otherwise shave one token off the biggest heap, to drag the game out
  let m = winningMove(heaps, g);
  if (!m) {
    const heap = heaps.indexOf(Math.max(...heaps));
    m = { heap, a: 1, b: heaps[heap] - 1 };
  }
  play(m);
  humanToMove = true;
  render();
}

const NS = 'http://www.w3.org/2000/svg';
function el(name: string, attrs: Record<string, string | number>, text?: string): SVGElement {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text !== undefined) e.textContent = text;
  return e;
}

const S = 14; // token spacing
const R = 5.2; // token radius
const H = 40; // row height
const L = 150; // label column
function render() {
  svg.innerHTML = '';
  const rows = heaps.map((n, i) => ({ n, i })).filter((r) => r.n > 2);
  const dead1 = heaps.filter((n) => n === 1).length;
  const dead2 = heaps.filter((n) => n === 2).length;
  const width = L + Math.max(40, ...heaps) * S + 16;
  const height = Math.max(1, rows.length) * H + 30;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const total = nimSum(heaps, g);
  rows.forEach(({ n, i }, row) => {
    const y = row * H + 22;
    const gr = el('g', { class: 'heaprow' + (i === selected ? ' selected' : '') });
    gr.append(el('rect', { class: 'heapbox', x: 0, y: y - H / 2 + 2, width, height: H - 4, rx: 8 }));
    gr.append(el('text', { class: 'lbl', x: 8, y: y + 4 }, `${String(n).padStart(2, ' ')} tokens`));
    gr.append(el('text', { class: 'lbl gl', x: 96, y: y + 4 }, `G=${g[n]}`));
    for (let k = 0; k < n; k++) gr.append(el('circle', { class: 'tok', cx: L + k * S + S / 2, cy: y, r: R }));
    gr.addEventListener('click', () => {
      if (over || !humanToMove) return;
      selected = selected === i ? -1 : i;
      render();
    });
    svg.append(gr);
    if (i === selected && humanToMove && !over) {
      for (let k = 1; k < n; k++) {
        const a = Math.min(k, n - k);
        const b = n - a;
        const x = L + k * S;
        const eq = a === b;
        const after = total ^ g[n] ^ g[a] ^ g[b];
        const kind = eq ? 'eq' : hintsEl.checked ? (after === 0 ? 'win' : 'lose') : 'plain';
        const c = el('g', { class: `cut ${kind}` });
        c.append(el('rect', { x: x - S / 2, y: y - H / 2 + 2, width: S, height: H - 4 }));
        c.append(el('line', { x1: x, y1: y - 9, x2: x, y2: y + 9 }));
        if (kind === 'win' || kind === 'lose') c.append(el('text', { x, y: y - 11 }, after === 0 ? '✓' : '✗'));
        const tip = el('title', {}, eq ? `${a} + ${b}: equal halves are not allowed` : `${a} + ${b} → G = ${g[a]} ⊕ ${g[b]} = ${g[a] ^ g[b]}`);
        c.append(tip);
        if (!eq)
          c.addEventListener('click', (e) => {
            e.stopPropagation();
            play({ heap: i, a, b });
            humanToMove = false;
            render();
            if (!over) setTimeout(computerMove, 450);
          });
        svg.append(c);
      }
    }
  });
  const deadText = `dead heaps: ${dead1} × 1, ${dead2} × 2`;
  svg.append(el('text', { class: 'lbl', x: 8, y: Math.max(1, rows.length) * H + 18 }, rows.length ? deadText : `no heap can be split — ${deadText}`));
  renderValue(total);
}

function renderValue(total: number) {
  const liveHeaps = heaps.filter((n) => n > 2);
  const rows = liveHeaps.map((n) => `<div class="qrow"><span>heap of ${n}</span><b>G = ${g[n]}</b></div>`).join('');
  const terms = liveHeaps.map((n) => g[n]).join(' ⊕ ') || '0';
  valueEl.innerHTML = `${rows}<div class="big${liveHeaps.length > 6 ? ' long' : ''}">${terms} = ${total}</div>
    <p class="verdict">${total === 0 ? 'XOR 0: the player to move <strong>loses</strong> against best play.' : 'XOR ≠ 0: the player to move <strong>wins</strong> — some split makes it 0.'}</p>`;
  if (over) statusEl.innerHTML = humanToMove ? '<strong>The computer made the last split.</strong> New game?' : '<strong>You made the last split — you win.</strong>';
  else if (humanToMove) statusEl.innerHTML = selected < 0 ? 'Your move: pick a heap.' : 'Pick where to cut it (not in the middle).';
  else statusEl.textContent = 'Computer is thinking…';
}

$('newGame').addEventListener('click', newGame);
$('undo').addEventListener('click', () => {
  while (history.length) {
    const h = history.pop()!;
    if (!h.human) continue;
    heaps = h.heaps;
    humanToMove = true;
    over = false;
    selected = -1;
    render();
    return;
  }
});
countSel.addEventListener('change', newGame);
sizeSel.addEventListener('change', newGame);
youSel.addEventListener('change', newGame);
hintsEl.addEventListener('change', render);

// ---- the literature panel
const f = findings;
const fmt = (n: number) => n.toLocaleString('en');
$('paper').innerHTML = `<ul>
  <li><span class="ok">✓</span>Sparse heaps: ${f.sparse.agree}/${f.sparse.theirs}${f.sparse.identical ? ', the whole list' : ''}<span class="d">Flammenkamp's list of every heap with a sparse value, position and value; the last is G(${fmt(f.sparse.last[0])}) = ${f.sparse.last[1]}. Swept G(0…${fmt(f.N)}) in ${fmt(f.seconds)} s.</span></li>
  <li><span class="ok">✓</span>Record values: ${f.records.flam[0]}/${f.records.flam[1]}<span class="d">Flammenkamp's list of maxima up to G(${fmt(f.records.last[0])}) = ${f.records.last[1]}; OEIS A180120/A180121: ${f.records.oeis[0]}/${f.records.oeis[1]}</span></li>
  <li><span class="ok">✓</span>Frequency table 0…2³⁵: ${f.freq.agree}/${f.freq.rows} sparse rows<span class="d">count and last heap of every sparse value (${fmt(f.freq.total)} heaps in all)</span></li>
  <li><span class="ok">✓</span>P-positions: ${f.pPositions.count}, the last at ${f.pPositions.last}<span class="d">OEIS A036685 (${f.pPositions.oeis} terms); no other heap up to ${fmt(f.N)} has G = 0</span></li>
  ${f.aFile ? `<li><span class="ok">✓</span>OEIS A002188: ${fmt(f.aFile.agree)}/${fmt(f.aFile.terms)} terms</li>` : ''}
  <li><span class="info">≈</span>Splits scanned per heap: ${f.depth.avg.toFixed(0)} on average<span class="d">Flammenkamp: “on average 3130 common values were to check”; the longest scan here is ${fmt(f.depth.max)} splits, at n = ${fmt(f.depth.maxAt)}</span></li>
</ul>`;

// ---- the plot
const plot = $<HTMLCanvasElement>('plot');
const ctx = plot.getContext('2d')!;
const rangeSel = $<HTMLSelectElement>('rangeSel');
function drawPlot() {
  const end = Number(rangeSel.value);
  let max = 1;
  for (let n = 0; n <= end; n++) max = Math.max(max, g[n]);
  const W = plot.width, Hh = plot.height;
  ctx.clearRect(0, 0, W, Hh);
  const sx = (n: number) => 34 + (n / end) * (W - 44);
  const sy = (v: number) => 10 + (1 - v / max) * (Hh - 34);
  const dot = end <= 300 ? 3 : end <= 3000 ? 1.6 : 1.1;
  ctx.fillStyle = 'rgba(236,235,231,0.55)';
  for (let n = 0; n <= end; n++) if (isCommon(g[n])) ctx.fillRect(sx(n) - dot / 2, sy(g[n]) - dot / 2, dot, dot);
  let sparse = 0;
  ctx.fillStyle = '#d9b45a';
  for (let n = 0; n <= end; n++)
    if (!isCommon(g[n])) {
      sparse++;
      ctx.beginPath();
      ctx.arc(sx(n), sy(g[n]), Math.max(2, dot * 1.4), 0, 2 * Math.PI);
      ctx.fill();
    }
  ctx.fillStyle = '#9c9fa6';
  ctx.font = '11px ui-monospace, monospace';
  ctx.fillText(String(max), 2, sy(max) + 4);
  ctx.fillText('0', 2, sy(0));
  ctx.fillText('n = 0', sx(0), Hh - 6);
  ctx.fillText(fmt(end), W - 50, Hh - 6);
  $('plotInfo').innerHTML = `G(n) for n ≤ ${fmt(end)}, max <b>${max}</b>. Gold: the <b>${sparse}</b> heaps with a sparse value; white: common values. All ${fmt(LIMIT)} values computed in this page in ${sweepMs.toFixed(0)} ms.`;
}
rangeSel.addEventListener('change', drawPlot);

// ---- sparse heaps: computed here up to LIMIT, and the late ones from the long sweep
const late = f.sparse.late as [number, number][];
const rowsHtml = [...sweep.stats.sparse.map(([n, v]) => [n, v, 0]), ...late.map(([n, v]) => [n, v, 1])]
  .reverse()
  .map(([n, v, l]) => `<tr${l ? ' class="new"' : ''}><td>${fmt(n)}</td><td>${v}</td><td>${v.toString(2)}</td></tr>`)
  .join('');
$('sparseTable').innerHTML = `<p class="small dim">${fmt(sweep.stats.sparse.length)} sparse heaps up to ${fmt(LIMIT)} (computed in this page) and the <b>${late.length}</b> after 100,000 from the sweep to ${fmt(f.N)} (highlighted). Flammenkamp's list ends at ${fmt(f.sparse.last[0])}; the computation on that page, past 2³⁸, found no more.</p>
  <div class="scroll"><table><thead><tr><th>n</th><th>G(n)</th><th>binary</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;

newGame();
if (new URLSearchParams(location.search).has('demo')) {
  // a fixed position for the screenshot, with one heap picked
  heaps = [23, 31, 17];
  humanToMove = true;
  selected = 1;
  render();
}
drawPlot();
