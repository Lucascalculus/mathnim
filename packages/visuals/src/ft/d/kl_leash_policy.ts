// The KL-regularised optimum π*(y) = π_ref(y) e^{r(y)/β} / Z on eight
// candidate responses (D2b). β is the leash: large β keeps the policy at the
// reference, small β piles the probability onto the highest proxy reward -
// here an exploit (flattery and padding) that the reward model loves and a
// careful reader does not. Readouts: KL(π*‖π_ref), expected proxy reward and
// (once revealed) expected gold quality; the trace keeps every visited β.
// Turning off "the reference model can say the exploit" (π_ref = 0) shows the
// wall: no β can put probability where the reference puts none. The policy is
// the exact closed form; the eight responses' numbers are made up.
import { Create, Dot, FadeIn, Indicate, Scene, VGroup, ValueTracker, always_redraw, smooth } from 'manim-web';
import { palette } from '../../theme';
import { define_visual } from '../../visual';
import { tex } from '../../linalg/kit';
import { LEASH, expect, kl, tilt } from './math';
import { HSlider, LANG_SPEC, Switch, clamp, label, label_at, live_number, pick, polyline, rect, resolve_lang, seg, x_ticks, y_ticks, type Lang, type P3 } from './kit';

export interface KlLeashParams extends Record<string, unknown> {
  story: string;
  beta: number;
  lang: string;
}

const N = LEASH.length;
const ROW0 = 2.45, ROW_DY = 0.74;
const Ry = (i: number) => ROW0 - i * ROW_DY;
const RX = -4.25, GX = -3.45;
const BX0 = -2.9, BX1 = 0.3;
const Bx = (p: number) => BX0 + p * (BX1 - BX0);
// trace plot: x = √KL, y = expected score
const TX0 = 1.35, TX1 = 6.55, TY0 = -3.25, TY1 = -0.35;
const K_MAX = 2.7, S_LO = -1.6, S_HI = 3.1;
const Tx = (k: number) => TX0 + (Math.min(k, K_MAX) / K_MAX) * (TX1 - TX0);
const Ty = (s: number) => TY0 + ((clamp(s, S_LO, S_HI) - S_LO) / (S_HI - S_LO)) * (TY1 - TY0);
export const LEASH_LB = [-2, 1] as const;

/** The policy, KL and expectations for a β and the exploit's reference probability. */
export function leash_state(beta: number, exploit_ref = LEASH[N - 1].ref) {
  const ref = LEASH.map((x) => x.ref);
  // the exploit's reference mass goes to (or comes from) the refusal, so it still sums to 1
  ref[N - 2] += ref[N - 1] - exploit_ref;
  ref[N - 1] = exploit_ref;
  const r = LEASH.map((x) => x.r), g = LEASH.map((x) => x.g);
  const pi = tilt(ref, r, beta);
  return { ref, pi, kl: kl(pi, ref), er: expect(pi, r), eg: expect(pi, g) };
}

