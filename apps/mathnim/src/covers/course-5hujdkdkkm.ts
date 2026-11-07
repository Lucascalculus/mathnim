// The Internet Technologies course's cover: a transit map. A yellow loop and four lines crossing it at right angles
// and forty-fives, thick and flat in their own colours, rounded at the bends; interchanges as white rings, a few
// stations named after protocols (as if the net were a city you could ride). The lines are laid one after another,
// each at its own speed; the interchanges pop in once the lines are down, the names last.
//
// Drawn for this course alone (docs/TASTE.md §5).
const RED = '#DC241F', BLUE = '#1C3F94', GREEN = '#00843D', PURPLE = '#8E1F6B', YELLOW = '#F4BE00', INK = '#1a1b1f';
const SANS = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Arial,sans-serif";
type XY = [number, number];
const DX = 60;   // the whole map, a little to the right of where it was laid out

/** A line through points, its bends rounded (radius r) as on a transit map. */
function rounded(pts: XY[], r = 34): string {
  const p = pts.map(([x, y]) => [x + DX, y] as XY);
  let d = `M${p[0][0]} ${p[0][1]}`;
  for (let i = 1; i < p.length - 1; i++) {
    const [a, b, c] = [p[i - 1], p[i], p[i + 1]];
    const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const k1 = Math.min(r, l1 / 2) / l1, k2 = Math.min(r, l2 / 2) / l2;
    d += ` L${(b[0] - (b[0] - a[0]) * k1).toFixed(1)} ${(b[1] - (b[1] - a[1]) * k1).toFixed(1)} Q${b[0]} ${b[1]} ${(b[0] + (c[0] - b[0]) * k2).toFixed(1)} ${(b[1] + (c[1] - b[1]) * k2).toFixed(1)}`;
  }
  const z = p[p.length - 1];
  return d + ` L${z[0]} ${z[1]}`;
}

// the loop and the lines, laid out on a 20-unit grid
const LOOP: XY[] = [[1190, 260], [1420, 260], [1420, 640], [960, 640], [960, 260], [1190, 260]];
const LINES: [string, XY[], number][] = [
  [RED, [[740, 330], [1640, 330]], 0.3],
  [BLUE, [[860, 900], [1080, 680], [1080, 120], [1160, 40], [1160, -20]], 0.55],
  [GREEN, [[1640, 560], [1240, 560], [1080, 400], [800, 400]], 0.8],
  [PURPLE, [[1640, -20], [1600, 20], [1340, 280], [1340, 920]], 1.0],
];
const INTERCHANGES: XY[] = [[960, 330], [1420, 330], [1080, 330], [1340, 330], [1080, 260], [1080, 640], [1420, 560], [960, 400], [1080, 400], [1340, 260], [1340, 640], [1340, 560]];
// a few stations on a single line (a stub on one side of it, in its colour), and some names
const TICKS: [XY, number, string][] = [[[820, 330], 0, RED], [[1520, 330], 180, RED], [[1180, 260], 180, YELLOW], [[1240, 640], 180, YELLOW], [[960, 520], 90, YELLOW], [[1500, 560], 0, GREEN], [[880, 400], 0, GREEN], [[1340, 800], 90, PURPLE], [[1420, 450], 90, YELLOW], [[970, 770], 45, BLUE]];
const NAMES: [XY, string, 'start' | 'end' | 'middle'][] = [
  [[740, 312], 'DNS', 'start'], [[1080, 120], 'HTTP', 'end'], [[1430, 312], 'TCP', 'start'], [[1092, 384], 'IP', 'start'],
  [[1352, 548], 'UDP', 'start'], [[1430, 636], 'TLS', 'start'], [[800, 384], 'ARP', 'start'], [[1352, 790], 'BGP', 'start'],
  [[948, 520], 'Wi-Fi', 'end'], [[1180, 248], 'DHCP', 'middle'], [[1520, 312], 'QUIC', 'middle'], [[958, 768], 'SMTP', 'end'],
];

export function svg(): string {
  const o: string[] = [];
  // the loop first (it carries the others), then each line, each laid at its own pace
  o.push(`<path class="tl" d="${rounded(LOOP, 60)}" stroke="${YELLOW}" style="--d:.1s;--t:1.6s"/>`);
  for (const [col, pts, d] of LINES) o.push(`<path class="tl" d="${rounded(pts)}" stroke="${col}" style="--d:${d}s;--t:${(1 + pts.length * 0.15).toFixed(2)}s"/>`);
  TICKS.forEach(([[x, y], ang, col], i) => o.push(`<line class="tt" x1="${x + DX}" y1="${y}" x2="${x + DX}" y2="${y - 17}" transform="rotate(${ang} ${x + DX} ${y})" stroke="${col}" stroke-width="7" style="--d:${(1.8 + i * 0.05).toFixed(2)}s"/>`));
  INTERCHANGES.forEach(([x, y], i) => o.push(`<g class="ti" style="--x:${x + DX}px;--y:${y}px;--d:${(1.7 + i * 0.06).toFixed(2)}s"><circle r="11" fill="#fff" stroke="${INK}" stroke-width="3.5"/></g>`));
  NAMES.forEach(([[x, y], s, a], i) => o.push(`<text class="tn" x="${x + DX}" y="${y}" text-anchor="${a}" style="--d:${(2.3 + i * 0.05).toFixed(2)}s">${s}</text>`));
  const css = `.tl{fill:none;stroke-width:11;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:3000;stroke-dashoffset:3000;animation:tl-in var(--t) cubic-bezier(.5,0,.2,1) var(--d) forwards}
@keyframes tl-in{to{stroke-dashoffset:0}}
.ti{transform:translate(var(--x),var(--y)) scale(0);animation:ti-in .5s cubic-bezier(.3,1.6,.5,1) var(--d) forwards}
@keyframes ti-in{to{transform:translate(var(--x),var(--y)) scale(1)}}
.tt{opacity:0;animation:tn-in .4s ease-out var(--d) forwards}
.tn{font:600 15px ${SANS};letter-spacing:.02em;fill:${INK};fill-opacity:.62;opacity:0;animation:tn-in .6s ease-out var(--d) forwards}
@keyframes tn-in{to{opacity:1}}
@media (prefers-reduced-motion:reduce){.tl{animation:none;stroke-dashoffset:0}.ti{animation:none;transform:translate(var(--x),var(--y))}.tt,.tn{animation:none;opacity:1}}`;
  return `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMaxYMid slice"><style>${css}</style>${o.join('')}</svg>`;
}
