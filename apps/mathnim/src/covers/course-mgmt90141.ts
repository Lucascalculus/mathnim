// The decision-making course's cover: a dry garden (karesansui). Three stones set in raked gravel, each ringed by
// concentric rake lines; across the rest of the bed the rake has drawn parallel lines with a slight swell, broken
// where the rings begin, their left ends ragged where the raking stopped short of the title. Warm grey lines, grey
// stones, a little moss. On opening the stones are there first; then the rake is pulled across the bed, line by
// line from the top, and the rings are drawn round each stone. Slow, and quiet.
//
// Drawn for this course alone (docs/TASTE.md §5).
type XY = [number, number];
const LINE = '#B9B0A2', MOSS = '#8FA772';
const f1 = (v: number) => (Math.round(v * 10) / 10).toString();

let seed = 141;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** The stones: centre, radius, the rings round them. */
const STONES: { c: XY; r: number; rings: number }[] = [
  { c: [1060, 320], r: 62, rings: 6 },
  { c: [1370, 570], r: 46, rings: 6 },
  { c: [1120, 745], r: 30, rings: 5 },
];
const SPACE = 14;
const zone = (s: (typeof STONES)[number]) => s.r + SPACE * (s.rings + 0.6);

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
/** A round-ish outline of radius r round c, wobbling a little (a stone, or a ring the rake made). */
function wobbly(c: XY, r: number, k: number, n = 36): XY[] {
  const ph = rnd() * 6;
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2, rr = r * (1 + k * Math.sin(3 * a + ph) + k * 0.6 * Math.sin(5 * a + ph * 2));
    return [c[0] + rr * Math.cos(a), c[1] + rr * Math.sin(a) * 0.86] as XY;
  });
}

export function svg(): string {
  seed = 141;
  const o: string[] = [];
  // the raked lines: one every SPACE, swelling gently, broken where a stone's rings begin
  let row = 0;
  for (let y = 70; y <= 890; y += SPACE, row++) {
    const x0 = 800 + rnd() * 100 + Math.max(0, 300 - Math.abs(y - 460)) * 0.4;
    const runs: XY[][] = [];
    let cur: XY[] = [];
    for (let x = x0; x <= 1620; x += 10) {
      const yy = y + 2.6 * Math.sin(x / 70 + row * 0.5);
      const inside = STONES.some((s) => Math.hypot(x - s.c[0], (yy - s.c[1]) / 0.86) < zone(s));
      if (inside) {
        if (cur.length > 1) runs.push(cur);
        cur = [];
      } else cur.push([x, yy]);
    }
    if (cur.length > 1) runs.push(cur);
    for (const r of runs) o.push(`<path class="zr" pathLength="1" d="M${r.map(([x, yy]) => `${f1(x)} ${f1(yy)}`).join(' L')}" style="--d:${(0.6 + row * 0.035).toFixed(2)}s"/>`);
  }
  // the rings round each stone, and the stone itself (grey, lit from the upper left, a soft shadow below)
  STONES.forEach((s, i) => {
    for (let k = 1; k <= s.rings; k++) o.push(`<path class="zr zc" pathLength="1" d="${closed(wobbly(s.c, s.r + SPACE * k, 0.012, 48))}" style="--d:${(1.4 + i * 0.3 + k * 0.12).toFixed(2)}s"/>`);
    if (i === 0) o.push(`<path class="zs" d="${closed(wobbly([s.c[0] - 4, s.c[1] + s.r * 0.45], s.r * 1.08, 0.1, 14))}" fill="${MOSS}" fill-opacity=".35" style="--d:.2s"/>`);
    o.push(`<ellipse class="zs" cx="${s.c[0] + 8}" cy="${s.c[1] + s.r * 0.55}" rx="${s.r * 1.05}" ry="${s.r * 0.42}" fill="#2a2a28" fill-opacity=".12" style="--d:.1s"/>`);
    o.push(`<path class="zs" d="${closed(wobbly(s.c, s.r, 0.09, 16))}" fill="url(#zst)" style="--d:${(0.1 + i * 0.12).toFixed(2)}s"/>`);
  });
  const defs = `<defs><linearGradient id="zst" x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#8d8f8f"/><stop offset=".55" stop-color="#5d6062"/><stop offset="1" stop-color="#3b3d3f"/></linearGradient></defs>`;
  const css = `.zr{fill:none;stroke:${LINE};stroke-width:1.5;stroke-linecap:round;stroke-dasharray:1.02 1.02;stroke-dashoffset:1.02;animation:zr-in 2.6s cubic-bezier(.4,0,.3,1) var(--d) forwards}
.zc{animation-duration:1.8s}
@keyframes zr-in{to{stroke-dashoffset:0}}
.zs{opacity:0;animation:zs-in 1.2s ease-out var(--d) forwards}
@keyframes zs-in{to{opacity:1}}
@media (prefers-reduced-motion:reduce){.zr{animation:none;stroke-dashoffset:0}.zs{animation:none;opacity:1}}`;
  return `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMaxYMid slice">${defs}<style>${css}</style>${o.join('')}</svg>`;
}
