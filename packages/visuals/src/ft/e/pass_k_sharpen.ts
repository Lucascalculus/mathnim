// pass@k before and after RL (E2). Left: each question's success rate p
// (grey outline = base model, blue = after RL). Right: pass@k = mean over
// questions of 1 - (1 - p)^k, computed exactly, against k on a log scale.
// The learner moves the causes: an illustrative "sharpening" strength s (RL
// concentrates probability on questions it already solves sometimes) and,
// question by question, a success rate it can lift ("teach"). pass@1 rises
// with sharpening while large-k pass@k falls, so the curves cross; only
// lifting questions the model never or rarely solves raises the large-k end.
// In 'sketch' mode it is only the axes with the base curve and the RL pass@1
// point, for a "draw the curve after RL" prediction.
import { Create, FadeIn, LaggedStart, Scene, VGroup, ValueTracker, always_redraw, linear, smooth } from 'manim-web';
import type { Mobject } from 'manim-web';
import { palette } from '../../theme';
import { define_visual } from '../../visual';
import { tex } from '../../linalg/kit';
import { Dot } from 'manim-web';
import { HSlider, LANG_SPEC, clamp, dashed_poly, label, label_at, live_number, pick, polyline, rect, resolve_lang, seg, tag, type Lang, type P3 } from './kit';
import { crossing_k, pass_at_k, question_set, sharpen } from './math';
import { aside } from '../../aside';

export interface PassKSharpenParams extends Record<string, unknown> {
  n_questions: number;
  seed: number;
  preset: string;
  sharpen: number;
  threshold: number;
  mode: string;
  lang: string;
}

const KMAX_LOG = 8; // k up to 256
const BARS = { x0: -6.7, x1: -1.0, y0: -2.15, unit: 4.0 };
const CH = { x0: 0.55, x1: 6.5, y0: -2.15, y1: 1.6 };
const SK = { x0: -4.6, x1: 4.6, y0: -2.55, y1: 2.35 };

export const pass_k_sharpen = define_visual<PassKSharpenParams>({
  name: 'pass_k_sharpen',
  summary: "pass@k before and after RL from per-question success rates (pass@k = mean of 1-(1-p)^k, exact). An illustrative 'sharpening' pushes questions above a threshold up and those below down: pass@1 rises, large-k pass@k falls, the curves cross. Lifting a never-solved question raises only the large-k end. Student drags the sharpening and individual questions.",
  topics: ['pass@k', 'rlvr', 'reasoning', 'grpo', 'sharpening', 'coverage', 'reinforcement learning', 'evaluation', 'fine-tuning'],
  params: {
    n_questions: { type: 'integer', min: 12, max: 40, default: 24, doc: 'number of questions' },
    seed: { type: 'integer', min: 1, max: 999, default: 3, doc: 'seed of the illustrative question set' },
    preset: { type: 'enum', values: ['default', 'easy', 'hard'], default: 'default', doc: 'question mix: default, easy (mostly solvable) or hard (many never solved)' },
    sharpen: { type: 'number', min: 0, max: 3, default: 0, doc: 'illustrative RL sharpening strength s where the scene ends (0 = the base model)' },
    threshold: { type: 'number', min: 0.02, max: 0.5, default: 0.1, doc: 'success rate above which sharpening pushes a question up (below: down)' },
    mode: { type: 'enum', values: ['world', 'sketch'], default: 'world', doc: "'world': bars, curves and handles; 'sketch': axes with the base curve and the RL pass@1 point, for drawing a prediction" },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { sharpen: 1, lang: 'zh' }, { preset: 'hard', sharpen: 2 }, { mode: 'sketch', lang: 'zh' }, { mode: 'sketch' }, { n_questions: 40, preset: 'easy', sharpen: 1.5, lang: 'zh' }],
  ids: ['bars', 'curves', 'readouts', 'slider'],
  scene: (p) => (p.mode === 'sketch' ? sketch_scene(p) : world_scene(p)),
  explore: (scene: any, ui) => scene.attach?.(ui),
});

