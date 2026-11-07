// The marketing course's cover: paper cut-outs after Matisse. Fronds of seaweed with lobes to either side, coral
// blobs, uneven stars, cut by hand in ultramarine, coral, pink, leaf green and yellow (edges a little irregular, as
// scissors leave them), pinned loosely over the right of the page, some overlapping. On opening each piece drops in
// from above, turning, and settles, the way a cut shape falls onto a table.
//
// Drawn for this course alone (docs/TASTE.md §5).
const COLS = ['#2341B5', '#F26B3A', '#F2A0B4', '#2F9E6E', '#F5C431', '#2341B5', '#F26B3A'];
type XY = [number, number];
const f1 = (v: number) => (Math.round(v * 10) / 10).toString();

let seed = 37;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** A closed smooth outline through points (Catmull-Rom as cubic Béziers). */
function closed(p: XY[]): string {
  const n = p.length, at = (i: number) => p[(i + n) % n];
  let d = `M${f1(p[0][0])} ${f1(p[0][1])}`;
  for (let i = 0; i < n; i++) {
    const [a, b, c, e] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    d += ` C${f1(b[0] + (c[0] - a[0]) / 6)} ${f1(b[1] + (c[1] - a[1]) / 6)} ${f1(c[0] - (e[0] - b[0]) / 6)} ${f1(c[1] - (e[1] - b[1]) / 6)} ${f1(c[0])} ${f1(c[1])}`;
  }
  return d + 'Z';
}
const rough = (v: number, k = 0.06) => v * (1 + (rnd() - 0.5) * 2 * k);

/** A seaweed frond standing on the origin, L tall: a bending stem with deep finger lobes to either side by turns,
 *  their tips lifted (as Matisse cut them). */
function frond(L: number, lobes: number): string {
  const left: XY[] = [], right: XY[] = [];
  const lobe = (t: number, side: number) => {
    let w = 0;
    for (let i = 0; i < lobes; i++) {
      const ti = 0.12 + (0.82 * i) / lobes;
      if (i % 2 !== side) continue;
      w = Math.max(w, 78 * (1 - ti * 0.55) * Math.exp(-(((t - ti) * lobes * 2.6) ** 2)));
    }
    return w;
  };
  const N = 64;
  for (let i = 0; i <= N; i++) {
    const t = i / N, bend = 30 * Math.sin(t * 2.2), stem = 9 * (1 - t * 0.7);
    const r = lobe(t, 0), l = lobe(t, 1);
    right.push([bend + stem + rough(r, 0.04), -t * L - 0.45 * r]);
    left.push([bend - stem - rough(l, 0.04), -t * L - 0.45 * l]);
  }
  return closed([...right, ...left.reverse()]);
}
/** A coral blob: a radius with a few lobes, cut a little unevenly. */
function blob(R: number, k: number): string {
  const p: XY[] = [], ph = rnd() * 6;
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2, r = rough(R * (1 + 0.28 * Math.sin(k * a + ph) + 0.08 * Math.sin(2 * k * a)), 0.05);
    p.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return closed(p);
}
/** An uneven star of n points. */
function star(R: number, n: number): string {
  const p: XY[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? R * 0.42 * rough(1, 0.15) : R * rough(1, 0.18);
    p.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  let d = `M${f1(p[0][0])} ${f1(p[0][1])}`;
  for (let i = 1; i < p.length; i++) d += ` L${f1(p[i][0])} ${f1(p[i][1])}`;
  return d + 'Z';
}

export function svg(): string {
  seed = 37;
  // where each piece lies (x, y, turn), what it is and how big
  const pieces: [XY, number, string, string][] = [
    [[1120, 880], -6, frond(560, 7), COLS[0]],
    [[1395, 900], 14, frond(470, 6), COLS[3]],
    [[930, 360], 0, blob(92, 4), COLS[1]],
    [[1280, 190], 0, blob(70, 5), COLS[2]],
    [[1505, 420], 0, star(58, 5), COLS[4]],
    [[950, 830], -18, frond(300, 5), COLS[2]],
    [[1225, 470], 0, star(40, 6), COLS[1]],
    [[1560, 760], 0, blob(54, 3), COLS[4]],
    [[1010, 140], 0, star(30, 5), COLS[0]],
    [[1460, 120], -30, frond(230, 4), COLS[1]],
    [[880, 610], 0, blob(30, 4), COLS[3]],
  ];
  const o = pieces.map(([[x, y], turn, d, col], i) => {
    const fall = 260 + rnd() * 200, spin = (rnd() - 0.5) * 80;
    return `<g class="mc" style="--to:translate(${x}px,${y}px) rotate(${turn}deg);--from:translate(${f1(x + (rnd() - 0.5) * 120)}px,${f1(y - fall)}px) rotate(${f1(turn + spin)}deg);--d:${(0.15 + i * 0.16).toFixed(2)}s"><path d="${d}" fill="${col}"/></g>`;
  });
  const css = `.mc{transform:var(--to);mix-blend-mode:multiply;opacity:.93;animation:mc-in 1.25s cubic-bezier(.2,.9,.3,1.08) var(--d) both}
@keyframes mc-in{from{transform:var(--from);opacity:0}30%{opacity:.93}to{transform:var(--to);opacity:.93}}
@media (prefers-reduced-motion:reduce){.mc{animation:none}}`;
  return `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMaxYMax slice"><style>${css}</style>${o.join('')}</svg>`;
}
