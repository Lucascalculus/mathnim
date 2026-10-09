// DPO only looks at the gap (D3). Left: the plane of Δ_w (how much the chosen
// response's log-probability moved from the reference) and Δ_l (the same
// for the rejected one); the DPO loss −log σ(β(Δ_w − Δ_l)) is constant along
// lines parallel to the diagonal, so "both down, the rejected more" also
// lowers the loss. Right: a toy policy π_θ(y) ∝ π_ref(y) e^{θ·φ(y)} over five
// responses drawn in a 2D feature plane; DPO on one pair (polite refusal over
// curt refusal) moves θ along d = φ_w − φ_l only, so probability flows to
// whatever response lies furthest along d - here one that complies with a
// request it should refuse, never seen in the data (likelihood displacement).
// Dragging the rejected response changes d; an NLL term on the chosen
// response changes the direction. Exact gradient descent on made-up numbers.
import { Create, Dot, FadeIn, Scene, VGroup, ValueTracker, always_redraw, linear, smooth } from 'manim-web';
import { palette } from '../../theme';
import { define_visual } from '../../visual';
import { arrow, dashed, tex } from '../../linalg/kit';
import { DPO_TOY, dpo_run, log_sigmoid, toy_ches, type DpoState } from './math';
import { LANG_SPEC, Switch, clamp, label, label_at, live_number, mixed, pick, polyline, rect, resolve_lang, seg, type Lang, type P3 } from './kit';

export interface DpoGapParams extends Record<string, unknown> {
  story: string;
  nll: boolean;
  nll_switch: boolean;
  lang: string;
}

export const DPO_STEPS_MAX = 400;
// left: the gap plane
const G = { x0: -6.2, x1: -1.15, y0: -3.3, y1: 2.3 }, D_LO = -7, D_HI = 2;
const Gx = (d: number) => G.x0 + ((clamp(d, D_LO, D_HI) - D_LO) / (D_HI - D_LO)) * (G.x1 - G.x0);
const Gy = (d: number) => G.y0 + ((clamp(d, D_LO, D_HI) - D_LO) / (D_HI - D_LO)) * (G.y1 - G.y0);
const GxInv = (x: number) => D_LO + ((x - G.x0) / (G.x1 - G.x0)) * (D_HI - D_LO);
const GyInv = (y: number) => D_LO + ((y - G.y0) / (G.y1 - G.y0)) * (D_HI - D_LO);
// right top: the feature plane
const F = { x0: 0.5, x1: 4.75, y0: 0.95, y1: 3.2 }, F1 = [-1.4, 1.4], F2 = [-0.3, 1.7];
const Fx = (a: number) => F.x0 + ((a - F1[0]) / (F1[1] - F1[0])) * (F.x1 - F.x0);
const Fy = (b: number) => F.y0 + ((b - F2[0]) / (F2[1] - F2[0])) * (F.y1 - F.y0);
const FxInv = (x: number) => F1[0] + ((x - F.x0) / (F.x1 - F.x0)) * (F1[1] - F1[0]);
const FyInv = (y: number) => F2[0] + ((y - F.y0) / (F.y1 - F.y0)) * (F2[1] - F2[0]);
// right bottom: probability bars
const ROWS = [-0.2, -0.8, -1.4, -2.0, -2.6];
const PB0 = 3.3, PB1 = 6.4;
const Pb = (p: number) => PB0 + p * (PB1 - PB0);
const SHORT = [
  { en: 'polite refusal', zh: '礼貌拒答' },
  { en: 'curt refusal', zh: '生硬拒答' },
  { en: 'complied anyway', zh: '照做（本应拒绝）' },
  { en: 'off topic', zh: '跑题' },
  { en: 'plain refusal', zh: '普通拒答' },
];
const TAGS = ['y_w', 'y_l', 'y_3', 'y_4', 'y_5'];