/** k (as log2 k) to chart x, pass to chart y. */
const make_axes = (box: { x0: number; x1: number; y0: number; y1: number }) => ({
  X: (lk: number) => box.x0 + (lk / KMAX_LOG) * (box.x1 - box.x0),
  Y: (v: number) => box.y0 + v * (box.y1 - box.y0),
  coords_to_point: (lk: number, v: number) => [box.x0 + (lk / KMAX_LOG) * (box.x1 - box.x0), box.y0 + v * (box.y1 - box.y0), 0],
  point_to_coords: (pt: number[]) => [((pt[0] - box.x0) / (box.x1 - box.x0)) * KMAX_LOG, (pt[1] - box.y0) / (box.y1 - box.y0)],
});

function frame(lang: Lang, box: { x0: number; x1: number; y0: number; y1: number }, size = 24): Mobject[] {
  const c = palette();
  const A = make_axes(box);
  const xa = seg([box.x0, box.y0], [box.x1 + 0.1, box.y0], c.muted, 2);
  const ya = seg([box.x0, box.y0], [box.x0, box.y1 + 0.1], c.muted, 2);
  const grid = [0.5, 1].map((v) => seg([box.x0, A.Y(v)], [box.x1, A.Y(v)], c.faint, 1.5));
  const xt = [0, 2, 4, 6, 8].map((lk) => tex(`${2 ** lk}`, size, c.muted).move_to([A.X(lk), box.y0 - 0.3, 0]));
  const yt = [0, 0.5, 1].map((v) => tex(`${v}`, size, c.muted).move_to([box.x0 - 0.3, A.Y(v), 0]));
  const xl = label(pick(lang, 'k (tries, log scale)', 'k（尝试次数，对数刻度）'), size - 2, c.muted).move_to([(box.x0 + box.x1) / 2, box.y0 - 0.7, 0]);
  const yl = tex('\\text{pass@}k', size + 4, c.ink).move_to([box.x0 + 0.55, box.y1 + 0.38, 0]);
  return [xa, ya, ...grid, ...xt, ...yt, xl, yl];
}
/** pass@k curve points for success rates ps. */
function curve(ps: readonly number[], A: ReturnType<typeof make_axes>): number[][] {
  const pts: number[][] = [];
  for (let j = 0; j <= 96; j++) {
    const lk = (KMAX_LOG * j) / 96;
    pts.push([A.X(lk), A.Y(pass_at_k(ps, 2 ** lk))]);
  }
  return pts;
}

