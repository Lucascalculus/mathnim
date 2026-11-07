// The machine-learning course's cover: a pointillist landscape after Seurat. Dots of pure colour make a dusk:
// violet-blue sky, an orange sun, rolling green hills flecked with their complement, water at the bottom. Each
// region has its palette; near a border the two palettes mix (a dot's region is chosen with a probability that
// falls off across the border, so the edges blur as classes do). Towards the title the dots thin out and the
// picture dissolves into the page. On opening the dots are dabbed on in no order, as a painter works.
//
// Drawn for this course alone (docs/TASTE.md §5).
const SKY = ['#8FB3E3', '#A59BDB', '#B8D2EF', '#7E9FD6', '#C4B8E8'];
const SUN = ['#F4A340', '#F7C948', '#EF7D3C', '#F9D976'];
const HILL = ['#5BA67A', '#8CC084', '#3E8E6B', '#A9CF8B', '#E0705A'];
const WATER = ['#3D7DB8', '#5FA8C9', '#7FC1D6', '#2F6A9E'];
const f1 = (v: number) => (Math.round(v * 10) / 10).toString();

let seed = 49;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const pick = (p: string[]) => p[Math.floor(rnd() * p.length)];

const hill_top = (x: number) => 520 + 34 * Math.sin(x / 150) + 22 * Math.sin(x / 61 + 1.3);
const water_top = (x: number) => 715 + 10 * Math.sin(x / 90);
const SUN_C: [number, number] = [1270, 330], SUN_R = 112;

/** The region a point is painted from, borders blurred by a soft coin (signed distances in units). */
function palette_at(x: number, y: number): string[] {
  const soft = (d: number) => 1 / (1 + Math.exp(-d / 9));
  if (rnd() < soft(y - water_top(x))) return WATER;
  if (rnd() < soft(y - hill_top(x))) return HILL;
  if (rnd() < soft(SUN_R - Math.hypot(x - SUN_C[0], y - SUN_C[1]))) return SUN;
  return SKY;
}

// (performance: dots are dabbed on in WAVES groups, each a random share of them fading in together, so a few
// dozen animations run rather than thousands; the colour of each dot is a class, not an attribute)
const WAVES = 18;
export function svg(): string {
  seed = 49;
  const all = [...new Set([...SKY, ...SUN, ...HILL, ...WATER])];
  const waves: string[][] = Array.from({ length: WAVES }, () => []);
  const G = 15;
  for (let gy = 60; gy < 900; gy += G) for (let gx = 600; gx < 1620; gx += G) {
    const x = gx + (rnd() - 0.5) * G * 0.9, y = gy + (rnd() - 0.5) * G * 0.9;
    // the picture dissolves towards the title, and frays at the top
    if (rnd() > smooth(690, 1060, x) * smooth(40, 170, y)) continue;
    const pal = palette_at(x, y);
    const r = (pal === SUN ? 5.4 : 4.6) * (0.75 + 0.45 * rnd());
    waves[Math.floor(rnd() * WAVES)].push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" class="k${all.indexOf(pick(pal))}"/>`);
  }
  const css = all.map((c, i) => `.pt .k${i}{fill:${c}}`).join('') + `
.pt>g{opacity:0;animation:pt-in .9s ease-out var(--d) forwards}
@keyframes pt-in{to{opacity:.9}}
@media (prefers-reduced-motion:reduce){.pt>g{animation:none;opacity:.9}}`;
  const body = waves.map((w, i) => `<g style="--d:${(0.1 + (i / WAVES) * 2.2).toFixed(2)}s">${w.join('')}</g>`).join('');
  return `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMaxYMid slice"><style>${css}</style><g class="pt">${body}</g></svg>`;
}
