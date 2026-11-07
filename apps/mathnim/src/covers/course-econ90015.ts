// The ECON90015 course's cover: a risograph print in two inks, fluorescent pink and blue, multiplied where they
// overlap. A pink halftone sun (big dots in the middle, small at the rim); across it a blue band rising and a pink
// band falling, crossing in an X (supply and demand, if you like); the grain of the drum in every solid, the blue
// layer a few pixels off register. On opening the two inks slide in from either side and nearly register; the sun's
// dots come up ring by ring from its middle.
//
// Drawn for this course alone (docs/TASTE.md §5).
const PINK = '#FF4F9A', BLUE = '#2F6BD8';
const f1 = (v: number) => (Math.round(v * 10) / 10).toString();

export function svg(): string {
  const o: string[] = [];
  // the sun: dots on a 14-unit grid turned 15° (as a screen is), their radius falling off from the middle
  const C: [number, number] = [1190, 430], R = 300, G = 14, th = (15 * Math.PI) / 180;
  const dots: string[] = [];
  for (let j = -R; j <= R; j += G) for (let i = -R; i <= R; i += G) {
    const x = C[0] + i * Math.cos(th) - j * Math.sin(th), y = C[1] + i * Math.sin(th) + j * Math.cos(th);
    const d = Math.hypot(x - C[0], y - C[1]) / R;
    if (d > 1) continue;
    const r = 5.4 * (1 - d) ** 0.7 + 0.5;
    dots.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" style="--d:${(0.5 + d * 1.1).toFixed(2)}s"/>`);
  }
  o.push(`<g class="rs" fill="${PINK}">${dots.join('')}</g>`);
  // the two bands, each a thick stroke with the drum's grain
  o.push(`<g class="rp" style="--from:translateX(140px)"><path d="M800 120 C 1000 160, 1300 420, 1640 780" stroke="${PINK}" filter="url(#rg)"/></g>`);
  o.push(`<g class="rp rb" style="--from:translateX(-160px)"><path d="M820 840 C 1050 760, 1330 460, 1640 110" stroke="${BLUE}" filter="url(#rg)"/></g>`);
  // a few small marks of each ink, as a printer leaves
  o.push(`<g class="rp" style="--from:translateY(-40px)"><circle cx="905" cy="560" r="16" fill="${BLUE}" filter="url(#rg)"/><circle cx="1505" cy="250" r="9" fill="${PINK}"/><path d="M1440 790 l18 -32 l18 32 z" fill="${BLUE}" filter="url(#rg)"/></g>`);

  const defs = `<defs><filter id="rg" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.75"/><feComposite in="SourceGraphic" operator="in"/></filter></defs>`;
  const css = `.rp,.rs{mix-blend-mode:multiply}
.rp path{fill:none;stroke-width:64;stroke-linecap:butt;opacity:.92}
.rp{animation:rp-in 1.3s cubic-bezier(.25,1.2,.4,1) .2s both}
.rb{transform:translate(5px,-4px);animation-name:rb-in;animation-delay:.35s}
@keyframes rp-in{from{transform:var(--from);opacity:0}to{transform:none;opacity:1}}
@keyframes rb-in{from{transform:var(--from);opacity:0}to{transform:translate(5px,-4px);opacity:1}}
.rs circle{opacity:0;animation:rs-in .5s ease-out var(--d) forwards}
@keyframes rs-in{to{opacity:.88}}
@media (prefers-reduced-motion:reduce){.rp{animation:none}.rb{transform:translate(5px,-4px)}.rs circle{animation:none;opacity:.88}}`;
  return `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMaxYMid slice">${defs}<style>${css}</style>${o.join('')}</svg>`;
}
