// Fitting one Gaussian student q = N(μ, σ²) to a two-peaked teacher p (E3).
// The two KL divergences are computed exactly (numerical integration):
// forward KL(p‖q) = E_{x~p}[log p/q] punishes q for missing mass where the
// teacher has it, so q spreads over both peaks; reverse KL(q‖p) =
// E_{x~q}[log q/p] punishes q for putting mass where the teacher has none, so
// q settles into one peak - the one nearest where descent starts. The strip
// below the plot is the integrand of the chosen KL: its signed area is the KL.
// The learner drags the top of q (left/right = μ, up/down = σ) and switches
// the direction; the lesson's action runs gradient descent from where q is.
import { Create, FadeIn, Scene, VGroup, ValueTracker, always_redraw, smooth } from 'manim-web';
import { Dot } from 'manim-web';
import { palette } from '../../theme';
import { define_visual } from '../../visual';
import { tex } from '../../linalg/kit';
import { Choice, LANG_SPEC, Toggle, area, clamp, label_at, live_number, pick, pick_shown, polyline, resolve_lang, seg, tag, type Lang, type P3 } from './kit';
import { descend, gauss, kl_forward, kl_reverse, mixture_pdf, moment_match, type KlDir, type Mixture } from './math';

export interface ForwardReverseKlParams extends Record<string, unknown> {
  weight: number;
  separation: number;
  mode_width: number;
  mu: number;
  sigma: number;
  direction: string;
  lang: string;
}

const PLOT = { x0: -6.5, x1: 1.9, base: -1.35, unit: 3.9, clip: 0.98 };
const STRIP = { base: -2.85, unit: 0.8, clip: 0.9 };
const DX = (x: number) => PLOT.x0 + ((x + 5) / 10) * (PLOT.x1 - PLOT.x0);
const XD = (cx: number) => ((cx - PLOT.x0) / (PLOT.x1 - PLOT.x0)) * 10 - 5;
const SIGMA_MIN = 0.42, SIGMA_MAX = 3.4;

export const forward_reverse_kl = define_visual<ForwardReverseKlParams>({
  name: 'forward_reverse_kl',
  summary: 'Fit one Gaussian q to a two-peaked teacher p: forward KL(p‖q) (exact, numerical) makes q cover both peaks (moment matching), reverse KL(q‖p) makes q sit in one peak, the one nearest where it starts. The strip shows the integrand whose area is the KL. Student drags the top of q (μ, σ) and switches the direction.',
  topics: ['kl divergence', 'forward kl', 'reverse kl', 'distillation', 'on-policy distillation', 'mode seeking', 'mode covering', 'fine-tuning'],
  params: {
    weight: { type: 'number', min: 0.5, max: 0.9, default: 0.5, doc: 'mass of the left peak (0.5 = two equal peaks; 0.7 = the left one is heavier)' },
    separation: { type: 'number', min: 1, max: 3, default: 2, doc: 'the peaks sit at -d and +d' },
    mode_width: { type: 'number', min: 0.3, max: 1, default: 0.6, doc: 'standard deviation of each peak' },
    mu: { type: 'number', min: -4, max: 4, default: 2.5, doc: "student's mean where the scene ends" },
    sigma: { type: 'number', min: SIGMA_MIN, max: SIGMA_MAX, default: 1, doc: "student's standard deviation where the scene ends" },
    direction: { type: 'enum', values: ['forward', 'reverse'], default: 'forward', doc: "which KL is shown and optimised: 'forward' KL(p‖q) or 'reverse' KL(q‖p)" },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { direction: 'reverse', lang: 'zh' }, { weight: 0.7, direction: 'reverse', mu: 2, sigma: 0.6 }, { separation: 1, mode_width: 0.9, lang: 'zh' }, { mu: -4, sigma: 3.4, direction: 'reverse' }],
  ids: ['teacher', 'student', 'integrand', 'readouts', 'controls'],
  scene: (p) => build(p),
  explore: (scene: any, ui) => scene.attach(ui),
});

