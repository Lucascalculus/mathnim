// "Does fine-tuning save money?" as a real budget: daily cost of a large model
// with a long prompt (A) against a fine-tuned small model with a short prompt
// and a fixed daily cost (B), on log-log axes. The lines cross at the
// break-even volume N* = F / (c_A - c_B). Prompt caching lowers A's input cost,
// long outputs make the shorter prompt matter less, and F = 0 (per-token LoRA
// hosting) moves N* to zero. Exact arithmetic; the prices are examples.
// Explore: drag N, the cache-hit share and the fixed cost (the output length is a
// parameter). The lesson's action locks a volume in (a pin on the plot).
import { Create, DashedLine, Dot, FadeIn, MathTex, Rectangle, Scene, VGroup, VMobject, ValueTracker, always_redraw, smooth } from 'manim-web';
import { Slider } from 'manim-web/ext/widgets';
import { palette } from '../../theme';
import { define_visual } from '../../visual';
import { fit, group, label, LANG_SPEC, live, num, pick, resolve_lang, seg, value_row, type Lang } from '../f/kit';

export interface CostCrossoverParams extends Record<string, unknown> {
  requests_per_day: number;
  tokens_in_a: number;
  tokens_in_b: number;
  tokens_out: number;
  price_in_a: number;
  price_out_a: number;
  price_in_b: number;
  price_out_b: number;
  cache_hit: number;
  cache_price_ratio: number;
  fixed_per_day: number;
  lang: string;
}

/** Cost of one request (USD); prices are per million tokens. */
export function per_request(tokens_in: number, p_in: number, tokens_out: number, p_out: number, cache_hit = 0, cache_ratio = 1): number {
  return (tokens_in * p_in * (1 - cache_hit + cache_hit * cache_ratio) + tokens_out * p_out) / 1e6;
}
/** Break-even requests per day, or Infinity when B is never cheaper. */
export function break_even(c_a: number, c_b: number, fixed: number): number {
  if (c_a <= c_b) return Infinity;
  return fixed / (c_a - c_b);
}

const PLOT = { x0: -5.4, x1: 0.45, y0: -2.55, y1: 2.65 };
const LX: [number, number] = [1, 6]; // log10 requests per day
const LY: [number, number] = [-1, 4.5]; // log10 USD per day
const X = (lg: number) => PLOT.x0 + ((lg - LX[0]) / (LX[1] - LX[0])) * (PLOT.x1 - PLOT.x0);
const Y = (lg: number) => PLOT.y0 + ((lg - LY[0]) / (LY[1] - LY[0])) * (PLOT.y1 - PLOT.y0);
const PANEL_X = 1.05;

function short(n: number): string {
  if (n >= 1e6) return `${+(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${+(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k`;
  return `${+n.toFixed(n < 1 ? 1 : 0)}`;
}
/** A polyline through points, broken where a point is undefined (off the plot). */
function polyline(pts: ([number, number] | null)[], color: string, width: number): VMobject {
  const out: number[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1];
    if (!a || !b) continue;
    for (let j = 0; j < 4; j++) out.push(a[0] + ((b[0] - a[0]) * j) / 3, a[1] + ((b[1] - a[1]) * j) / 3, 0);
  }
  const vm = VMobject({ stroke_color: color, stroke_width: width, fill_opacity: 0 });
  if (out.length) vm.points = Float64Array.from(out);
  else vm.set_points_as_corners([[PLOT.x0, PLOT.y0, 0], [PLOT.x0, PLOT.y0, 0]]);
  return vm;
}