function world_scene(p: PassKSharpenParams): Scene {
  const lang = resolve_lang(p.lang) as Lang;
  const base = question_set(p.n_questions, p.seed, p.preset as any);
  const n = base.length, T = p.threshold;
  const pitch = (BARS.x1 - BARS.x0) / n, bw = Math.min(0.17, pitch * 0.68);
  const BX = (q: number) => BARS.x0 + pitch * (q + 0.5);
  const A = make_axes(CH);
  class PassKSharpen extends Scene {
    s = ValueTracker(0);
    grow = ValueTracker(0);
    teach = base.map(() => ValueTracker(0));
    base = base;
    slider!: HSlider;
    on: (type: string, data?: Record<string, unknown>) => void = () => {};
    sharp(q: number): number {
      return sharpen(base[q], this.s.get_value(), T);
    }
    rl(q: number): number {
      return Math.max(this.sharp(q), this.teach[q].get_value());
    }
    rl_all(): number[] {
      return base.map((_, q) => this.rl(q));
    }
    taught(): number {
      return base.filter((_, q) => this.teach[q].get_value() > this.sharp(q) + 1e-6).length;
    }
    pass(k: number, which: 'base' | 'rl'): number {
      return pass_at_k(which === 'base' ? base : this.rl_all(), k);
    }
    override construct() {
      const c = palette();
      const { s, grow } = this;
      this.track(s, grow, ...this.teach);
      // ---- left: the questions
      const head = label_at(pick(lang, 'success rate p of each question', '每道题的正确率 p'), BARS.x0, 3.45, 24, c.ink, 'BOLD');
      const legend = VGroup(
        rect(BARS.x0, 2.86, BARS.x0 + 0.22, 3.1, c.bg, 1, c.muted, 2), label_at(pick(lang, 'base', '基座'), BARS.x0 + 0.32, 2.98, 20, c.muted),
        rect(BARS.x0 + 1.2, 2.86, BARS.x0 + 1.42, 3.1, c.accent, 0.85), label_at(pick(lang, 'after RL', 'RL 之后'), BARS.x0 + 1.52, 2.98, 20, c.accent),
        Dot([BARS.x0 + 3.0, 2.98, 0], { radius: 0.07, color: c.coral, fill_opacity: 0, stroke_color: c.coral, stroke_width: 2.5 } as any),
        label_at(pick(lang, 'never solved (p = 0)', '从没做对过（p = 0）'), BARS.x0 + 3.15, 2.98, 20, c.coral),
      );
      const floor = seg([BARS.x0 - 0.05, BARS.y0], [BARS.x1 + 0.05, BARS.y0], c.muted, 2);
      const one = seg([BARS.x0 - 0.05, BARS.y0 + BARS.unit], [BARS.x1 + 0.05, BARS.y0 + BARS.unit], c.faint, 1.5);
      const one_l = tex('1', 22, c.muted).move_to([BARS.x0 - 0.22, BARS.y0 + BARS.unit, 0]);
      const bars = always_redraw(() => {
        const g = grow.get_value();
        const parts: Mobject[] = [];
        base.forEach((pb, q) => {
          const x = BX(q), pr = this.rl(q) * g;
          parts.push(rect(x - bw / 2, BARS.y0, x + bw / 2, BARS.y0 + pr * BARS.unit, c.accent, 0.85));
          parts.push(rect(x - bw / 2, BARS.y0, x + bw / 2, BARS.y0 + pb * g * BARS.unit, c.bg, 0, c.muted, 2));
          if (this.rl(q) <= 0) parts.push(Dot([x, BARS.y0 + 0.11, 0], { radius: 0.06, color: c.coral, fill_opacity: 0, stroke_color: c.coral, stroke_width: 2.5 } as any));
        });
        return VGroup(...parts);
      });
      bars.name = 'bars';
      const qlab = label(pick(lang, `${n} questions, sorted by base success rate`, `${n} 道题（按基座正确率排序）`), 20, c.muted).move_to([(BARS.x0 + BARS.x1) / 2, BARS.y0 - 0.32, 0]);

      // ---- right: pass@k
      const axes = VGroup(...frame(lang, CH, 22));
      const base_curve = always_redraw(() => dashed_poly(curve(base.map((x) => x * grow.get_value()), A), c.muted, 3.5));
      const rl_curve = always_redraw(() => polyline(curve(this.rl_all().map((x) => x * grow.get_value()), A), c.accent, 5));
      const k64 = dashed_poly([[A.X(6), CH.y0], [A.X(6), CH.y1]], c.faint, 2);
      const marks = always_redraw(() => VGroup(
        ...[0, 6].flatMap((lk) => [
          Dot([A.X(lk), A.Y(this.pass(2 ** lk, 'base') * grow.get_value()), 0], { radius: 0.08, color: c.muted }),
          Dot([A.X(lk), A.Y(this.pass(2 ** lk, 'rl') * grow.get_value()), 0], { radius: 0.09, color: c.accent }),
        ]),
      ));
      const cross = always_redraw(() => {
        const k = crossing_k(base, this.rl_all(), 256);
        if (!k || grow.get_value() < 0.99 || this.pass(1, 'rl') - this.pass(1, 'base') < 0.02) return VGroup();
        const lk = Math.log2(k), y = A.Y(this.pass(k, 'base'));
        const d = Dot([A.X(lk), y, 0], { radius: 0.1, color: c.gold });
        const t = tex(`k^* \\approx ${k < 10 ? k.toFixed(1) : Math.round(k)}`, 24, c.gold).move_to([A.X(lk) + 0.1, y - 0.42, 0]);
        if (t.get_right()[0] > CH.x1) t.move_to([CH.x1 - t.width / 2, y - 0.42, 0]);
        return VGroup(d, t);
      });
      const curves = VGroup(base_curve, rl_curve, marks, cross);
      curves.name = 'curves';
      // readouts: pass@1 and pass@64, base -> RL
      const row = (lk: number, y: number) => {
        const k = 2 ** lk;
        const cap = tex(`\\text{pass@}${k}`, 26, c.ink).move_to([CH.x0 + 0.55, y, 0]);
        const b = live_number(() => this.pass(k, 'base'), [CH.x0 + 1.45, y], { decimals: 2, size: 26, color: c.muted });
        const arrow = tex('\\to', 26, c.muted).move_to([CH.x0 + 2.25, y, 0]);
        const r = live_number(() => this.pass(k, 'rl'), [CH.x0 + 2.55, y], { decimals: 2, size: 26, color: c.accent });
        const d = live_number(() => this.pass(k, 'rl') - this.pass(k, 'base'), [CH.x0 + 3.4, y], { decimals: 2, size: 22, signed: true, color: () => (this.pass(k, 'rl') >= this.pass(k, 'base') - 5e-3 ? c.good : c.coral) });
        return VGroup(cap, b, arrow, r, d);
      };
      const readouts = VGroup(
        label_at(pick(lang, 'base → after RL', '基座 → RL 之后'), CH.x0 + 1.3, 3.45, 20, c.muted),
        row(0, 3.0), row(6, 2.55),
      );
      readouts.name = 'readouts';

      // ---- bottom: the sharpening slider and honesty tags
      const scap = label_at(pick(lang, 'RL sharpening strength s', 'RL 的锐化强度 s'), BARS.x0, -3.05, 22, c.ink);
      this.slider = new HSlider(s, 0, 3, BARS.x0 + 0.1, BARS.x0 + 3.4, -3.55);
      this.slider.group.name = 'slider';
      const sval = live_number(() => s.get_value(), [BARS.x0 + 3.65, -3.55], { decimals: 2, size: 24 });
      const illus = tag(pick(lang, 'illustrative transform', '示意变换'), BARS.x0 + 4.4, -3.55, 18);
      const tl = label_at(pick(lang, 'questions you lifted:', '你抬高的题：'), CH.x0, -3.2, 20, c.ink);
      const taught = VGroup(tl, live_number(() => this.taught(), [tl.get_right()[0] + 0.18, -3.2], { decimals: 0, size: 24, color: c.gold }));
      const exact = aside(this, tag(pick(lang, 'pass@k: exact formula', 'pass@k：按公式精确计算'), 6.9, -3.6, 18, 'right'));

      // ---- story
      s.set_value(0);
      this.play(FadeIn(head), FadeIn(legend), Create(floor), FadeIn(one), FadeIn(one_l), FadeIn(qlab), Create(axes), { run_time: 1.4 });
      this.add(bars, base_curve, rl_curve, k64, marks, cross);
      this.play(grow.animate.set_value(1), { run_time: 2, rate_func: smooth });
      this.play(FadeIn(readouts), FadeIn(scap), FadeIn(this.slider.group), FadeIn(sval), FadeIn(illus), FadeIn(taught), FadeIn(exact), { run_time: 1 });
      this.wait(0.8);
      this.play(s.animate.set_value(1.2), { run_time: 3.5, rate_func: linear });
      this.wait(1.5);
      const q0 = base.findIndex((x) => x === 0);
      if (q0 >= 0) {
        this.play(this.teach[q0].animate.set_value(0.03), { run_time: 1.2 });
        this.wait(1.5);
        this.play(this.teach[q0].animate.set_value(0), s.animate.set_value(p.sharpen), { run_time: 1.2 });
      } else this.play(s.animate.set_value(p.sharpen), { run_time: 1.2 });
      this.add(bars, curves, readouts, this.slider.group);
      this.wait(1.2);
      void LaggedStart;
    }
    attach(ui: any): void {
      this.slider.attach(ui, pick(lang, 'RL sharpening strength', 'RL 锐化强度'), { snap: 0.05, on_end: () => this.on('sharpen', { s: this.s.get_value(), d1: this.pass(1, 'rl') - this.pass(1, 'base'), d64: this.pass(64, 'rl') - this.pass(64, 'base') }) });
      base.forEach((pb, q) => {
        const x = BX(q);
        ui.add_handle({
          get: () => [x, BARS.y0 + this.rl(q) * BARS.unit, 0],
          set: (pt: P3) => this.teach[q].set_value(clamp((pt[1] - BARS.y0) / BARS.unit, 0, 1)),
          constraint: (pt: P3) => [x, clamp(pt[1], BARS.y0, BARS.y0 + BARS.unit), 0],
          step: 0.02,
          radius: Math.max(0.14, pitch * 0.55),
          label: pick(lang, `question ${q + 1} (base p = ${pb.toFixed(3)})`, `第 ${q + 1} 题（基座 p = ${pb.toFixed(3)}）`),
          on_end: () => this.on('teach', { q, base: pb, p: this.rl(q), taught: this.taught(), d64: this.pass(64, 'rl') - this.pass(64, 'base') }),
        });
      });
    }
  }
  return new PassKSharpen();
}

