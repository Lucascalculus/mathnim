// M4: why the MPC law is piecewise affine (explicit MPC, Bemporad et al. 2002).
// For the two-move cart QP (qp2d.ts), the plane of initial states (p₀, v₀) is
// cut into critical regions: in each one the same limits are active, so the
// optimum solves the same linear KKT system, and the first move is an affine
// function of the state, a₁ = K_r x₀ + k_r. Left: the map, coloured by which
// limit family is active (exact polygons). Right: a₁ along a horizontal slice
// of the map (v₀ fixed): straight pieces, with a kink wherever the slice crosses
// into another region; the no-limits law of M3 (one straight line) for
// comparison. The learner drags the slice.
import { Create, FadeIn, Scene, VGroup, VMobject, ValueTracker, smooth } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { MAP, free_a1, map_regions, region_family, slice_law, type Poly } from './qp2d';
import { LANG_SPEC, Plot, clamp, fill_poly, hatch, live_label, live_vm, pick, poly_points, polys_points, resolve_lang, stroke, tex, words, type P3, type XY } from './kit';
import { live_tex } from './qp_plane';
import { mixed } from '../ft/d/kit';
import { aside } from '../aside';

export interface ExplicitMapParams extends Record<string, unknown> {
  story: string;
  v: number;
  lang: string;
}

export { MAP, map_regions, region_family, free_a1, slice_law };

