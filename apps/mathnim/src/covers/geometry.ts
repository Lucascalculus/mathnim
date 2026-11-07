// The geometry course's cover: a Bauhaus poster, flat shapes in printers' colours on the page's paper. A big yellow
// disc cut into twelve slices, five of them caught halfway out, laid head to tail in a strip below it (the old way
// of finding a circle's area, frozen in the middle of being done); a red triangle leaning in from above; a black
// diameter with a dot at its end; a blue quarter disc in the corner; thin rules and a row of shrinking dots.
// Overlaps multiply, as inks do. On opening the shapes slide, turn and spring into place, each in its own time.
//
// Drawn for this course alone (docs/TASTE.md §5).
const YELLOW = '#F2B705', RED = '#D9381E', BLUE = '#1D4E9E', INK = '#1a1b1f';
const f1 = (v: number) => (Math.round(v * 10) / 10).toString();

/** A slice of the disc with its apex at the origin, pointing along +x, `a` radians wide. */
const wedge = (r: number, a: number) => `M0 0 L${f1(r * Math.cos(-a / 2))} ${f1(r * Math.sin(-a / 2))} A${r} ${r} 0 0 1 ${f1(r * Math.cos(a / 2))} ${f1(r * Math.sin(a / 2))} Z`;

export function svg(): string {
  const out: string[] = [];
  const shape = (body: string, from: string, to: string, d: number, t = 1.1, cls = 'gm') =>
    out.push(`<g class="${cls}" style="--from:${from};--to:${to};--d:${d.toFixed(2)}s;--t:${t.toFixed(2)}s">${body}</g>`);

  // the blue quarter disc in the lower left corner, grown from the corner
  shape(`<path d="M0 0 H190 A190 190 0 0 1 0 190 Z" fill="${BLUE}"/>`, 'translate(0px,900px) scale(0,0)', 'translate(0px,900px) scale(1,-1)', 0.15, 1.2);
  // thin rules on the right edge
  for (let i = 0; i < 6; i++) out.push(`<line class="gr" x1="1452" x2="1600" y1="${640 + i * 14}" y2="${640 + i * 14}" stroke="${INK}" stroke-width="1.4" style="--d:${(0.9 + i * 0.07).toFixed(2)}s"/>`);

  // the disc: twelve slices; five of them are out in the strip below, the gap where they were left open
  const C: [number, number] = [1190, 380], R = 235, n = 12, a = (2 * Math.PI) / n;
  const out_of = [1, 3, 5, 6, 8];
  for (let k = 0; k < n; k++) {
    const ang = (k * 360) / n - 90;
    const fill = k % 2 ? YELLOW : '#F29F05';
    const body = `<path d="${wedge(R, a)}" fill="${fill}"/>`;
    const home = `translate(${C[0]}px,${C[1]}px) rotate(${ang}deg)`;
    const i = out_of.indexOf(k);
    if (i < 0) {
      shape(body, `translate(${C[0]}px,${C[1]}px) rotate(${ang - 40}deg) scale(.2)`, home, 0.1 + k * 0.04, 0.9);
      continue;
    }
    // in the strip: apex up and apex down by turns, nested side by side (a slice is 2R sin(a/2) wide at its arc)
    const base = 2 * R * Math.sin(a / 2), h = R * Math.cos(a / 2), x = 850 + i * base * 0.5, up = i % 2 === 0;
    const to = up ? `translate(${f1(x)}px,${f1(835 - h)}px) rotate(90deg)` : `translate(${f1(x)}px,835px) rotate(-90deg)`;
    shape(body, home, to, 0.9 + i * 0.14, 1.3);
  }
  // the disc's outline, drawn round, so the missing slices read as gone from a circle
  out.push(`<circle class="gl" cx="${C[0]}" cy="${C[1]}" r="${R + 10}" fill="none" stroke="${INK}" stroke-width="1" stroke-opacity=".5" pathLength="1" transform="rotate(-90 ${C[0]} ${C[1]})" style="--d:.6s"/>`);
  // the black diameter through the disc, with its dot
  out.push(`<line class="gl" x1="905" y1="660" x2="1460" y2="105" stroke="${INK}" stroke-width="1.6" pathLength="1" style="--d:1.5s"/>`);
  shape(`<circle r="9" fill="${INK}"/>`, 'translate(1460px,105px) scale(0)', 'translate(1460px,105px) scale(1)', 2.2, 0.6);
  // the red triangle, leaning in from above
  shape(`<path d="M0 0 L150 0 L40 230 Z" fill="${RED}"/>`, 'translate(700px,-260px) rotate(-30deg)', 'translate(690px,50px) rotate(8deg)', 0.5, 1.4);
  // a row of dots, shrinking towards the disc
  [20, 16, 12.5, 9.5, 7].forEach((r, i) => shape(`<circle r="${r}" fill="${i % 2 ? BLUE : INK}"/>`, `translate(${1500 - i * 52}px,780px) scale(0)`, `translate(${1500 - i * 52}px,780px) scale(1)`, 1.6 + i * 0.09, 0.6));

  const css = `.gm{transform:var(--to);mix-blend-mode:multiply;animation:gm-in var(--t) cubic-bezier(.3,1.35,.45,1) var(--d) both}
@keyframes gm-in{from{transform:var(--from);opacity:0}25%{opacity:1}to{transform:var(--to);opacity:1}}
.gr{stroke-dasharray:150;stroke-dashoffset:150;animation:gr-in .6s ease-out var(--d) forwards}
@keyframes gr-in{to{stroke-dashoffset:0}}
.gl{stroke-dasharray:1.1;stroke-dashoffset:1.1;animation:gl-in 1s cubic-bezier(.45,.05,.25,1) var(--d) forwards}
@keyframes gl-in{to{stroke-dashoffset:0}}
@media (prefers-reduced-motion:reduce){.gm{animation:none}.gr,.gl{animation:none;stroke-dashoffset:0}}`;
  return `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><style>${css}</style>${out.join('')}</svg>`;
}
