// Q4 of the ECON90015 mock exam: Cournot duopoly with p = 50 − 0.1(q1 + q2), MC1 = 0.2q1 + 2,
// MC2 = 0.05q2 + 2. The reaction functions R1: q1 = 120 − 0.25q2 (steep in the (q1, q2) plane) and
// R2: q2 = 192 − 0.4q1 (flat). Drag the starting outputs: firm 1 replies (a horizontal move to R1), firm 2
// replies (a vertical move to R2), and so on; each round shrinks the distance to the crossing (80, 160)
// by 0.25 × 0.4 = 0.1, so from anywhere the replies close in on the one point where both are already
// replying best: the Nash equilibrium.
import { Create, FadeIn, Circle, Scene, UpdateFromAlphaFunc, VGroup, ValueTracker, linear } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { aside } from '../aside';
import { LANG_SPEC, Plot, clamp, emit, follow, live_label, live_vm, num, pick, polys_points, resolve_lang, stroke, tex, words, type P3, type XY } from './kit';

export interface CournotParams extends Record<string, unknown> {
  q1: number;
  q2: number;
  lang: string;
}

export const R1 = (q2: number) => Math.max(0, 120 - 0.25 * q2);
export const R2 = (q1: number) => Math.max(0, 192 - 0.4 * q1);
const ROUNDS = 6;
/** The outputs after each reply, starting from (a, b): firm 1 replies first. */
export function replies(a: number, b: number, n = ROUNDS): XY[] {
  const pts: XY[] = [[a, b]];
  let x = a, y = b;
  for (let k = 0; k < n; k++) {
    if (k % 2 === 0) x = R1(y);
    else y = R2(x);
    pts.push([x, y]);
  }
  return pts;
}