export const mpc_explicit_map = define_visual<ExplicitMapParams>({
  name: 'mpc_explicit_map',
  summary: 'Explicit MPC on the two-move cart QP: the plane of initial states (p₀, v₀) is cut into critical regions (one active set each, coloured by the limit family that is active; exact polygons). Inside each region the first move is affine in the state, a₁ = K_r x₀ + k_r; along a horizontal slice of the map, a₁(p₀) is a chain of straight pieces with kinks at region boundaries, next to the single straight line of the no-limits law. Drag the slice.',
  topics: ['mpc', 'explicit mpc', 'piecewise affine', 'critical region', 'active set', 'multiparametric', 'control'],
  params: {
    story: { type: 'enum', values: ['full', 'setup'], default: 'full', doc: "'full': the map fills in family by family, then the slice sweeps; 'setup': everything shown at once" },
    v: { type: 'number', min: 0, max: 2, default: 0.6, doc: 'speed of the slice [m/s] (0.6: motor limit, then the linear law, then braking at the limit; 1.5: speed limit, wall, linear, braking)' },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { story: 'setup', v: 1.5 }, { story: 'setup', v: 1.9, lang: 'zh' }, { story: 'setup', v: 0 }],
  ids: ['map', 'regions', 'boundaries', 'infeasible', 'slice', 'law_plot', 'law', 'free_law', 'kinks', 'legend', 'count', 'note'],
  scene: (p) => {
    const lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    class ExplicitMap extends Scene {
      vs = ValueTracker(p.v);
      /** How much of the map is coloured (story: 0 → 4: none, motor, speed, wall). */
      fill = ValueTracker(p.story === 'full' ? 0 : 4);
      override construct() {
        const c = palette();
        const { vs, fill } = this;
        vs.name = 'slice_v';
        fill.name = 'fill';
        this.track(vs, fill);
        const regs = map_regions();
        const COL: Record<string, string> = { none: c.bg, input: c.accent, speed: c.gold, wall: c.coral };

        // ---- left: the map of initial states
        const mbox = { x0: -6.1, x1: -0.55, y0: -2.15, y1: 2.35 };
        const map = new Plot({
          box: mbox, x: MAP.p, y: MAP.v, x_ticks: [4, 5, 6, 7, 8, 9, 10], y_ticks: [0, 0.5, 1, 1.5, 2], grid: false,
          x_label: { tex: 'p_0\\;(\\mathrm{m})' }, y_label: { tex: 'v_0\\;(\\mathrm{m/s})' }, font: 22,
        });
        map.group.name = 'map';
        const S = (poly: Poly): XY[] => poly.map(([x, y]) => [map.X(x), map.Y(y)] as XY);
        // infeasible part: the whole box hatched underneath, the regions cover the rest
        const inf = VGroup(fill_poly(S([[MAP.p[0], MAP.v[0]], [MAP.p[1], MAP.v[0]], [MAP.p[1], MAP.v[1]], [MAP.p[0], MAP.v[1]]]), c.faint, 1),
          hatch({ x0: mbox.x0, x1: mbox.x1, y0: mbox.y0, y1: mbox.y1 }, c.muted, 0.2, 1.5, 0.6));
        inf.name = 'infeasible';
        const order = ['none', 'input', 'speed', 'wall'];
        const fills = order.map((fam, k) => {
          void k;
          return VGroup(...regs.filter((r) => region_family(r) === fam).map((r) => {
            const base = fill_poly(S(r.poly), c.bg, 1);
            const tint = fill_poly(S(r.poly), COL[fam], fam === 'none' ? 0 : r.W.length > 1 ? 0.34 : 0.2);
            return VGroup(base, tint);
          }));
        });
        const regions = VGroup(...fills);
        regions.name = 'regions';
        const bounds = stroke(c.ink, 1.6, 0.7);
        bounds.points = polys_points(regs.map((r) => S([...r.poly, r.poly[0]])));
        bounds.name = 'boundaries';
        // words in the largest regions
        const region_word = (en: string, zh: string, p0: number, v0: number, col: string, max_w?: number) => words(L(en, zh), 20, col, map.X(p0), map.Y(v0), { align: 'center', max_w });
        const in_words = VGroup(
          region_word('none active', '都不起作用', 8.62, 0.8, c.ink, 1.6),
          VGroup(region_word('motor', '电机', 7.78, 0.16, c.accent, 0.9), region_word('motor + speed', '电机 + 速度', 5.3, 0.4, c.ink)),
          region_word('speed', '速度', 5.0, 1.78, c.ink),
          region_word('wall', '墙', 7.33, 1.8, c.coral),
          region_word('no plan', '无解', 9.45, 1.82, c.ink),
        );
        // legend under the map: shade = one active limit, darker = two
        const legend = VGroup(
          words(L('colour: which limit is active (darker: two at once)', '颜色：哪种限制在起作用（颜色深：同时两个）'), 20, c.muted, mbox.x0, -3.62, { max_w: 5.6 }),
        );
        legend.name = 'legend';
        const count = words(L(`${regs.length} regions, each with its own straight-line law`, `${regs.length} 个区域，每个区域一条自己的直线公式`), 22, c.ink, mbox.x0, 3.62, { max_w: 6.2 });
        count.name = 'count';
        // the slice: a horizontal line across the map at v₀ = vs
        const slice = live_vm(stroke(c.purple, 4), () => poly_points([[mbox.x0, map.Y(vs.get_value())], [mbox.x1, map.Y(vs.get_value())]]), () => vs.get_value().toFixed(4));
        slice.name = 'slice';
        const slice_word = live_tex(() => `v_0 = ${vs.get_value().toFixed(2)}`, 24, c.purple, (m) => m.move_to([mbox.x1 + 0.12 + m.width / 2, clamp(map.Y(vs.get_value()), mbox.y0 + 0.15, mbox.y1 - 0.15), 0]));

        // ---- right: a₁ along the slice
        const lbox = { x0: 1.55, x1: 6.7, y0: -2.15, y1: 2.35 };
        const lp = new Plot({
          box: lbox, x: MAP.p, y: [-1.5, 1.5], x_ticks: [4, 5, 6, 7, 8, 9, 10], y_ticks: [-1, 0, 1],
          x_label: { tex: 'p_0\\;(\\mathrm{m})' }, y_label: { tex: 'a_1\\;(\\mathrm{m/s^2})' }, font: 22, zero_axis: true,
        });
        lp.group.name = 'law_plot';
        const lim_band = VGroup(lp.band(1, 1.5, c.muted, 0.1), lp.band(-1.5, -1, c.muted, 0.1));
        const cache: { key: string; law: ReturnType<typeof slice_law> } = { key: '', law: { pts: [], kinks: [], end: 10 } };
        const law_at = () => {
          const k = vs.get_value().toFixed(4);
          if (cache.key !== k) {
            cache.key = k;
            cache.law = slice_law(vs.get_value());
          }
          return cache.law;
        };
        const free = lp.live_curve(() => [[MAP.p[0], free_a1(MAP.p[0], vs.get_value())], [MAP.p[1], free_a1(MAP.p[1], vs.get_value())]], { color: c.muted, width: 3, dash: [0.14, 0.1] }, () => vs.get_value().toFixed(4));
        free.name = 'free_law';
        const law = lp.live_curve(() => law_at().pts, { color: c.purple, width: 5 }, () => vs.get_value().toFixed(4));
        law.name = 'law';
        const kinks = live_vm(VMobject({ fill_color: c.purple, fill_opacity: 1, stroke_width: 0, stroke_color: c.purple }), () => {
          const ks = law_at().kinks, out = new Float64Array(ks.length * 8 * 12), r = 0.075;
          ks.forEach(([x, y], i) => {
            const cx = lp.X(x), cy = lp.Y(y);
            for (let j = 0; j < 8; j++) {
              const a0 = (2 * Math.PI * j) / 8, a1 = (2 * Math.PI * (j + 1)) / 8;
              for (let s = 0; s < 4; s++) {
                const a = a0 + ((a1 - a0) * s) / 3, o = (i * 8 + j) * 12 + 3 * s;
                out[o] = cx + r * Math.cos(a);
                out[o + 1] = cy + r * Math.sin(a);
              }
            }
          });
          return out;
        }, () => vs.get_value().toFixed(4));
        kinks.name = 'kinks';
        const end_word = live_label(() => (law_at().end < MAP.p[1] - 0.3 ? L('no plan', '无解') : ''), 20, c.coral, (m) => {
          const x = lp.X(law_at().end);
          m.move_to([x + 0.1 + m.width / 2 > lbox.x1 ? x - 0.1 - m.width / 2 : x + 0.1 + m.width / 2, lbox.y1 - 0.2, 0]);
        });
        const end_line = live_vm(stroke(c.coral, 2.5), () => {
          const e = law_at().end;
          if (e >= MAP.p[1] - 1e-6) return new Float64Array(0);
          return polys_points(dash([[lp.X(e), lbox.y0], [lp.X(e), lbox.y1]]));
        }, () => vs.get_value().toFixed(4));
        const law_title = mixed(lang === 'zh' ? ['沿这条线，第一步的', { tex: 'a_1' }] : ['first move', { tex: 'a_1' }, 'along the slice'], lbox.x0, 3.05, 22, c.purple);
        const free_word = words(L('dashed: no limits (one straight line)', '虚线：不管限制（一条直线）'), 20, c.muted, lbox.x0, -3.62, { max_w: 5.4 });
        const formula = tex('a_1 = K_r\\, x_0 + k_r', 28, c.ink).move_to([mbox.x0 + 1.15, 3.05, 0]);
        const note = aside(this, words(L('toy cart, exact', '玩具小车，精确计算'), 20, c.muted, 6.9, 3.62, { align: 'right' }));
        note.name = 'note';

        // ---- story
        const base = [map.group, lp.group, lim_band, note];
        if (p.story === 'full') {
          this.play(...base.map((m) => FadeIn(m)), { run_time: 1.2 });
          // the regions appear family by family (then the states with no plan)
          for (let k = 0; k < 4; k++) {
            this.play(FadeIn(fills[k]), FadeIn(in_words.submobjects[k]), ...(k === 0 ? [FadeIn(bounds)] : []), { run_time: 1.1 });
            this.wait(k === 0 ? 1.2 : 0.7);
          }
          this.add(inf, regions, bounds, in_words);
          this.play(FadeIn(inf), FadeIn(in_words.submobjects[4]), FadeIn(legend), FadeIn(count), { run_time: 0.8 });
          this.wait(1);
          // the slice and the law along it
          slice_word.update(0);
          this.play(Create(slice), FadeIn(slice_word), FadeIn(law_title), FadeIn(formula), { run_time: 1 });
          this.play(Create(free), FadeIn(free_word), { run_time: 1 });
          this.play(Create(law), { run_time: 2 });
          this.add(kinks, end_line, end_word);
          this.wait(1.5);
          this.play(vs.animate.set_value(1.5), { run_time: 3, rate_func: smooth });
          this.wait(1.2);
          this.play(vs.animate.set_value(p.v), { run_time: 2, rate_func: smooth });
          this.wait(0.8);
        } else {
          slice_word.update(0);
          this.add(inf, regions, bounds);
          this.play(...base.map((m) => FadeIn(m)), FadeIn(inf), FadeIn(regions), FadeIn(bounds), FadeIn(in_words), FadeIn(legend), FadeIn(count), FadeIn(slice), FadeIn(slice_word),
            FadeIn(law_title), FadeIn(formula), FadeIn(free), FadeIn(free_word), FadeIn(law), { run_time: 1 });
          this.add(kinks, end_line, end_word);
          this.wait(0.4);
        }
      }
    }
    return new ExplicitMap();
  },
  explore: (scene: any, ui, p) => {
    const lang = resolve_lang(p.lang);
    const y0 = -2.15, y1 = 2.35, x = -0.55;
    const Y = (v: number) => y0 + ((v - MAP.v[0]) / (MAP.v[1] - MAP.v[0])) * (y1 - y0);
    const Yi = (y: number) => MAP.v[0] + ((y - y0) / (y1 - y0)) * (MAP.v[1] - MAP.v[0]);
    ui.add_handle({
      get: (): P3 => [x, Y(scene.vs.get_value()), 0],
      set: (pt: P3) => scene.vs.set_value(Math.round(clamp(Yi(pt[1]), MAP.v[0], MAP.v[1]) * 20) / 20),
      constraint: (pt: P3): P3 => [x, clamp(pt[1], y0, y1), 0],
      step: 0.1125,
      radius: 0.4,
      label: pick(lang, 'the slice v₀', '切片 v₀'),
    });
  },
});
/** Dashes of a scene-space segment. */
function dash(seg: XY[]): XY[][] {
  const [a, b] = seg, L = Math.hypot(b[0] - a[0], b[1] - a[1]), out: XY[][] = [];
  for (let s = 0; s < L; s += 0.24) {
    const e = Math.min(L, s + 0.14);
    out.push([[a[0] + ((b[0] - a[0]) * s) / L, a[1] + ((b[1] - a[1]) * s) / L], [a[0] + ((b[0] - a[0]) * e) / L, a[1] + ((b[1] - a[1]) * e) / L]]);
  }
  return out;
}