export const kl_leash_policy = define_visual<KlLeashParams>({
  name: 'kl_leash_policy',
  summary: 'The KL-regularised optimum π* ∝ π_ref·e^{r/β} on eight responses (made-up numbers, exact closed form): lowering β (loosening the leash) raises the expected proxy reward monotonically, while the expected gold quality rises then falls as the policy piles onto an exploit the reward model over-rates; the trace keeps every visited β; with π_ref(exploit) = 0 no β can reach it. Drag β, reveal gold, switch the exploit off.',
  topics: ['rlhf', 'kl divergence', 'kl penalty', 'reward hacking', 'over-optimization', 'beta', 'dpo', 'preference', 'fine-tuning'],
  params: {
    story: { type: 'enum', values: ['full', 'setup'], default: 'full', doc: "'full' sweeps β, reveals the gold quality and the wall; 'setup' builds the picture at β = 10 with gold hidden (for a world)" },
    beta: { type: 'number', min: 0.01, max: 10, default: 1, doc: 'β where the full story ends (0.62 gives the best gold quality, below 0.29 the exploit takes over)' },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { beta: 0.1, lang: 'zh' }, { story: 'setup' }],
  ids: ['formula', 'rows', 'policy_bars', 'ref_bars', 'readouts', 'beta_slider', 'trace', 'exploit_switch', 'toy_label'],
  scene: (p) => {
    const lang: Lang = resolve_lang(p.lang);
    class KlLeash extends Scene {
      /** log10 β. */
      lb = ValueTracker(1);
      /** 1 = the gold quality is shown. */
      gold = ValueTracker(0);
      /** 1 = the reference model can say the exploit (π_ref = 0.001), 0 = it cannot. */
      can = ValueTracker(1);
      visited = new Map<number, { k: number; er: number; eg: number }>();
      slider!: HSlider;
      switch_!: Switch;
      emit: (type: string, data?: Record<string, unknown>) => void = () => {};
      beta() {
        return 10 ** this.lb.get_value();
      }
      state() {
        return leash_state(this.beta(), this.can.get_value() > 0.5 ? LEASH[N - 1].ref : 0);
      }
      /** A tracker-like view of β itself (for a scrubbable number in a prompt). */
      beta_view() {
        return { get_value: () => this.beta(), set_value: (v: number) => this.lb.set_value(clamp(Math.log10(Math.max(1e-6, v)), LEASH_LB[0], LEASH_LB[1])) };
      }
      override construct() {
        const c = palette();
        const { lb, gold, can } = this;
        lb.name = 'log10_beta';
        gold.name = 'gold_shown';
        can.name = 'exploit_possible';
        this.track(lb, gold, can);
        this.add_updater(() => {
          const s = this.state();
          this.visited.set(Math.round(lb.get_value() * 50) / 50 + (can.get_value() > 0.5 ? 0 : 100), { k: Math.sqrt(Math.max(0, s.kl)), er: s.er, eg: s.eg });
        });

        // ---- left: the eight responses
        const hx = label_at(pick(lang, 'response', '回答'), -6.9, 3.2, 22, c.muted);
        const hr = tex('r', 28, c.accent).move_to([RX, 3.2, 0]);
        const hg = tex('g', 28, c.good).move_to([GX, 3.2, 0]);
        const hb = always_redraw(() => {
          const t = label(pick(lang, 'probability: π* solid, π_ref outline', '概率：实心 π*，空心 π_ref'), 22, c.muted);
          t.move_to([BX0 + t.width / 2, 3.2, 0]);
          return t;
        });
        const rows = VGroup(...LEASH.map((x, i) => {
          const name = label(pick(lang, x.en, x.zh), 22, i === N - 1 ? c.coral : c.ink);
          name.move_to([-6.9 + name.width / 2, Ry(i), 0]);
          const r = tex(x.r.toFixed(1), 26, c.accent).move_to([RX, Ry(i), 0]);
          const g = tex(x.g.toFixed(1), 26, c.good).move_to([GX, Ry(i), 0]);
          g.add_updater((m: any) => {
            const k = gold.get_value() > 0.5 ? 1 : 0;
            if (m._k === k) return;
            m._k = k;
            m.set_opacity(k);
          });
          const q = tex('?', 26, c.muted).move_to([GX, Ry(i), 0]);
          q.add_updater((m: any) => {
            const k = gold.get_value() > 0.5 ? 0 : 1;
            if (m._k === k) return;
            m._k = k;
            m.set_opacity(k);
          });
          return VGroup(name, r, g, q);
        }));
        rows.name = 'rows';
        const scale = VGroup(seg([Bx(0), ROW0 + 0.42], [Bx(1), ROW0 + 0.42], c.faint, 2), tex('0', 22, c.muted).move_to([Bx(0), ROW0 + 0.62, 0]), tex('1', 22, c.muted).move_to([Bx(1), ROW0 + 0.62, 0]));
        const ref_bars = always_redraw(() => {
          const s = this.state();
          return VGroup(...s.ref.map((q, i) => rect(Bx(0), Ry(i) - 0.22, Bx(q), Ry(i) + 0.22, c.bg, 0, c.muted, 2)));
        });
        ref_bars.name = 'ref_bars';
        const policy_bars = always_redraw(() => {
          const s = this.state();
          return VGroup(...s.pi.map((q, i) => rect(Bx(0), Ry(i) - 0.16, Bx(q), Ry(i) + 0.16, i === N - 1 ? c.coral : c.accent, 0.85)));
        });
        policy_bars.name = 'policy_bars';
        const pct = always_redraw(() => {
          const s = this.state();
          const i = s.pi.indexOf(Math.max(...s.pi));
          const t = tex(`${(100 * s.pi[i]).toFixed(0)}\\%`, 24, i === N - 1 ? c.coral : c.accent);
          const x = Bx(s.pi[i]) + 0.12 + t.width / 2;
          t.move_to([Math.min(x, 0.95 - t.width / 2 + t.width), Ry(i), 0]);
          return t;
        });

        // ---- right: formula, readouts, β slider, trace
        const formula = tex('\\pi^*(y) \\propto \\pi_{ref}(y)\\, e^{\\,r(y)/\\beta}', 34, c.ink).move_to([4.0, 3.4, 0]);
        formula.name = 'formula';
        const RX0 = 1.2;
        const b_ro = VGroup(tex('\\beta =', 32, c.ink));
        b_ro.submobjects[0].move_to([RX0 + 0.35, 2.65, 0]);
        const b_num = live_number(() => this.beta(), { decimals: 2, size: 32, color: c.gold });
        b_num.add_updater((m: any) => m.move_to([RX0 + 0.85 + m.width / 2, 2.65, 0]));
        b_ro.add(b_num);
        this.slider = new HSlider(lb, LEASH_LB[0], LEASH_LB[1], RX0 + 2.35, 6.55, 2.65, { color: c.gold });
        this.slider.group.name = 'beta_slider';
        const loose = label(pick(lang, 'loose', '松'), 20, c.muted).move_to([RX0 + 2.35, 2.25, 0]);
        const tight = label(pick(lang, 'tight', '紧'), 20, c.muted).move_to([6.55, 2.25, 0]);
        const kl_ro = VGroup(tex('\\mathrm{KL}(\\pi^*\\Vert\\pi_{ref}) =', 30, c.ink));
        kl_ro.submobjects[0].move_to([RX0 + kl_ro.submobjects[0].width / 2, 1.75, 0]);
        const kl_num = live_number(() => this.state().kl, { decimals: 2, size: 30 });
        kl_num.add_updater((m: any) => m.move_to([kl_ro.submobjects[0].get_right()[0] + 0.15 + m.width / 2, 1.75, 0]));
        kl_ro.add(kl_num);
        const er_ro = VGroup(tex('\\mathbb{E}_{\\pi^*}[r] =', 30, c.accent));
        er_ro.submobjects[0].move_to([RX0 + er_ro.submobjects[0].width / 2, 1.05, 0]);
        const er_num = live_number(() => this.state().er, { decimals: 2, size: 30, color: c.accent });
        er_num.add_updater((m: any) => m.move_to([er_ro.submobjects[0].get_right()[0] + 0.15 + m.width / 2, 1.05, 0]));
        er_ro.add(er_num);
        const eg_cap = tex('\\mathbb{E}_{\\pi^*}[g] =', 30, c.good);
        eg_cap.move_to([4.05 + eg_cap.width / 2, 1.05, 0]);
        const eg_num = live_number(() => this.state().eg, { decimals: 2, size: 30, color: c.good });
        eg_num.add_updater((m: any) => {
          m.move_to([eg_cap.get_right()[0] + 0.15 + m.width / 2, 1.05, 0]);
          const k = gold.get_value() > 0.5 ? 1 : 0;
          if (m._k !== k) {
            m._k = k;
            m.set_opacity(k);
          }
        });
        const eg_q = tex('?', 30, c.muted);
        eg_q.add_updater((m: any) => {
          m.move_to([eg_cap.get_right()[0] + 0.25, 1.05, 0]);
          const k = gold.get_value() > 0.5 ? 0 : 1;
          if (m._k !== k) {
            m._k = k;
            m.set_opacity(k);
          }
        });
        const readouts = VGroup(b_ro, kl_ro, er_ro, eg_cap, eg_num, eg_q);
        readouts.name = 'readouts';
        this.switch_ = new Switch(can, RX0 + 0.1, 0.35, [pick(lang, 'the reference never says the exploit', '参考模型从不说漏洞回答'), pick(lang, 'the reference can say the exploit', '参考模型会说漏洞回答')], { size: 22, on_color: c.coral });
        this.switch_.group.name = 'exploit_switch';
        // trace
        const taxes = VGroup(seg([TX0, Ty(0)], [TX1, Ty(0)], c.muted, 2), seg([TX0, TY0], [TX0, TY1], c.muted, 2));
        const tx = tex('\\sqrt{\\mathrm{KL}}', 26, c.ink).move_to([TX1 - 0.1, TY0 - 0.3, 0]);
        const tt = x_ticks([1, 2], Tx, Ty(0) - 0.25);
        const ty = y_ticks([-1, 1, 2, 3], Ty, TX0 - 0.12);
        const trace = always_redraw(() => {
          const g = VGroup();
          const pts = [...this.visited.entries()].filter(([key]) => (key >= 50) === (can.get_value() <= 0.5)).map(([, v]) => v).sort((a, b) => a.k - b.k);
          for (const v of pts) {
            g.add(Dot([Tx(v.k), Ty(v.er), 0], { radius: 0.045, color: c.accent }));
            if (gold.get_value() > 0.5) g.add(Dot([Tx(v.k), Ty(v.eg), 0], { radius: 0.045, color: c.good }));
          }
          const s = this.state(), k = Math.sqrt(Math.max(0, s.kl));
          g.add(Dot([Tx(k), Ty(s.er), 0], { radius: 0.1, color: c.accent }));
          if (gold.get_value() > 0.5) g.add(Dot([Tx(k), Ty(s.eg), 0], { radius: 0.1, color: c.good }));
          return g;
        });
        trace.name = 'trace';
        const legend = always_redraw(() => {
          const a = label(pick(lang, 'proxy E[r]', '代理 E[r]'), 20, c.accent);
          a.move_to([TX0 + 0.15 + a.width / 2, TY1 + 0.25, 0]);
          const g = VGroup(a);
          if (gold.get_value() > 0.5) {
            const b = label(pick(lang, 'gold E[g]', '真实 E[g]'), 20, c.good);
            b.move_to([a.get_right()[0] + 0.35 + b.width / 2, TY1 + 0.25, 0]);
            g.add(b);
          }
          return g;
        });
        const toy = label(pick(lang, 'made-up numbers; π* exact', '示意数值；π* 是精确解'), 20, c.muted);
        toy.move_to([6.9 - toy.width / 2, -3.7, 0]);
        toy.name = 'toy_label';

        // ---- story
        lb.set_value(1);
        gold.set_value(0);
        can.set_value(1);
        this.play(FadeIn(hx), FadeIn(hr), FadeIn(hg), FadeIn(hb), FadeIn(rows), FadeIn(scale), FadeIn(toy), { run_time: 1.2 });
        this.play(FadeIn(ref_bars), FadeIn(policy_bars), FadeIn(pct), FadeIn(formula), { run_time: 1 });
        this.play(FadeIn(readouts), FadeIn(this.slider.group), FadeIn(loose), FadeIn(tight), FadeIn(this.switch_.group), Create(taxes), FadeIn(tx), FadeIn(tt), FadeIn(ty), FadeIn(legend), { run_time: 1 });
        this.add(trace);
        if (p.story === 'full') {
          this.wait(0.6);
          this.play(lb.animate.set_value(Math.log10(0.62)), { run_time: 3, rate_func: smooth });
          this.play(lb.animate.set_value(-1.3), { run_time: 3, rate_func: smooth });
          this.wait(0.6);
          this.play(gold.animate.set_value(1), { run_time: 0.5 });
          this.play(Indicate(rows.submobjects[N - 1], { color: c.coral }), { run_time: 1 });
          this.wait(0.8);
          this.play(can.animate.set_value(0), { run_time: 0.5 });
          this.wait(1.2);
          this.play(can.animate.set_value(1), lb.animate.set_value(Math.log10(p.beta)), { run_time: 2.5, rate_func: smooth });
          this.wait(1.5);
        } else {
          this.wait(0.5);
        }
      }
    }
    return new KlLeash();
  },
  explore: (scene: any, ui) => {
    scene.slider.attach(ui, 'β, the leash: left loose, right tight', { snap: 0.01 });
    scene.switch_.attach(ui, 'can the reference model say the exploit?', () => scene.emit('wall', { can: scene.can.get_value() > 0.5 }));
  },
});