export const econ_cournot = define_visual<CournotParams>({
  name: 'econ_cournot',
  summary: 'Cournot duopoly as best replies (ECON90015 Q4: R1: q1 = 120 − 0.25q2, R2: q2 = 192 − 0.4q1): drag the starting outputs and watch the firms reply in turn, horizontal moves to R1 and vertical moves to R2, closing in on the crossing (80, 160), the Nash equilibrium, with each reply listed.',
  topics: ['economics', 'oligopoly', 'cournot', 'nash equilibrium', 'best response', 'reaction function', 'game theory'],
  params: {
    q1: { type: 'number', min: 0, max: 300, default: 230, doc: "firm 1's starting output" },
    q2: { type: 'number', min: 0, max: 450, default: 400, doc: "firm 2's starting output" },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { q1: 0, q2: 0 }, { q1: 300, q2: 0, lang: 'zh' }, { q1: 80, q2: 160 }, { q1: 10, q2: 450 }],
  ids: ['plane', 'r1', 'r2', 'path', 'start', 'equilibrium', 'replies'],
  scene: (p) => {
    const lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    class Cournot extends Scene {
      a = new ValueTracker(p.q1);
      b = new ValueTracker(p.q2);
      shown = new ValueTracker(0);
      plot!: Plot;
      override construct() {
        const c = palette();
        const { a, b, shown } = this;
        this.track(a, b, shown);
        const pts = () => replies(a.get_value(), b.get_value());
        const key = () => `${a.get_value().toFixed(2)},${b.get_value().toFixed(2)},${shown.get_value().toFixed(3)}`;
        aside(this, words(L('the numbers of Q4; firm 1 replies first', '第 4 题的数；厂商 1 先回应'), 20, c.muted, -6.9, 3.6));

        const P = new Plot({ box: { x0: -5.9, x1: 0.5, y0: -2.75, y1: 3.0 }, x: [0, 300], y: [0, 480], x_ticks: [80, 120, 240], y_ticks: [160, 192, 480], x_label: { tex: 'q_1' }, y_label: { tex: 'q_2' }, font: 24 });
        this.plot = P;
        P.group.name = 'plane';
        const r1 = VGroup(P.curve([[120, 0], [0, 480]], { color: c.accent, width: 4.5 }), tex('R_1', 30, c.accent).move_to([P.X(110) + 0.4, P.Y(48), 0]));
        r1.name = 'r1';
        const r2 = VGroup(P.curve([[0, 192], [300, 72]], { color: c.coral, width: 4.5 }), tex('R_2', 30, c.coral).move_to([P.X(290), P.Y(76) + 0.32, 0]));
        r2.name = 'r2';
        const eq = VGroup(Circle({ radius: 0.09, color: c.ink, fill_opacity: 1, stroke_width: 0 }).move_to(P.P(80, 160)), tex('(80,\\,160)', 26, c.ink).move_to([P.X(80) + 0.95, P.Y(160) + 0.3, 0]));
        eq.name = 'equilibrium';

        // the replies so far: firm 1's moves (horizontal) in its colour, firm 2's (vertical) in its own
        const segs = (firm: 0 | 1) => () => {
          const ps = pts(), out: XY[][] = [], n = shown.get_value();
          for (let k = 0; k < ROUNDS && k < n; k++) {
            if (k % 2 !== firm) continue;
            const f = Math.min(1, n - k), [x0, y0] = ps[k], [x1, y1] = ps[k + 1];
            out.push(...P.pieces([[x0, y0], [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f]]));
          }
          return polys_points(out);
        };
        const path = VGroup(live_vm(stroke(c.accent, 3.5), segs(0), key), live_vm(stroke(c.coral, 3.5), segs(1), key));
        path.name = 'path';
        const start = follow(Circle({ radius: 0.13, color: c.purple, fill_opacity: 1, stroke_width: 0 }), () => P.P(clamp(a.get_value(), 0, 300), clamp(b.get_value(), 0, 480)));
        start.name = 'start';

        // each reply, in words
        const X0 = 1.35;
        const line = (k: number, y: number) => live_label(() => {
          if (shown.get_value() < k - 0.001) return '';
          const ps = pts();
          if (k === 0) return `${L('start', '起点')}  (${num(ps[0][0])}, ${num(ps[0][1])})`;
          const firm = k % 2 === 1 ? 1 : 2, v = firm === 1 ? ps[k][0] : ps[k][1];
          return `${L(`firm ${firm} replies`, `厂商 ${firm} 回应`)}  ${num(v)}`;
        }, 26, k === 0 ? c.purple : k % 2 === 1 ? c.accent : c.coral, (t) => t.move_to([X0 + t.width / 2, y, 0]));
        const rows = Array.from({ length: ROUNDS + 1 }, (_, k) => line(k, 2.95 - 0.55 * k));
        const end = live_label(() => (shown.get_value() < ROUNDS - 0.001 ? '' : L('… to (80, 160), where p = 26', '……趋向 (80, 160)，此时 p = 26')), 26, c.ink, (t) => t.move_to([X0 + t.width / 2, 2.95 - 0.55 * (ROUNDS + 1) - 0.1, 0]), { max_width: 5.3 });
        const list = VGroup(...rows, end);
        list.name = 'replies';

        this.play(FadeIn(P.group), Create(r1.submobjects[0]), Create(r2.submobjects[0]), { run_time: 1.6 });
        this.play(FadeIn(r1.submobjects[1]), FadeIn(r2.submobjects[1]), { run_time: 0.5 });
        // (live parts are added, not faded: a fade copies them and they change underneath)
        this.add(path, start, list);
        this.wait(0.6);
        this.play(UpdateFromAlphaFunc(shown, (_m: unknown, t?: number) => shown.set_value(ROUNDS * (t ?? 1))), { run_time: 4.5, rate_func: linear });
        this.play(FadeIn(eq), { run_time: 0.6 });
        this.add(r1, r2, eq, path, start, list);
        this.wait(1.5);
      }
    }
    return new Cournot();
  },
  explore: (scene: any, ui, p) => {
    const L = (en: string, zh: string) => pick(resolve_lang(p.lang), en, zh);
    const P: Plot = scene.plot;
    const snap = (v: number, hi: number) => clamp(Math.round(v / 10) * 10, 0, hi);
    ui.add_handle({
      get: (): P3 => P.P(scene.a.get_value(), scene.b.get_value()),
      set: (pt: P3) => {
        const [x, y] = P.data(pt);
        scene.a.set_value(snap(x, 300));
        scene.b.set_value(snap(y, 480));
      },
      constraint: (pt: P3): P3 => [clamp(pt[0], P.box.x0, P.box.x1), clamp(pt[1], P.box.y0, P.box.y1), 0],
      step: P.X(10) - P.X(0),
      radius: 0.38,
      label: L('the starting outputs', '起始产量'),
      on_end: () => emit(scene, 'cournot', { q1: scene.a.get_value(), q2: scene.b.get_value(), path: replies(scene.a.get_value(), scene.b.get_value()) }),
    });
  },
});