function sketch_scene(p: PassKSharpenParams): Scene {
  const lang = resolve_lang(p.lang) as Lang;
  const base = question_set(p.n_questions, p.seed, p.preset as any);
  const s = p.sharpen > 0 ? p.sharpen : 1;
  const rl = base.map((x) => sharpen(x, s, p.threshold));
  const A = make_axes(SK);
  class PassKSketch extends Scene {
    ax = A;
    /** The curve the learner is asked to draw (RL model), as a function of log2 k. */
    truth = (lk: number) => pass_at_k(rl, 2 ** lk);
    override construct() {
      const c = palette();
      const axes = VGroup(...frame(lang, SK, 24));
      const bc = dashed_poly(curve(base, A), c.muted, 4);
      const bl = label(pick(lang, 'base model', '基座模型'), 22, c.muted).move_to([A.X(6.6), A.Y(pass_at_k(base, 2 ** 6.6)) + 0.3, 0]);
      const p1 = pass_at_k(rl, 1);
      const dot = Dot(A.coords_to_point(0, p1) as any, { radius: 0.11, color: c.accent });
      const dl = label(pick(lang, `blue dot: after RL, pass@1 = ${p1.toFixed(2)}`, `蓝点：RL 之后 pass@1 = ${p1.toFixed(2)}`), 22, c.accent);
      dl.move_to([A.X(0) + 0.25 + dl.width / 2, A.Y(0.9), 0]);
      const ask = label(pick(lang, 'Draw pass@k of the RL model for k = 1 … 256.', '画出 RL 之后模型的 pass@k（k 从 1 到 256）。'), 24, c.ink).move_to([0, 3.5, 0]);
      const illus = tag(pick(lang, 'illustrative question set', '示意题集'), 6.9, -3.6, 18, 'right');
      this.play(Create(axes), FadeIn(ask), { run_time: 1.2 });
      this.play(Create(bc), FadeIn(bl), { run_time: 1.5 });
      this.play(FadeIn(dot), FadeIn(dl), FadeIn(illus), { run_time: 0.8 });
      const curves = VGroup(bc, dot);
      curves.name = 'curves';
      const readouts = VGroup(dl);
      readouts.name = 'readouts';
      const bars = VGroup(bl);
      bars.name = 'bars';
      const slider = VGroup(ask);
      slider.name = 'slider';
      this.add(curves, readouts, bars, slider);
      this.wait(5);
    }
  }
  return new PassKSketch();
}
