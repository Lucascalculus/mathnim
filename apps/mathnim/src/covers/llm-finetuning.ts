// The fine-tuning course's cover: a murmuration of words. Some fifteen hundred small glyphs (Latin, digits, Chinese,
// a little punctuation) fly as one flock: a ribbon that twists as it sweeps over the page, thin and dark where it
// folds edge-on, wispy at its ends, the way starlings look at dusk. A thread of violet ones (the course's colour)
// flies inside it. On opening they arrive from scattered places along the flock's length, as a wave.
//
// Drawn for this course alone (docs/TASTE.md §5); nothing here is meant for reuse.
const INK = '#1a1b1f', VIOLET = '#7C3AED';
const GLYPHS = 'abcdefghijklmnopqrstuvwxyzetaoinshrdlu0123456789的一是在不了有和人这中大为上个国我以要他时来用们生到作地于出就分对成会可主发年动同工也能下过子说产种面而方后多定行学法所民得经十三之进着等部度家电力里如水化高自二理起小物现实加量都两体制机当使点从业本去把性好应开它合还因由其些然前外天政四日那社义事平形相全表间样与关各重新线内数正心反你明看原又么利比或但质气第向道命此变条只没结解问意建月公无系军很情者最立代想已通并提直题党程展五果料象员革位入常文总次品式活设及管特件长求老头基资边流路级少图山统接知较将组见计别她手角期根论运农指几九区强放决西被干做必战先回则任取据处府更般十';
const PUNCT = '.,;:!?·—()[]{}<>/*+=#@&%';
const MONO = "ui-monospace,'SF Mono',Menlo,monospace";
const SANS = "-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Noto Sans CJK SC',sans-serif";

let seed = 20;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
const f1 = (v: number) => (Math.round(v * 10) / 10).toString();

type XY = [number, number];
// two flocks, each a ribbon that twists as it sweeps (cubic Bézier spines): the big one a mass over the upper right,
// folding twice; a small one splitting off to the left along the top (the lower left stays clear for the title)
interface Flock { spine: XY[]; n: number; width: number; turns: number; phase: number; delay: number }
const FLOCKS: Flock[] = [
  { spine: [[640, 300], [900, -40], [1500, 60], [1380, 420]], n: 1700, width: 230, turns: 1.6, phase: 0.4, delay: 0.1 },
  { spine: [[1380, 420], [1300, 700], [1000, 560], [1200, 820]], n: 450, width: 120, turns: 1.1, phase: 1.3, delay: 1.2 },
  { spine: [[600, 260], [420, 120], [180, 160], [-60, 60]], n: 380, width: 70, turns: 1.4, phase: 2.2, delay: 0.6 },
];
function bez(c: XY[], k: number): { p: XY; t: XY } {
  const [a, b, cc, d] = c, m = 1 - k;
  const p: XY = [m * m * m * a[0] + 3 * m * m * k * b[0] + 3 * m * k * k * cc[0] + k * k * k * d[0], m * m * m * a[1] + 3 * m * m * k * b[1] + 3 * m * k * k * cc[1] + k * k * k * d[1]];
  const t: XY = [3 * m * m * (b[0] - a[0]) + 6 * m * k * (cc[0] - b[0]) + 3 * k * k * (d[0] - cc[0]), 3 * m * m * (b[1] - a[1]) + 6 * m * k * (cc[1] - b[1]) + 3 * k * k * (d[1] - cc[1])];
  const l = Math.hypot(t[0], t[1]) || 1;
  return { p, t: [t[0] / l, t[1] / l] };
}

export function svg(): string {
  seed = 20;
  const out: string[] = [];
  for (const F of FLOCKS) for (let i = 0; i < F.n; i++) {
    const s = rnd();
    const { p, t } = bez(F.spine, s);
    const nrm: XY = [-t[1], t[0]];
    // the ribbon twists: its seen width is |cos| of the twist, so it pinches thin and dark where it folds edge-on;
    // across it the birds fill evenly, thinning at the edges; it tapers to wisps at both ends
    const twist = Math.cos(s * Math.PI * 2 * F.turns + F.phase);
    const width = F.width * Math.sin(Math.PI * s) ** 0.55 + 8;
    const u = rnd() * 2 - 1, across = Math.sign(u) * Math.abs(u) ** 0.8 + gauss() * 0.08;
    const off = width * (0.07 + 0.93 * Math.abs(twist)) * across;
    const depth = gauss() * 22 * (0.4 + Math.abs(twist));
    const x = p[0] + nrm[0] * off + t[0] * depth, y = p[1] + nrm[1] * off + t[1] * depth;
    // near birds (one side of the twist) are drawn larger than far ones
    const near = 0.75 + 0.5 * (0.5 + 0.5 * Math.sin(s * Math.PI * 2 * F.turns + F.phase) * across);
    // a few strays round the flock
    const stray = rnd() < 0.04;
    const sx = stray ? x + gauss() * 120 : x, sy = stray ? y + gauss() * 90 : y;
    const thread = Math.abs(across) < 0.1 && !stray && F === FLOCKS[0] && rnd() < 0.75;
    const r = rnd();
    const ch = thread ? GLYPHS[Math.floor(rnd() * 26)] : r < 0.5 ? GLYPHS[26 + Math.floor(rnd() * (GLYPHS.length - 26))] : r < 0.93 ? GLYPHS[Math.floor(rnd() * 46)] : PUNCT[Math.floor(rnd() * PUNCT.length)];
    const cjk = ch.charCodeAt(0) > 0x2e80;
    const size = (cjk ? 8.5 : 10) * near * (0.8 + 0.35 * rnd()) * (stray ? 0.85 : 1);
    const ang = (Math.atan2(t[1], t[0]) * 180) / Math.PI + gauss() * 18;
    const op = thread ? 0.85 : (0.25 + 0.45 * rnd()) * (0.55 + 0.45 * (1 - Math.abs(twist)));
    // it arrives along the flock's length, from a little behind and aside
    const d = F.delay + s * 1.5 + rnd() * 0.35;
    const dx = -t[0] * (40 + 60 * rnd()) + gauss() * 30, dy = -t[1] * (40 + 60 * rnd()) + gauss() * 30;
    // (the rotation on a g: a glyph's arrival is a CSS transform, which would replace its own; the drift is
    // turned back into the glyph's frame so it comes from behind it on the page)
    const a = (-ang * Math.PI) / 180, rx = dx * Math.cos(a) - dy * Math.sin(a), ry = dx * Math.sin(a) + dy * Math.cos(a);
    const glyph = ch.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;');
    out.push(`<g transform="rotate(${f1(ang)} ${f1(sx)} ${f1(sy)})"><text x="${f1(sx)}" y="${f1(sy)}" font-size="${f1(size)}" fill="${thread ? VIOLET : INK}" fill-opacity="${op.toFixed(2)}"${cjk ? ` font-family="${SANS}"` : ''} style="--d:${d.toFixed(2)}s;--dx:${f1(rx)}px;--dy:${f1(ry)}px">${glyph}</text></g>`);
  }
  const css = `.mm text{opacity:0;animation:mm-in 1.1s cubic-bezier(.2,.7,.2,1) var(--d) forwards}
@keyframes mm-in{from{opacity:0;transform:translate(var(--dx),var(--dy))}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.mm text{animation:none;opacity:1}}`;
  return `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" font-family="${MONO}"><style>${css}</style><g class="mm">${out.join('')}</g></svg>`;
}