export const dpo_gap_plane = define_visual<DpoGapParams>({
  name: 'dpo_gap_plane',
  summary: "DPO only sees the gap: the loss −log σ(β(Δ_w − Δ_l)) is constant along diagonals of the (Δ_w, Δ_l) plane, so both log-probabilities can fall while the loss falls. A toy log-linear policy over five responses (feature plane) trained by DPO on one pair moves along d = φ_w − φ_l: with a similar pair, probability flows to an unseen response that complies with a request it should refuse (likelihood displacement); a dissimilar pair or an NLL term on the chosen response avoids it. Drag the gap point, drag the rejected response, train.",
  topics: ['dpo', 'likelihood displacement', 'preference', 'implicit reward', 'ches', 'rlhf', 'fine-tuning'],
  params: {
    story: { type: 'enum', values: ['full', 'setup'], default: 'full', doc: "'full' shows the gap lines, trains the similar pair (displacement), then a dissimilar one; 'setup' builds the picture untrained (for a world)" },
    nll: { type: 'boolean', default: false, doc: 'add an NLL term α·(−log π(y_w)), α = 0.5, to the loss (DPO + NLL, as in Llama 3 / RPO)' },
    nll_switch: { type: 'boolean', default: true, doc: 'show the + NLL switch (a world about the pair geometry hides it)' },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { nll: true, lang: 'zh' }, { story: 'setup', nll_switch: false }],
  ids: ['formula', 'gap_plane', 'contours', 'point', 'trajectory', 'feature_plane', 'direction', 'prob_bars', 'readouts', 'toy_label'],
  scene: (p) => {
    const lang: Lang = resolve_lang(p.lang);
    class DpoGap extends Scene {
      /** Free point (phase 1): Δ_w, Δ_l chosen by hand. */
      dw = ValueTracker(0);
      dl = ValueTracker(0);
      /** 0: the point is free; 1: the point is the toy model's training state. */
      mode = ValueTracker(0);
      steps = ValueTracker(0);
      /** Features of the rejected response (draggable). */
      lx = ValueTracker(DPO_TOY[1].phi[0]);
      ly = ValueTracker(DPO_TOY[1].phi[1]);
      nll = ValueTracker(p.nll ? 1 : 0);
      nll_switch!: Switch;
      private cache: { key: string; states: DpoState[] } | null = null;
      emit: (type: string, data?: Record<string, unknown>) => void = () => {};
      run(): DpoState[] {
        const key = `${this.lx.get_value().toFixed(3)},${this.ly.get_value().toFixed(3)},${this.nll.get_value() > 0.5 ? 1 : 0}`;
        if (this.cache?.key !== key) this.cache = { key, states: dpo_run({ phi_l: [this.lx.get_value(), this.ly.get_value()], steps: DPO_STEPS_MAX, nll_alpha: this.nll.get_value() > 0.5 ? 0.5 : 0 }).states };
        return this.cache.states;
      }
      /** The state the picture shows now. */
      state(): DpoState {
        if (this.mode.get_value() < 0.5) {
          const dw = this.dw.get_value(), dl = this.dl.get_value();
          return { p: DPO_TOY.map((x) => x.ref), dw, dl, loss: -log_sigmoid(dw - dl) };
        }
        return this.run()[clamp(Math.round(this.steps.get_value()), 0, DPO_STEPS_MAX)];
      }
      ches(): number {
        return toy_ches(DPO_TOY[0].phi, [this.lx.get_value(), this.ly.get_value()]);
      }
      /** Train n more steps (the world's button). */
      train(n: number): DpoState {
        this.mode.set_value(1);
        this.steps.set_value(Math.min(DPO_STEPS_MAX, Math.round(this.steps.get_value()) + n));
        return this.state();
      }
      override construct() {
        const c = palette();
        const COL = [c.good, c.coral, c.coral, c.muted, c.teal];
        const { dw, dl, mode, steps, lx, ly, nll } = this;
        [dw, dl, mode, steps, lx, ly, nll].forEach((t, i) => (t.name = ['dw', 'dl', 'mode', 'steps', 'rejected_x', 'rejected_y', 'nll'][i]));
        this.track(dw, dl, mode, steps, lx, ly, nll);

        // ---- left: the gap plane
        const formula = tex('L = -\\log\\sigma\\big(\\beta\\,(\\Delta_w - \\Delta_l)\\big)', 32, c.ink).move_to([-3.6, 3.5, 0]);
        formula.name = 'formula';
        const shade = rect(G.x0, G.y0, Gx(0), G.y1, c.coral, 0.07);
        const shade_lab = label(pick(lang, 'chosen became less likely', '被选回答的概率下降了'), 20, c.coral);
        shade_lab.move_to([G.x0 + 0.12 + shade_lab.width / 2, G.y1 - 0.25, 0]);
        const contour_lab = label(pick(lang, 'blue lines: equal loss (its value on the right)', '蓝线：损失相等的点（右侧是损失值）'), 20, c.accent);
        contour_lab.move_to([G.x0 + contour_lab.width / 2, G.y0 - 0.33, 0]);
        const frame = VGroup(seg([G.x0, G.y0], [G.x1, G.y0], c.muted, 2), seg([G.x0, G.y0], [G.x0, G.y1], c.muted, 2));
        const axis0 = VGroup(dashed([Gx(0), G.y0], [Gx(0), G.y1], c.muted, 2, 0.1), dashed([G.x0, Gy(0)], [G.x1, Gy(0)], c.muted, 2, 0.1));
        const xl = tex('\\Delta_w', 30, c.good).move_to([G.x1 + 0.3, G.y0 - 0.05, 0]);
        const yl = tex('\\Delta_l', 30, c.coral).move_to([G.x0 - 0.35, G.y1 - 0.1, 0]);
        // loss contours Δ_w − Δ_l = k, labelled with the loss there (β = 1)
        const contours = VGroup(...[0, 1, 2, 4].map((k) => {
          const pts: number[][] = [];
          for (let t = D_LO; t <= D_HI + 1e-9; t += 0.25) {
            const a = t, b = t - k;
            if (b >= D_LO - 1e-9 && b <= D_HI + 1e-9) pts.push([Gx(a), Gy(b)]);
          }
          const line = polyline(pts, c.accent, 2, 0.45);
          // labelled where it leaves the box on the right (Δ_w = D_HI, Δ_l = D_HI − k)
          const lab = tex((-log_sigmoid(k)).toFixed(2), 22, c.accent).move_to([G.x1 + 0.32, Gy(D_HI - k), 0]);
          return VGroup(line, lab);
        }));
        contours.name = 'contours';
        const gap_plane = VGroup(shade, shade_lab, contour_lab, frame, axis0, xl, yl);
        gap_plane.name = 'gap_plane';
        const trajectory = always_redraw(() => {
          if (mode.get_value() < 0.5) return VGroup();
          const st = this.run(), n = clamp(Math.round(steps.get_value()), 0, DPO_STEPS_MAX);
          const pts: number[][] = [];
          for (let k = 0; k <= n; k += Math.max(1, Math.floor(n / 80))) pts.push([Gx(st[k].dw), Gy(st[k].dl)]);
          pts.push([Gx(st[n].dw), Gy(st[n].dl)]);
          return polyline(pts, c.gold, 3, 0.8);
        });
        trajectory.name = 'trajectory';
        const point = always_redraw(() => {
          const s = this.state();
          return Dot([Gx(s.dw), Gy(s.dl), 0], { radius: 0.13, color: c.gold });
        });
        point.name = 'point';
        const ro_l = VGroup(tex('L =', 28, c.ink));
        ro_l.submobjects[0].move_to([-6.6, 2.95, 0]);
        const lnum = live_number(() => this.state().loss, { decimals: 2, size: 28 });
        lnum.add_updater((m: any) => m.move_to([-6.25 + m.width / 2, 2.95, 0]));
        const wnum_cap = tex('\\Delta_w =', 28, c.good).move_to([-4.75, 2.95, 0]);
        const wnum = live_number(() => this.state().dw, { decimals: 2, size: 28, color: c.good });
        wnum.add_updater((m: any) => m.move_to([wnum_cap.get_right()[0] + 0.12 + m.width / 2, 2.95, 0]));
        const lnum_cap = tex('\\Delta_l =', 28, c.coral).move_to([-2.6, 2.95, 0]);
        const lnum2 = live_number(() => this.state().dl, { decimals: 2, size: 28, color: c.coral });
        lnum2.add_updater((m: any) => m.move_to([lnum_cap.get_right()[0] + 0.12 + m.width / 2, 2.95, 0]));
        const readouts = VGroup(ro_l, lnum, wnum_cap, wnum, lnum_cap, lnum2);
        readouts.name = 'readouts';

        // ---- right top: the toy policy's feature plane
        const fcap = label(pick(lang, 'toy policy: → refuses more, ↑ more accommodating', '玩具策略：→ 越拒绝，↑ 越顺从'), 20, c.muted);
        fcap.move_to([F.x0 + fcap.width / 2 - 0.1, 3.6, 0]);
        const dcap = mixed([pick(lang, 'gold arrow', '金色箭头'), { tex: 'd = \\varphi_w - \\varphi_l' }, pick(lang, ': DPO pushes only along it', '：DPO 只沿它推')], F.x0 - 0.1, 0.6, 20, c.gold);
        const faxes = VGroup(seg([Fx(F1[0]), Fy(0)], [Fx(F1[1]), Fy(0)], c.faint, 2), seg([Fx(0), Fy(F2[0])], [Fx(0), Fy(F2[1])], c.faint, 2));
        const phi = (i: number): [number, number] => (i === 1 ? [lx.get_value(), ly.get_value()] : DPO_TOY[i].phi);
        // y_w above, y_5 to the right, y_l below-right: the three refusals sit close together
        const tag_off = (i: number) => (i === 0 ? [0.0, 0.3] : i === 1 ? [0.3, -0.24] : i === 4 ? [0.33, 0] : [0.3, 0.22]);
        const dots = VGroup(...DPO_TOY.map((x, i) => {
          if (i === 1) return VGroup();
          const at: P3 = [Fx(x.phi[0]), Fy(x.phi[1]), 0];
          const tg = tex(TAGS[i], 24, COL[i]).move_to([at[0] + tag_off(i)[0], at[1] + tag_off(i)[1], 0]);
          return VGroup(Dot(at, { radius: 0.11, color: COL[i] }), tg);
        }));
        const l_dot = Dot([Fx(lx.get_value()), Fy(ly.get_value()), 0], { radius: 0.13, color: COL[1] });
        l_dot.add_updater((m: any) => m.move_to([Fx(lx.get_value()), Fy(ly.get_value()), 0]));
        const l_tag = tex(TAGS[1], 24, COL[1]);
        l_tag.add_updater((m: any) => m.move_to([Fx(lx.get_value()) + tag_off(1)[0], Fy(ly.get_value()) + tag_off(1)[1], 0]));
        dots.add(l_dot, l_tag);
        const direction = always_redraw(() => {
          const [a, b] = phi(1), [wa, wb] = DPO_TOY[0].phi;
          return VGroup(arrow([Fx(a), Fy(b), 0], [Fx(wa), Fy(wb), 0], c.gold, 4, 0.16));
        });
        direction.name = 'direction';
        const feature_plane = VGroup(faxes, dots);
        feature_plane.name = 'feature_plane';
        const ches_cap = tex('\\mathrm{CHES} =', 26, c.ink).move_to([5.2 + 0.55, 2.35, 0]);
        const ches = live_number(() => this.ches(), { decimals: 2, size: 26 });
        ches.add_updater((m: any) => m.move_to([ches_cap.get_right()[0] + 0.12 + m.width / 2, 2.35, 0]));
        const step_cap = label(pick(lang, 'steps', '步数'), 22, c.ink);
        step_cap.move_to([5.2 + step_cap.width / 2, 2.95, 0]);
        const step_num = live_number(() => (mode.get_value() > 0.5 ? steps.get_value() : 0), { decimals: 0, size: 26 });
        step_num.add_updater((m: any) => m.move_to([step_cap.get_right()[0] + 0.15 + m.width / 2, 2.95, 0]));
        this.nll_switch = new Switch(nll, 5.35, 1.65, '+NLL', { size: 22, on_color: c.good, width: 0.55 });

        // ---- right bottom: probabilities
        const pcap = mixed([pick(lang, 'probability: solid', '概率：实心'), { tex: '\\pi_\\theta' }, pick(lang, ', outline', '，空心'), { tex: '\\pi_{ref}' }], 0.45, 0.2, 20, c.muted);
        const names = VGroup(...SHORT.map((s, i) => {
          const t = tex(TAGS[i], 24, COL[i]).move_to([0.6, ROWS[i], 0]);
          const n = label(pick(lang, s.en, s.zh), 20, i === 2 ? c.coral : c.ink);
          n.move_to([0.95 + n.width / 2, ROWS[i], 0]);
          return VGroup(t, n);
        }));
        const prob_bars = always_redraw(() => {
          const s = this.state();
          return VGroup(...DPO_TOY.map((x, i) => VGroup(
            rect(Pb(0), ROWS[i] - 0.2, Pb(x.ref), ROWS[i] + 0.2, c.bg, 0, c.muted, 2),
            rect(Pb(0), ROWS[i] - 0.13, Pb(s.p[i]), ROWS[i] + 0.13, COL[i], 0.85),
          )));
        });
        prob_bars.name = 'prob_bars';
        const pw = live_number(() => this.state().p[0], { decimals: 2, size: 22, color: c.good });
        pw.add_updater((m: any) => m.move_to([Math.min(Pb(this.state().p[0]) + 0.12 + m.width / 2, 6.9 - m.width / 2), ROWS[0], 0]));
        const p3 = live_number(() => this.state().p[2], { decimals: 2, size: 22, color: c.coral });
        p3.add_updater((m: any) => m.move_to([Math.min(Pb(this.state().p[2]) + 0.12 + m.width / 2, 6.9 - m.width / 2), ROWS[2], 0]));
        const toy = label(pick(lang, 'toy model, made-up numbers; exact gradient descent', '玩具模型，示意数值；梯度下降是精确计算'), 20, c.muted);
        toy.move_to([6.9 - toy.width / 2, -3.45, 0]);
        toy.name = 'toy_label';

        // ---- story
        this.play(FadeIn(formula), FadeIn(gap_plane), FadeIn(readouts), { run_time: 1.2 });
        this.play(Create(contours), { run_time: 1.2 });
        this.add(point);
        this.play(FadeIn(fcap), FadeIn(dcap), FadeIn(feature_plane), FadeIn(direction), FadeIn(ches_cap), FadeIn(ches), FadeIn(step_cap), FadeIn(step_num), ...(p.nll_switch ? [FadeIn(this.nll_switch.group)] : []), FadeIn(pcap), FadeIn(names), FadeIn(prob_bars), FadeIn(pw), FadeIn(p3), FadeIn(toy), { run_time: 1 });
        this.add(trajectory);
        if (p.story === 'full') {
          // along a contour: both log-probabilities fall, the loss stays put
          this.play(dw.animate.set_value(-1.5), dl.animate.set_value(-2.5), { run_time: 2, rate_func: smooth });
          this.play(dw.animate.set_value(-3), dl.animate.set_value(-4), { run_time: 2, rate_func: smooth });
          this.wait(0.6);
          // real training on the similar pair
          mode.set_value(1);
          steps.set_value(0);
          this.play(steps.animate.set_value(120), { run_time: 5, rate_func: linear });
          this.wait(0.8);
          // a dissimilar rejected response: the chosen one gains
          this.play(lx.animate.set_value(0), ly.animate.set_value(0), { run_time: 1.5, rate_func: smooth });
          this.wait(1.5);
        } else {
          this.wait(0.5);
        }
      }
    }
    return new DpoGap();
  },
  explore: (scene: any, ui, p) => {
    ui.add_handle({
      get: () => {
        const s = scene.state();
        return [Gx(s.dw), Gy(s.dl), 0];
      },
      set: (pt: P3) => {
        scene.mode.set_value(0);
        scene.dw.set_value(Math.round(GxInv(pt[0]) * 20) / 20);
        scene.dl.set_value(Math.round(GyInv(pt[1]) * 20) / 20);
      },
      constraint: (pt: P3) => [clamp(pt[0], G.x0, G.x1), clamp(pt[1], G.y0, G.y1), 0],
      step: 0.1,
      radius: 0.4,
      label: 'the point (Δ_w, Δ_l): how far each log-probability moved',
      on_end: () => scene.emit('gap', { dw: scene.dw.get_value(), dl: scene.dl.get_value(), loss: scene.state().loss }),
    });
    ui.add_handle({
      get: () => [Fx(scene.lx.get_value()), Fy(scene.ly.get_value()), 0],
      set: (pt: P3) => {
        scene.lx.set_value(Math.round(FxInv(pt[0]) * 20) / 20);
        scene.ly.set_value(Math.round(FyInv(pt[1]) * 20) / 20);
        if (scene.mode.get_value() > 0.5) scene.steps.set_value(0); // a new experiment starts untrained
      },
      constraint: (pt: P3) => [clamp(pt[0], F.x0, F.x1 - 0.3), clamp(pt[1], F.y0 + 0.2, F.y1 - 0.1), 0],
      step: 0.1,
      radius: 0.4,
      label: 'the rejected response y_l in the feature plane',
      on_end: () => scene.emit('moved_rejected', { x: scene.lx.get_value(), y: scene.ly.get_value(), ches: scene.ches() }),
    });
    if (p.nll_switch) scene.nll_switch.attach(ui, 'add an NLL term on the chosen response', () => {
      if (scene.mode.get_value() > 0.5) scene.steps.set_value(0);
      scene.emit('nll', { on: scene.nll.get_value() > 0.5 });
    });
  },
});