export const cost_crossover = define_visual<CostCrossoverParams>({
  name: 'cost_crossover',
  summary: 'Does fine-tuning save money? Daily cost of a large model with a long prompt (A) vs a fine-tuned small model with a short prompt plus a fixed daily cost (B), log-log; the lines cross at the break-even volume N* = F/(c_A - c_B). Student drags requests per day, prompt-cache hit share and fixed cost; a lesson action pins a guessed break-even. Exact; prices are examples.',
  topics: ['fine-tuning', 'llm', 'cost', 'latency', 'prompt caching', 'distillation', 'how to choose'],
  params: {
    requests_per_day: { type: 'number', min: 10, max: 1e6, default: 2000, doc: 'requests per day at the start' },
    tokens_in_a: { type: 'number', min: 100, max: 20000, default: 3000, doc: 'input tokens per request with the long prompt (A)' },
    tokens_in_b: { type: 'number', min: 0, max: 20000, default: 300, doc: 'input tokens per request with the fine-tuned short prompt (B)' },
    tokens_out: { type: 'number', min: 10, max: 4000, default: 300, doc: 'output tokens per request (both)' },
    price_in_a: { type: 'number', min: 0, max: 100, default: 3, doc: 'A input price, USD per million tokens (example)' },
    price_out_a: { type: 'number', min: 0, max: 200, default: 15, doc: 'A output price, USD per million tokens (example)' },
    price_in_b: { type: 'number', min: 0, max: 100, default: 0.2, doc: 'B input price, USD per million tokens (0 when self-hosted: then all of B is the fixed cost)' },
    price_out_b: { type: 'number', min: 0, max: 200, default: 0.8, doc: 'B output price, USD per million tokens' },
    cache_hit: { type: 'number', min: 0, max: 1, default: 0, doc: "share of A's input tokens served from the prompt cache" },
    cache_price_ratio: { type: 'number', min: 0, max: 1, default: 0.1, doc: 'cached input price / normal input price' },
    fixed_per_day: { type: 'number', min: 0, max: 5000, default: 20, doc: "B's fixed cost per day in USD (hosting plus amortised training); 0 = per-token LoRA hosting" },
    lang: LANG_SPEC,
  },
  examples: [
    {},
    { lang: 'zh', cache_hit: 0.8 },
    { tokens_in_a: 2500, tokens_in_b: 2300, tokens_out: 200, price_in_b: 0, price_out_b: 0, fixed_per_day: 100, requests_per_day: 300000, lang: 'zh' },
    { fixed_per_day: 0, requests_per_day: 50 },
    { price_in_a: 0.2, price_out_a: 0.8, requests_per_day: 1e6 },
  ],
  ids: ['plot', 'line_a', 'line_b', 'marker', 'readouts', 'formula', 'sliders'],
  scene: (p) => {
    const lang: Lang = resolve_lang(p.lang);
    class CostCrossover extends Scene {
      lgN = ValueTracker(1);
      h = ValueTracker(p.cache_hit);
      F = ValueTracker(p.fixed_per_day);
      /** The volume the learner locked in (log10), or -1. */
      locked = ValueTracker(-1);
      /** Which input was moved last: 0 none, 1 F, 2 the cache share (it changes c_A), 3 N. */
      last = ValueTracker(0);
      sN!: any;
      sh!: any;
      sF!: any;
      /** Cost per request of A and B (USD). */
      cA = () => per_request(p.tokens_in_a, p.price_in_a, p.tokens_out, p.price_out_a, this.h.get_value(), p.cache_price_ratio);
      cB = () => per_request(p.tokens_in_b, p.price_in_b, p.tokens_out, p.price_out_b);
      /** Break-even requests per day (Infinity when B is never cheaper). */
      nstar = () => break_even(this.cA(), this.cB(), this.F.get_value());
      N = () => 10 ** this.lgN.get_value();
      /** Lock in the current volume (the lesson's 'This is break-even' action). Returns it. */
      lock = () => {
        this.locked.set_value(this.lgN.get_value());
        return this.N();
      };
      override construct() {
        const c = palette();
        this.track(this.lgN, this.h, this.F, this.locked, this.last);
        const L = (en: string, zh: string) => pick(lang, en, zh);
        // ---- axes
        const frame = group(
          seg([PLOT.x0, PLOT.y0], [PLOT.x1, PLOT.y0], c.muted, 2),
          seg([PLOT.x0, PLOT.y0], [PLOT.x0, PLOT.y1], c.muted, 2),
        );
        const xt = [1, 2, 3, 4, 5, 6].map((k) => group(seg([X(k), PLOT.y0], [X(k), PLOT.y0 - 0.08], c.muted, 2), label(short(10 ** k), 22, c.muted).move_to([X(k), PLOT.y0 - 0.3, 0])));
        const yt = [-1, 0, 1, 2, 3, 4].map((k) => group(seg([PLOT.x0, Y(k)], [PLOT.x0 - 0.08, Y(k)], c.muted, 2), label(`$${short(10 ** k)}`, 22, c.muted).move_to([PLOT.x0 - 0.5, Y(k), 0])));
        const grid = group(...[1, 2, 3, 4, 5, 6].map((k) => seg([X(k), PLOT.y0], [X(k), PLOT.y1], c.faint, 1.5)), ...[0, 1, 2, 3, 4].map((k) => seg([PLOT.x0, Y(k)], [PLOT.x1, Y(k)], c.faint, 1.5)));
        const xtitle = label(L('requests per day, N', '每天请求数 N'), 24, c.ink).move_to([(PLOT.x0 + PLOT.x1) / 2, PLOT.y0 - 0.72, 0]);
        const ytitle = label(L('cost per day (USD)', '每天成本（美元）'), 24, c.ink).rotate(Math.PI / 2).move_to([PLOT.x0 - 1.2, (PLOT.y0 + PLOT.y1) / 2, 0]);
        const plot = group(grid, frame, ...xt, ...yt, xtitle, ytitle);
        plot.name = 'plot';
        // ---- the two cost lines (live)
        const curve = (cost: (n: number) => number) => {
          const pts: ([number, number] | null)[] = [];
          for (let i = 0; i <= 160; i++) {
            const lg = LX[0] + ((LX[1] - LX[0]) * i) / 160, v = cost(10 ** lg);
            const ly = v > 0 ? Math.log10(v) : -Infinity;
            pts.push(ly >= LY[0] && ly <= LY[1] ? [X(lg), Y(ly)] : null);
          }
          return pts;
        };
        const line_a = live(() => this.cA().toPrecision(6), () => polyline(curve((n) => n * this.cA()), c.coral, 5));
        const line_b = live(() => `${this.F.get_value().toFixed(2)}|${this.cB().toPrecision(6)}`, () => polyline(curve((n) => this.F.get_value() + n * this.cB()), c.accent, 5));
        line_a.name = 'line_a';
        line_b.name = 'line_b';
        const legend_row = (y: number, color: string, text: string) => {
          const t = label(text, 24, color);
          const x0 = PLOT.x0 - 0.2;
          t.move_to([x0 + 0.6 + t.width / 2, y, 0]);
          return group(seg([x0, y], [x0 + 0.45, y], color, 5), t);
        };
        const legend = group(
          legend_row(3.55, c.coral, L('A  large model, long prompt', 'A  大模型 + 长提示')),
          legend_row(3.1, c.accent, L('B  fine-tuned small model, short prompt', 'B  微调小模型 + 短提示')),
        );
        // ---- break-even point
        const cross = always_redraw(() => {
          const n = this.nstar();
          let at: number[] | null = null;
          if (Number.isFinite(n) && n > 0) {
            const lg = Math.log10(n), ly = Math.log10(n * this.cA());
            if (lg >= LX[0] && lg <= LX[1] && ly >= LY[0] && ly <= LY[1]) at = [X(lg), Y(ly), 0];
          }
          const p0 = at ?? [PLOT.x0 + 0.5, PLOT.y0 + 0.5, 0];
          const g = VGroup(Dot(p0, { radius: 0.09, color: c.ink }), label('N*', 24, c.ink).move_to([p0[0] - 0.32, p0[1] + 0.3, 0]));
          if (!at) g.set_opacity(0);
          return g;
        });
        // ---- current volume
        const marker = always_redraw(() => {
          const lg = this.lgN.get_value(), n = 10 ** lg;
          const ms: any[] = [DashedLine([X(lg), PLOT.y0, 0], [X(lg), PLOT.y1, 0], { color: c.gold, stroke_width: 3, dash_length: 0.1 })];
          for (const [v, col] of [[n * this.cA(), c.coral], [this.F.get_value() + n * this.cB(), c.accent]] as [number, string][]) {
            const ly = v > 0 ? Math.log10(v) : -Infinity, inside = ly >= LY[0] && ly <= LY[1];
            const d = Dot([X(lg), inside ? Y(ly) : PLOT.y0, 0], { radius: 0.08, color: col });
            if (!inside) d.set_opacity(0);
            ms.push(d);
          }
          const lk = this.locked.get_value(), on = lk >= LX[0];
          const px = X(on ? lk : lg);
          const pin = VGroup(seg([px, PLOT.y1 - 0.02], [px, PLOT.y1 + 0.32], c.ink, 3), Rectangle({ width: 0.34, height: 0.2, stroke_width: 0, fill_color: c.ink, fill_opacity: 1 }).move_to([px + 0.17, PLOT.y1 + 0.22, 0]));
          if (!on) pin.set_opacity(0);
          ms.push(pin);
          return VGroup(...ms);
        });
        marker.name = 'marker';
        // ---- readouts
        const per_day = L('/day', '/天');
        const readouts = VGroup(
          value_row({ before: 'N =', after: L('requests/day', '次/天'), get: () => Math.round(this.N()), at: [PANEL_X, 3.3] }),
          value_row({ before: 'A: $', after: per_day, get: () => this.N() * this.cA(), decimals: 2, color: c.coral, at: [PANEL_X, 2.82] }),
          value_row({ before: 'B: $', after: per_day, get: () => this.F.get_value() + this.N() * this.cB(), decimals: 2, color: c.accent, at: [PANEL_X, 2.34] }),
        );
        // the break-even formula with today's numbers; the term the learner moved last is underlined
        const f_sym = MathTex('N^* = \\frac{F}{c_A - c_B}', { font_size: 34, color: c.ink }).move_to([0, 1.55, 0]).align_to([PANEL_X, 0, 0], [-1, 0, 0]);
        const sig = (v: number) => (v >= 0.01 ? v.toFixed(4) : v.toPrecision(2));
        const f_num = live(() => `${this.F.get_value().toFixed(0)}|${sig(this.cA())}|${sig(this.cB())}|${this.last.get_value()}`, () => {
          const n = this.nstar();
          const parts = [
            MathTex(`= ${this.F.get_value().toFixed(0)}`, { font_size: 30, color: c.ink }),
            MathTex('/\\,(', { font_size: 30, color: c.ink }),
            MathTex(sig(this.cA()), { font_size: 30, color: c.coral }),
            MathTex(`-\\,${sig(this.cB())}`, { font_size: 30, color: c.accent }),
            MathTex(Number.isFinite(n) ? `)\\approx ${num(Math.round(n)).replace(/,/g, '{,}')}` : ')\\;\\to\\;\\infty', { font_size: 30, color: c.ink }),
          ];
          const row = VGroup(...parts).arrange([1, 0, 0], { buff: 0.1 });
          fit(row as any, 5.9);
          row.move_to([0, 0.92, 0]).align_to([PANEL_X, 0, 0], [-1, 0, 0]);
          const which = this.last.get_value() === 1 ? 0 : this.last.get_value() === 2 ? 2 : -1;
          const t = parts[Math.max(0, which)];
          const u = seg([t.get_left()[0], t.get_bottom()[1] - 0.07], [t.get_right()[0], t.get_bottom()[1] - 0.07], c.gold, 5);
          if (which < 0) u.set_opacity(0);
          return VGroup(row, u);
        });
        const formula = VGroup(f_sym, f_num);
        formula.name = 'formula';
        readouts.name = 'readouts';
        // ---- sliders (captions in Text so both languages work)
        const look = { length: 3.3, color: c.accent, track_color: c.faint, stroke_width: 8, knob_radius: 0.15, font_size: 26, label: null };
        const SX = 4.35;
        this.sN = new Slider(this.lgN, { ...look, x_range: LX, show_value: false }).move_to([SX, -0.05, 0]);
        this.sh = new Slider(this.h, { ...look, x_range: [0, 1], show_value: false }).move_to([SX, -1.15, 0]);
        this.sF = new Slider(this.F, { ...look, x_range: [0, Math.max(200, p.fixed_per_day * 2)], show_value: false }).move_to([SX, -2.25, 0]);
        const cap = (y: number, en: string, zh: string) => label(L(en, zh), 24, c.muted).move_to([0, y + 0.42, 0]).align_to([PANEL_X, 0, 0], [-1, 0, 0]);
        const caps = VGroup(
          cap(-0.05, 'requests per day N (log scale)', '每天请求数 N（对数刻度）'),
          value_row({ before: L("share of A's prompt from cache", 'A 的提示命中缓存的比例'), get: () => this.h.get_value(), decimals: 2, size: 24, color: c.muted, value_color: c.coral, at: [PANEL_X, -0.73] }),
          value_row({ before: L("B's fixed cost per day F, $", 'B 每天的固定成本 F（美元）'), get: () => this.F.get_value(), decimals: 0, size: 24, color: c.muted, value_color: c.ink, at: [PANEL_X, -1.83] }),
        );
        const sliders = VGroup(this.sN, this.sh, this.sF, caps);
        sliders.update(0);
        sliders.name = 'sliders';
        const prices = fit(label(L(
          `example prices, USD per million tokens: A ${p.price_in_a}/${p.price_out_a}, B ${p.price_in_b}/${p.price_out_b}; prompt ${p.tokens_in_a} vs ${p.tokens_in_b} tokens`,
          `示例价格（美元/百万 token）：A ${p.price_in_a}/${p.price_out_a}，B ${p.price_in_b}/${p.price_out_b}；提示 ${p.tokens_in_a} 对 ${p.tokens_in_b} token`,
        ), 22, c.muted), 13.6).move_to([0, -3.62, 0]);

        // ---- the story
        this.play(Create(grid), Create(frame), FadeIn(VGroup(...xt, ...yt)), FadeIn(xtitle), FadeIn(ytitle), { run_time: 1.4 });
        this.play(Create(line_a), FadeIn(legend.submobjects[0]), { run_time: 1.2 });
        this.play(Create(line_b), FadeIn(legend.submobjects[1]), { run_time: 1.2 });
        this.add(cross);
        this.play(FadeIn(prices), { run_time: 0.8 });
        readouts.update(0);
        formula.update(0);
        this.play(FadeIn(readouts), FadeIn(marker), FadeIn(formula), { run_time: 1 });
        const target = Math.log10(Math.min(1e6, Math.max(10, p.requests_per_day)));
        this.play(this.lgN.animate.set_value(target), { run_time: 2.5, rate_func: smooth });
        this.play(FadeIn(sliders), { run_time: 1 });
        this.add(plot, legend, prices, formula);
        this.wait(1.2);
      }
    }
    return new CostCrossover();
  },
  explore: (scene: any, ui) => {
    const mark = (h: any, code: number) => {
      const prev = h.spec.on_change;
      h.spec.on_change = (pt: any) => {
        scene.last.set_value(code);
        prev?.(pt);
      };
    };
    mark(scene.sN.attach(ui, { step: 0.02, label: 'requests per day' }), 3);
    mark(scene.sh.attach(ui, { step: 0.05, label: 'cache hit share' }), 2);
    mark(scene.sF.attach(ui, { step: 5, label: 'fixed cost per day' }), 1);
  },
});