function build(p: ForwardReverseKlParams): Scene {
  const lang = resolve_lang(p.lang) as Lang;
  class ForwardReverseKl extends Scene {
    mu = ValueTracker(p.mu);
    sigma = ValueTracker(p.sigma);
    dir = ValueTracker(p.direction === 'reverse' ? 1 : 0);
    uneven = ValueTracker(p.weight > 0.5 ? 1 : 0);
    run_t = ValueTracker(0);
    path: [number, number][] = [];
    on: (type: string, data?: Record<string, unknown>) => void = () => {};
    dir_c!: Choice;
    uneven_t!: Toggle;
    ui: any = null;
    mix(): Mixture {
      return { w: this.uneven.get_value() > 0.5 ? Math.max(p.weight, 0.7) : 0.5, d: p.separation, s0: p.mode_width };
    }
    direction(): KlDir {
      return this.dir.get_value() > 0.5 ? 'reverse' : 'forward';
    }
    fwd(): number {
      return kl_forward(this.mu.get_value(), this.sigma.get_value(), this.mix());
    }
    rev(): number {
      return kl_reverse(this.mu.get_value(), this.sigma.get_value(), this.mix());
    }
    state() {
      return { dir: this.direction(), mu: this.mu.get_value(), sigma: this.sigma.get_value(), fwd: this.fwd(), rev: this.rev(), uneven: this.uneven.get_value() > 0.5 };
    }
    override construct() {
      const c = palette();
      const { mu, sigma, dir, uneven } = this;
      this.track(mu, sigma, dir, uneven, this.run_t);
      const xs = Array.from({ length: 241 }, (_, i) => -5 + (10 * i) / 240);
      const Y = (d: number) => PLOT.base + Math.min(d, PLOT.clip) * PLOT.unit;
      // axes
      const axis = seg([PLOT.x0, PLOT.base], [PLOT.x1, PLOT.base], c.muted, 2);
      const ticks = VGroup(...[-4, -2, 0, 2, 4].map((v) => tex(`${v}`, 22, c.muted).move_to([DX(v), PLOT.base - 0.25, 0])));
      // teacher
      const teacher = always_redraw(() => {
        const m = this.mix();
        const top = xs.map((x) => [DX(x), Y(mixture_pdf(x, m))]);
        return VGroup(area([[DX(-5), PLOT.base], ...top, [DX(5), PLOT.base]], c.muted, 0.22), polyline(top, c.muted, 3));
      });
      teacher.name = 'teacher';
      // student
      const student = always_redraw(() => polyline(xs.map((x) => [DX(x), Y(gauss(x, mu.get_value(), sigma.get_value()))]), c.accent, 5));
      student.name = 'student';
      const knob = always_redraw(() => Dot([DX(mu.get_value()), Y(gauss(0, 0, sigma.get_value())), 0], { radius: 0.12, color: c.accent }));
      const legend = VGroup(
        area([[PLOT.x0, 3.32], [PLOT.x0 + 0.3, 3.32], [PLOT.x0 + 0.3, 3.56], [PLOT.x0, 3.56]], c.muted, 0.3),
        label_at(pick(lang, 'teacher p (two peaks)', '老师 p（两个峰）'), PLOT.x0 + 0.4, 3.44, 22, c.ink),
        seg([PLOT.x0 + 3.5, 3.44], [PLOT.x0 + 3.85, 3.44], c.accent, 5),
        label_at(pick(lang, 'student q = N(μ, σ²)', '学生 q = N(μ, σ²)'), PLOT.x0 + 3.95, 3.44, 22, c.accent),
      );
      // integrand strip: signed contribution of each x to the chosen KL
      const sbase = seg([PLOT.x0, STRIP.base], [PLOT.x1, STRIP.base], c.faint, 2);
      const integrand = always_redraw(() => {
        const m = this.mix(), d = this.direction();
        const v = xs.map((x) => {
          const pp = mixture_pdf(x, m), qq = gauss(x, mu.get_value(), sigma.get_value());
          const val = d === 'forward' ? (pp > 1e-12 ? pp * Math.log((pp + 1e-300) / (qq + 1e-300)) : 0) : qq > 1e-12 ? qq * Math.log((qq + 1e-300) / (pp + 1e-300)) : 0;
          return clamp(val, -STRIP.clip, STRIP.clip);
        });
        const top = xs.map((x, i) => [DX(x), STRIP.base + v[i] * STRIP.unit]);
        return VGroup(area([[DX(-5), STRIP.base], ...top, [DX(5), STRIP.base]], c.coral, 0.35), polyline(top, c.coral, 2.5));
      });
      integrand.name = 'integrand';
      const scap = pick_shown([
        label_at(pick(lang, 'p·log(p/q): its area is KL(p‖q)', 'p·log(p/q)：面积就是 KL(p‖q)'), PLOT.x0, STRIP.base + 0.78, 20, c.coral),
        label_at(pick(lang, 'q·log(q/p): its area is KL(q‖p)', 'q·log(q/p)：面积就是 KL(q‖p)'), PLOT.x0, STRIP.base + 0.78, 20, c.coral),
      ], () => (this.direction() === 'forward' ? 0 : 1));

      // panel
      const X = 2.55;
      this.dir_c = new Choice(dir, X, 2.85, [pick(lang, 'forward KL', '正向 KL'), pick(lang, 'reverse KL', '反向 KL')], { size: 20 });
      const formula = pick_shown([
        tex('\\mathrm{KL}(p\\Vert q)=\\mathbb{E}_{x\\sim p}\\!\\left[\\log\\tfrac{p(x)}{q(x)}\\right]', 32),
        tex('\\mathrm{KL}(q\\Vert p)=\\mathbb{E}_{x\\sim q}\\!\\left[\\log\\tfrac{q(x)}{p(x)}\\right]', 32),
      ].map((m) => m.move_to([X + m.width / 2, 2.05, 0])), () => (this.direction() === 'forward' ? 0 : 1));
      const where = pick_shown([
        label_at(pick(lang, 'mean over teacher samples', '在老师的样本上取平均'), X, 1.45, 20, c.muted),
        label_at(pick(lang, 'mean over student samples', '在学生自己的样本上取平均'), X, 1.45, 20, c.muted),
      ], () => (this.direction() === 'forward' ? 0 : 1));
      const kl_row = (t: string, get: () => number, y: number, mine: () => boolean) => VGroup(
        tex(t, 30, c.ink).move_to([X + 0.75, y, 0]),
        live_number(get, [X + 1.62, y], { decimals: 3, size: 30, color: () => (mine() ? c.accent : c.muted) }),
      );
      const readouts = VGroup(
        kl_row('\\mathrm{KL}(p\\Vert q) =', () => this.fwd(), 0.85, () => this.direction() === 'forward'),
        kl_row('\\mathrm{KL}(q\\Vert p) =', () => this.rev(), 0.35, () => this.direction() === 'reverse'),
        VGroup(tex('\\mu =', 28).move_to([X + 0.3, -0.2, 0]), live_number(() => mu.get_value(), [X + 0.62, -0.2], { decimals: 2, size: 28 }),
          tex('\\sigma =', 28).move_to([X + 1.85, -0.2, 0]), live_number(() => sigma.get_value(), [X + 2.17, -0.2], { decimals: 2, size: 28 })),
      );
      readouts.name = 'readouts';
      this.uneven_t = new Toggle(uneven, X, -0.85, pick(lang, 'left peak heavier (70%)', '左峰更重（70%）'), { size: 20 });
      const controls = VGroup(this.dir_c.group, this.uneven_t.group);
      controls.name = 'controls';
      const honest = tag(pick(lang, 'toy 1-D example · KL by exact numerical integration', '一维示意 · KL 用数值积分精确计算'), 6.9, -3.62, 18, 'right');

      // ---- story: forward pulls q over both peaks, reverse into one
      const m0 = moment_match({ w: 0.5, d: p.separation, s0: p.mode_width });
      mu.set_value(2.5);
      sigma.set_value(1);
      dir.set_value(0);
      uneven.set_value(0);
      readouts.update(0);
      this.play(Create(axis), FadeIn(ticks), FadeIn(teacher), FadeIn(legend), { run_time: 1.2 });
      this.play(Create(student), FadeIn(knob), FadeIn(controls), FadeIn(formula), FadeIn(where), FadeIn(readouts), { run_time: 1.2 });
      this.play(Create(sbase), FadeIn(integrand), FadeIn(scap), FadeIn(honest), { run_time: 1 });
      this.wait(0.6);
      this.play(mu.animate.set_value(m0.mu), sigma.animate.set_value(clamp(m0.sigma, SIGMA_MIN, SIGMA_MAX)), { run_time: 2.5, rate_func: smooth });
      this.wait(1.2);
      this.play(dir.animate.set_value(1), { run_time: 0.3 });
      this.wait(1);
      this.play(mu.animate.set_value(p.separation), sigma.animate.set_value(Math.max(SIGMA_MIN, p.mode_width)), { run_time: 2.5, rate_func: smooth });
      this.wait(1.2);
      this.play(mu.animate.set_value(p.mu), sigma.animate.set_value(p.sigma), dir.animate.set_value(p.direction === 'reverse' ? 1 : 0), uneven.animate.set_value(p.weight > 0.5 ? 1 : 0), { run_time: 1.2 });
      this.add(teacher, student, knob, integrand, readouts, controls);
      this.wait(1);
    }
    attach(ui: any): void {
      this.ui = ui;
      const Yk = (s: number) => PLOT.base + Math.min(gauss(0, 0, s), PLOT.clip) * PLOT.unit;
      const y_lo = Yk(SIGMA_MAX), y_hi = Yk(SIGMA_MIN);
      ui.add_handle({
        get: () => [DX(this.mu.get_value()), Yk(this.sigma.get_value()), 0],
        set: (pt: P3) => {
          this.mu.set_value(clamp(XD(pt[0]), -4, 4));
          const dens = (clamp(pt[1], y_lo, y_hi) - PLOT.base) / PLOT.unit;
          this.sigma.set_value(clamp(1 / (dens * Math.sqrt(2 * Math.PI)), SIGMA_MIN, SIGMA_MAX));
        },
        constraint: (pt: P3) => [clamp(pt[0], DX(-4), DX(4)), clamp(pt[1], y_lo, y_hi), 0],
        step: 0.1,
        radius: 0.4,
        label: pick(lang, 'top of the student q (left/right: μ, up/down: σ)', '学生 q 的峰顶（左右改 μ，上下改 σ）'),
        on_end: () => this.on('release', this.state()),
      });
      this.dir_c.attach(ui, pick(lang, 'which KL', '哪个方向的 KL'), () => this.on('dir', this.state()));
      this.uneven_t.attach(ui, pick(lang, 'left peak heavier', '左峰更重'), () => this.on('uneven', this.state()));
    }
    /** Gradient descent on the chosen KL from where q is now (animated when a player is attached, unless `instant`). */
    run_descent(instant = false): void {
      const d = this.direction(), start = { mu: this.mu.get_value(), sigma: this.sigma.get_value() };
      const path = descend(d, start.mu, start.sigma, this.mix(), { steps: 220 });
      const [mu1, s1] = path[path.length - 1];
      const done = () => this.on('descent', { ...this.state(), start_mu: start.mu, start_sigma: start.sigma });
      const player = this.ui?.player;
      if (!instant && player?.play_now) {
        this.path = path;
        this.run_t.set_value(0);
        const follow = () => {
          const k = Math.min(path.length - 1, Math.round(this.run_t.get_value() * (path.length - 1)));
          this.mu.set_value(path[k][0]);
          this.sigma.set_value(clamp(path[k][1], SIGMA_MIN, SIGMA_MAX));
        };
        this.run_t.add_updater(follow);
        void player.play_now(this.run_t.animate.set_value(1), { run_time: 2.2, rate_func: smooth }).then(() => {
          this.run_t.remove_updater(follow);
          this.mu.set_value(mu1);
          this.sigma.set_value(clamp(s1, SIGMA_MIN, SIGMA_MAX));
          player.refresh?.();
          done();
        });
      } else {
        this.mu.set_value(mu1);
        this.sigma.set_value(clamp(s1, SIGMA_MIN, SIGMA_MAX));
        done();
      }
    }
  }
  return new ForwardReverseKl();
}
