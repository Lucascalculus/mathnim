// PPO's clipped surrogate for one token, as a function of the probability
// ratio ρ = π_θ/π_old: min(ρA, clip(ρ, 1-ε, 1+ε)A). The student drags ρ (how
// far the new policy has moved this token's probability), flips the token
// between good (A > 0) and bad (A < 0) and changes ε. The arrow shows which
// way gradient ascent pushes ρ; the formula lights up the term the min takes.
// Clipping only stops a move further in the advantage's direction; a token
// that moved the wrong way is always corrected. `eps_high` gives DAPO's
// asymmetric band (E1). Exact: the objective itself.
import { Circle, Create, DashedLine, Dot, FadeIn, Indicate, Scene, VGroup, ValueTracker, always_redraw, linear, smooth } from 'manim-web';
import { palette } from '../../theme';
import { define_visual } from '../../visual';
import { arrow, readout, tex, texs } from '../../linalg/kit';
import { clip_objective, clip_slope } from './math';
import { LANG_SPEC, Switch, clamp, label, live_number, pick, polyline, rect, resolve_lang, seg, switch_text, x_ticks, y_ticks, type Lang, type P3 } from './kit';
import { aside } from '../../aside';

export interface PpoClipParams extends Record<string, unknown> {
  story: string;
  eps: number;
  eps_high: number;
  adv_sign: string;
  rho: number;
  lang: string;
}

const PLOT = { x0: -6.2, x1: 1.55, y0: -3.35, y1: 2.45 };
const R0 = 0.3, R1 = 2.0, F = 2.15;
const Y0 = (PLOT.y0 + PLOT.y1) / 2;
const X = (rho: number) => PLOT.x0 + ((rho - R0) / (R1 - R0)) * (PLOT.x1 - PLOT.x0);
const Y = (f: number) => Y0 + (f / F) * ((PLOT.y1 - PLOT.y0) / 2);
const RHO = (x: number) => R0 + ((x - PLOT.x0) / (PLOT.x1 - PLOT.x0)) * (R1 - R0);

export const ppo_clip = define_visual<PpoClipParams>({
  name: 'ppo_clip',
  summary: "PPO's clipped objective min(ρA, clip(ρ,1-ε,1+ε)A) against the probability ratio ρ: the arrow shows whether the gradient pushes this token's probability up, down or not at all, and the formula lights the term the min takes. Clipping only blocks a further move in the advantage's direction, never a correction. Drag ρ and flip good/bad token; eps sets the band, eps_high > 0 gives DAPO's asymmetric band.",
  topics: ['ppo', 'clipping', 'policy gradient', 'rlhf', 'grpo', 'reinforcement learning', 'fine-tuning'],
  params: {
    story: { type: 'enum', values: ['full', 'setup'], default: 'full', doc: "'full' sweeps a good token, then a bad one; 'setup' only builds the picture at ρ = 1 with a good token (for a world)" },
    eps: { type: 'number', min: 0.05, max: 0.5, default: 0.2, doc: 'clip range ε (lower side 1-ε); PPO uses 0.2' },
    eps_high: { type: 'number', min: 0, max: 0.5, default: 0, doc: 'upper clip range (1+ε_high); 0 = same as eps; DAPO uses 0.28 with eps 0.2' },
    adv_sign: { type: 'enum', values: ['+', '-'], default: '+', doc: "sign of the advantage A ('+' good token, '-' bad token) where the scene ends" },
    rho: { type: 'number', min: R0, max: R1, default: 1, doc: 'probability ratio ρ = π_θ/π_old where the scene ends' },
    lang: LANG_SPEC,
  },
  examples: [{}, { adv_sign: '-', lang: 'zh' }, { eps: 0.2, eps_high: 0.28 }, { eps: 0.05, rho: 1.8, lang: 'zh' }, { story: 'setup', lang: 'zh' }],
  ids: ['formula', 'derivative', 'objective', 'unclipped', 'band', 'rho_point', 'grad_arrow', 'status', 'sign_switch', 'readouts'],
  scene: (p) => {
    const lang: Lang = resolve_lang(p.lang);
    class PpoClip extends Scene {
      rho = ValueTracker(0.6);
      eps = ValueTracker(p.eps);
      sign = ValueTracker(1);
      eps_hi_fixed = p.eps_high > 0 ? p.eps_high : 0;
      switch_!: Switch;
      emit: (type: string, data?: Record<string, unknown>) => void = () => {};
      A() {
        return this.sign.get_value() > 0.5 ? 1 : -1;
      }
      hi() {
        return this.eps_hi_fixed > 0 ? this.eps_hi_fixed : this.eps.get_value();
      }
      lo() {
        return this.eps.get_value();
      }
      /** d f/dρ at the current point: A when the unclipped term is taken, 0 when clipped. */
      slope() {
        return clip_slope(this.rho.get_value(), this.A(), this.lo(), this.hi());
      }
      /** Is the clipped term the one the min takes (outside the band, on the "far enough" side)? */
      clipped() {
        return this.slope() === 0;
      }
      override construct() {
        const c = palette();
        const { rho, eps, sign } = this;
        rho.name = 'rho';
        eps.name = 'eps';
        sign.name = 'sign';
        this.track(rho, eps, sign);
        const f_at = (r: number) => clip_objective(r, this.A(), this.lo(), this.hi());

        // ---- formula, the active term lit
        const formula = texs([['L^{CLIP} = \\min\\big(', undefined], ['\\rho A', c.accent], [',\\;', undefined], ['\\mathrm{clip}(\\rho,\\, 1-\\varepsilon,\\, 1+\\varepsilon)\\,A', c.muted], ['\\big)', undefined]], 32);
        formula.move_to([(PLOT.x0 + PLOT.x1) / 2, 3.5, 0]);
        formula.name = 'formula';
        formula.add_updater((m: any) => {
          const k = this.clipped() ? 1 : 0;
          if (m._k === k) return;
          m._k = k;
          m.submobjects[1].set_color(k ? c.muted : c.accent);
          m.submobjects[3].set_color(k ? c.accent : c.muted);
        });
        // ---- the plot
        const axis = seg([PLOT.x0, Y(0)], [PLOT.x1 + 0.15, Y(0)], c.muted, 2);
        const vaxis = seg([PLOT.x0, PLOT.y0], [PLOT.x0, PLOT.y1], c.muted, 2);
        const one = DashedLine([X(1), PLOT.y0, 0], [X(1), PLOT.y1, 0], { color: c.muted, stroke_width: 2, dash_length: 0.1 });
        const ticks = x_ticks([0.5, 1.5, 2], X, Y(0) - 0.3, (v) => `${v}`);
        const one_lab = tex('1', 24, c.muted).move_to([X(1) + 0.15, Y(0) - 0.3, 0]);
        const yt = y_ticks([-2, -1, 1, 2], Y, PLOT.x0 - 0.15);
        const xl = tex('\\rho = \\pi_\\theta / \\pi_{old}', 30, c.ink);
        xl.move_to([PLOT.x1 - xl.width / 2 + 0.1, Y(0) - 0.72, 0]);
        const band = always_redraw(() => rect(X(1 - this.lo()), PLOT.y0, X(Math.min(R1, 1 + this.hi())), PLOT.y1, c.accent, 0.08));
        band.name = 'band';
        const band_labels = always_redraw(() => VGroup(
          tex('1-\\varepsilon', 26, c.accent).move_to([X(1 - this.lo()), PLOT.y1 + 0.3, 0]),
          tex(this.eps_hi_fixed > 0 ? '1+\\varepsilon_{high}' : '1+\\varepsilon', 26, c.accent).move_to([X(Math.min(R1, 1 + this.hi())) + (this.eps_hi_fixed > 0 ? 0.25 : 0.1), PLOT.y1 + 0.3, 0]),
        ));
        const unclipped = always_redraw(() => DashedLine([X(R0), Y(R0 * this.A()), 0], [X(R1), Y(R1 * this.A()), 0], { color: c.muted, stroke_width: 3, dash_length: 0.14 }));
        unclipped.name = 'unclipped';
        const objective = always_redraw(() => {
          const pts: number[][] = [];
          for (let k = 0; k <= 170; k++) {
            const r = R0 + ((R1 - R0) * k) / 170;
            pts.push([X(r), Y(f_at(r))]);
          }
          return polyline(pts, c.accent, 6);
        });
        objective.name = 'objective';
        const point = always_redraw(() => {
          const r = rho.get_value(), at = [X(r), Y(f_at(r)), 0];
          const g = VGroup(Dot(at, { radius: 0.13, color: c.gold }));
          if (this.clipped()) g.add(Circle({ radius: 0.24, color: c.muted, stroke_width: 3 }).move_to(at));
          return g;
        });
        point.name = 'rho_point';
        const grad_arrow = always_redraw(() => {
          const r = rho.get_value(), y = Y(f_at(r)) + (this.A() > 0 ? 0.42 : -0.42);
          const s = this.slope();
          if (s === 0) return VGroup();
          const dir = s > 0 ? 1 : -1; // gradient ascent on ρ
          return VGroup(arrow([X(r), y, 0], [X(r) + dir * 0.85, y, 0], dir > 0 ? c.good : c.coral, 6, 0.22));
        });
        grad_arrow.name = 'grad_arrow';

        // ---- right panel
        const PX = 2.4;
        const rho_ro = readout('\\rho =', () => rho.get_value(), { decimals: 2, font_size: 32 });
        rho_ro.move_to([PX + rho_ro.width / 2, 2.5, 0]);
        const a_ro = always_redraw(() => {
          const t = tex(this.A() > 0 ? 'A = +1' : 'A = -1', 32, this.A() > 0 ? c.good : c.coral);
          t.move_to([PX + 2.6 + t.width / 2, 2.5, 0]);
          return t;
        });
        const eps_ro = readout(this.eps_hi_fixed > 0 ? '\\varepsilon =' : '\\varepsilon =', () => eps.get_value(), { decimals: 2, font_size: 32 });
        eps_ro.move_to([PX + eps_ro.width / 2, 1.75, 0]);
        const readouts = VGroup(rho_ro, a_ro, eps_ro);
        if (this.eps_hi_fixed > 0) {
          const hi_ro = tex(`\\varepsilon_{high} = ${this.eps_hi_fixed.toFixed(2)}`, 32, c.ink);
          hi_ro.move_to([PX + 2.6 + hi_ro.width / 2, 1.75, 0]);
          readouts.add(hi_ro);
        }
        readouts.name = 'readouts';
        this.switch_ = new Switch(sign, PX + 0.2, 0.9, [pick(lang, 'bad token: A < 0', '坏 token：A < 0'), pick(lang, 'good token: A > 0', '好 token：A > 0')], { size: 26, on_color: c.good, off_color: c.coral });
        this.switch_.group.name = 'sign_switch';
        const status = switch_text([
          label(pick(lang, 'probability goes up', '它的概率被推高'), 26, c.good),
          label(pick(lang, 'probability goes down', '它的概率被压低'), 26, c.coral),
          label(pick(lang, 'gradient 0: left alone', '梯度为 0：不再动它'), 26, c.muted),
        ], () => {
          const s = this.slope();
          return s > 0 ? 0 : s < 0 ? 1 : 2;
        }, PX, 0.0);
        status.name = 'status';
        const why = switch_text([
          label(pick(lang, 'the min takes ρA', 'min 取的是 ρA'), 24, c.muted),
          label(pick(lang, 'the min takes the clipped term', 'min 取的是截断项'), 24, c.muted),
        ], () => (this.clipped() ? 1 : 0), PX, -0.6);
        const d_cap = tex('\\partial L^{CLIP} / \\partial \\rho =', 30, c.ink);
        d_cap.move_to([PX + d_cap.width / 2, -1.5, 0]);
        const d_num = live_number(() => this.slope(), { decimals: 0, size: 32 });
        d_num.add_updater((m: any) => {
          m.move_to([d_cap.get_right()[0] + 0.15 + m.width / 2, -1.5, 0]);
          const s = this.slope(), col = s > 0 ? c.good : s < 0 ? c.coral : c.muted;
          if (m._c2 !== col) {
            m.set_color(col);
            m._c2 = col;
          }
        });
        const deriv = VGroup(d_cap, d_num);
        deriv.name = 'derivative';
        const exact = aside(this, label(pick(lang, 'one token, exact', '一个 token，精确计算'), 22, c.muted));
        exact.move_to([6.9 - exact.width / 2, -3.55, 0]);

        // ---- story
        rho.set_value(0.6);
        sign.set_value(1);
        this.play(Create(axis), Create(vaxis), FadeIn(one), FadeIn(ticks), FadeIn(one_lab), FadeIn(yt), FadeIn(xl), FadeIn(formula), FadeIn(exact), { run_time: 1.2 });
        this.play(FadeIn(band), FadeIn(band_labels), Create(unclipped), { run_time: 1 });
        this.play(Create(objective), { run_time: 1.5 });
        this.play(FadeIn(point), FadeIn(grad_arrow), FadeIn(readouts), FadeIn(status), FadeIn(why), FadeIn(deriv), FadeIn(this.switch_.group), { run_time: 1 });
        if (p.story === 'setup') {
          rho.set_value(1);
          this.add(objective, unclipped, band, band_labels, point, grad_arrow, status, deriv, readouts, this.switch_.group);
          this.wait(0.5);
          return;
        }
        this.wait(1);
        // a good token: pushed up until 1 + ε, then left alone
        this.next_section(); // (a section per beat, §, of the narration: the picture waits there for the voice)
        this.play(rho.animate.set_value(1.7), { run_time: 4, rate_func: linear });
        this.play(Indicate(formula.submobjects[3], { color: c.accent }), { run_time: 1 });
        // a bad token: pushed down until 1 - ε, then left alone
        this.play(sign.animate.set_value(0), { run_time: 0.6 });
        this.wait(0.6);
        this.play(rho.animate.set_value(0.45), { run_time: 4, rate_func: linear });
        this.wait(0.8);
        this.play(sign.animate.set_value(p.adv_sign === '+' ? 1 : 0), rho.animate.set_value(p.rho), { run_time: 1.4, rate_func: smooth });
        this.add(objective, unclipped, band, band_labels, point, grad_arrow, status, deriv, readouts, this.switch_.group);
        this.wait(1.5);
      }
    }
    return new PpoClip();
  },
  explore: (scene: any, ui, p) => {
    const lang = resolve_lang(p.lang);
    ui.add_handle({
      tracker: scene.rho,
      from_value: (v: number) => [X(v), Y(clip_objective(v, scene.A(), scene.lo(), scene.hi())), 0],
      to_value: (pt: P3) => clamp(Math.round(RHO(pt[0]) * 100) / 100, R0, R1),
      constraint: (pt: P3) => [clamp(pt[0], PLOT.x0, PLOT.x1), pt[1], 0],
      step: 0.02,
      radius: 0.45,
      label: pick(lang, 'the ratio ρ of this token', '这个 token 的概率比 ρ'),
      on_end: () => scene.emit('released', { rho: scene.rho.get_value(), A: scene.A(), slope: scene.slope(), lo: scene.lo(), hi: scene.hi() }),
    });
    scene.switch_.attach(ui, pick(lang, 'the good / bad token switch', '好 token / 坏 token 开关'), () => scene.emit('sign', { A: scene.A() }));
  },
});
