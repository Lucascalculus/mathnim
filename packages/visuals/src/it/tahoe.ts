// Q3 of Review (2): TCP Tahoe, slow start threshold 10 KB, a timeout when the congestion window is 16 KB
// (segments of 1 KB). The window round by round: slow start from 1 (doubling, stopped at the threshold),
// additive increase (+1 per round trip) up to the loss; then the new threshold is half the window at the
// loss and the window starts again from 1. Drag the moment of the loss along the curve: the new threshold
// is always half of it, whatever the old one was. Switch to Reno and to three duplicate ACKs: fast
// recovery restarts from the new threshold instead of from 1 (a timeout still sends Reno back to 1).
import { Circle, Create, FadeIn, Scene, UpdateFromAlphaFunc, VGroup, ValueTracker, linear } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { aside } from '../aside';
import { Choice, LANG_SPEC, Plot, clamp, emit, follow, live_label, pick, resolve_lang, words, type P3, type XY } from './kit';

export interface TahoeParams extends Record<string, unknown> {
  loss: number;
  reno: boolean;
  dupack: boolean;
  lang: string;
}

/** The threshold before the loss, as in the question. */
const S0 = 10;
/** Round trips drawn: enough for six after the latest loss the handle allows. */
const ROUNDS = 22;
/** The round at which the window reaches `loss`: slow start 1, 2, 4, 8, then 10 (the threshold), then +1. */
export const loss_round = (loss: number): number => 4 + (loss - S0);

/** The congestion window for rounds 0..ROUNDS, the round of the loss and the new threshold. */
export function tcp_rounds(loss: number, reno: boolean, dupack: boolean): { w: number[]; at: number; s: number } {
  const at = loss_round(loss), s = loss / 2;
  const w: number[] = [];
  let x = 1, thr = S0;
  for (let r = 0; r <= ROUNDS; r++) {
    if (r === at + 1) {
      thr = s;
      x = reno && dupack ? s : 1;
    } else if (r > 0) x = x < thr ? Math.min(2 * x, thr) : x + 1;
    w.push(x);
  }
  return { w, at, s };
}

export const it_tahoe = define_visual<TahoeParams>({
  name: 'it_tahoe',
  summary: 'TCP congestion window round by round (COMP90007 review Q3: Tahoe, threshold 10 KB, timeout at 16 KB): slow start, additive increase, the loss, the new threshold at half the window and the restart from 1; drag the moment of the loss, switch to Reno and to three duplicate ACKs (fast recovery from the threshold).',
  topics: ['networks', 'tcp', 'congestion control', 'slow start', 'additive increase', 'tcp tahoe', 'tcp reno', 'aimd'],
  params: {
    loss: { type: 'integer', min: 12, max: 20, default: 16, doc: 'the congestion window (KB, segments of 1 KB) when the loss happens; even values, 16 in the exam' },
    reno: { type: 'boolean', default: false, doc: 'TCP Reno instead of Tahoe' },
    dupack: { type: 'boolean', default: false, doc: 'the loss is signalled by three duplicate ACKs instead of a timeout (matters only for Reno)' },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { loss: 12 }, { loss: 20, reno: true, dupack: true }, { loss: 14, reno: true, lang: 'zh' }, { reno: true, dupack: true, lang: 'zh' }],
  ids: ['plot', 'window', 'thresholds', 'loss', 'after', 'protocol', 'signal'],
  scene: (p) => {
    const lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    const start = clamp(2 * Math.round(p.loss / 2), 12, 20);
    class Tahoe extends Scene {
      loss = new ValueTracker(start);
      reno = new ValueTracker(p.reno ? 1 : 0);
      dup = new ValueTracker(p.dupack ? 1 : 0);
      shown = new ValueTracker(0);
      plot!: Plot;
      protocol!: Choice;
      signal!: Choice;
      override construct() {
        const c = palette();
        const { loss, reno, dup, shown } = this;
        this.track(loss, reno, dup, shown);
        const run = () => tcp_rounds(loss.get_value(), reno.get_value() > 0.5, dup.get_value() > 0.5);
        const key = () => `${loss.get_value()}|${reno.get_value() > 0.5}|${dup.get_value() > 0.5}|${shown.get_value().toFixed(3)}`;
        aside(this, words(L('segments of 1 KB; doubling stops at the threshold; the threshold before the loss is 10 KB, as in the question', '每个报文段 1 KB；翻倍到阈值为止；丢包前的阈值是 10 KB，和题目一样'), 20, c.muted, -6.9, 3.6));

        const P = new Plot({ box: { x0: -6.05, x1: 2.2, y0: -2.6, y1: 2.75 }, x: [0, ROUNDS], y: [0, 22], x_ticks: [0, 5, 10, 15, 20], y_ticks: [5, 10, 15, 20], x_label: 'RTT', y_label: L('window (KB)', '窗口（KB）'), font: 24 });
        this.plot = P;
        P.group.name = 'plot';

        // the window so far (the scene draws it round by round; then it is whole)
        const pts = (): XY[] => {
          const { w } = run(), n = shown.get_value(), out: XY[] = [];
          for (let r = 0; r <= ROUNDS && r <= n; r++) out.push([r, w[r]]);
          const k = Math.floor(n);
          if (k < ROUNDS && n > k) out.push([k + (n - k), w[k] + (w[k + 1] - w[k]) * (n - k)]);
          return out;
        };
        const curve = P.live_curve(pts, { color: c.accent, width: 4.5 }, key);
        const window = VGroup(curve);
        window.name = 'window';

        // the old threshold up to the loss, the new one after it
        const past = () => shown.get_value() > run().at + 0.999;
        const old_t = P.live_curve(() => [[0, S0], [run().at, S0]], { color: c.muted, width: 2.5, dash: true }, key);
        const new_t = P.live_curve(() => (past() ? [[run().at + 1, run().s], [ROUNDS, run().s]] : []), { color: c.good, width: 2.5, dash: true }, key);
        const old_l = words(L('old threshold 10', '旧阈值 10'), 20, c.muted, P.X(0.3), P.Y(S0) + 0.22);
        // the new threshold's value at the right edge, in the colour of the readout that explains it
        const new_l = live_label(() => (past() ? `${run().s}` : ''), 24, c.good, (t) => t.move_to([P.X(ROUNDS) + 0.16 + t.width / 2, P.Y(run().s), 0]), { weight: '600' });
        const thresholds = VGroup(old_t, new_t, old_l, new_l);
        thresholds.name = 'thresholds';

        // the loss: a mark on the curve, and the handle that moves it
        const mark = follow(Circle({ radius: 0.13, color: c.coral, fill_opacity: 1, stroke_width: 0 }), () => P.P(run().at, loss.get_value()));
        const mark_l = live_label(() => (dup.get_value() > 0.5 ? L('3 duplicate ACKs', '3 个重复确认') : L('timeout', '超时')), 22, c.coral, (t) => t.move_to([P.X(run().at), P.Y(loss.get_value()) + 0.36, 0]), { weight: '600' });
        const loss_g = VGroup(mark, mark_l);
        loss_g.name = 'loss';

        // what follows the loss
        const X0 = 3.0;
        const after = VGroup(
          words(L('after the loss', '丢包之后'), 24, c.ink, X0, 2.55, { weight: '600' }),
          live_label(() => `${L('threshold', '阈值')}  ${loss.get_value()} / 2 = ${run().s} KB`, 24, c.good, (t) => t.move_to([X0 + t.width / 2, 1.85, 0]), { max_width: 6.9 - X0 }),
          live_label(() => `${L('window', '窗口')}  ${run().w[run().at + 1]} KB`, 24, c.accent, (t) => t.move_to([X0 + t.width / 2, 1.25, 0])),
          words(L('the next 4 RTTs', '接下来 4 个 RTT'), 22, c.muted, X0, 0.62),
          live_label(() => run().w.slice(run().at + 2, run().at + 6).join(',  '), 30, c.accent, (t) => t.move_to([X0 + t.width / 2, 0.05, 0]), { weight: '600' }),
        );
        after.name = 'after';
        this.protocol = new Choice({ tracker: reno, labels: ['Tahoe', 'Reno'], x0: X0, x1: 6.85, y: -1.4, font_size: 24 });
        this.protocol.name = 'protocol';
        this.signal = new Choice({ tracker: dup, labels: [L('timeout', '超时'), L('3 dup ACKs', '3 个重复确认')], x0: X0, x1: 6.85, y: -2.3, font_size: 22 });
        this.signal.name = 'signal';

        this.play(FadeIn(P.group), Create(old_t), FadeIn(old_l), { run_time: 1.2 });
        // (live parts are added, not faded: a fade copies them and they change underneath)
        this.add(window, new_t, new_l);
        const at = run().at;
        this.play(UpdateFromAlphaFunc(shown, (_m: unknown, t?: number) => shown.set_value((at + 0.001) * (t ?? 1))), { run_time: 4, rate_func: linear });
        this.add(mark.update(0), mark_l.update(0));
        this.wait(0.6);
        this.play(UpdateFromAlphaFunc(shown, (_m: unknown, t?: number) => shown.set_value(at + 0.001 + (ROUNDS - at - 0.001) * (t ?? 1))), { run_time: 3.5, rate_func: linear });
        this.play(FadeIn(after.submobjects[0]), FadeIn(after.submobjects[3]), FadeIn(this.protocol), FadeIn(this.signal), { run_time: 0.8 });
        this.add(window, thresholds, loss_g, after, this.protocol, this.signal);
        this.wait(2);
      }
    }
    return new Tahoe();
  },
  explore: (scene: any, ui, p) => {
    const L = (en: string, zh: string) => pick(resolve_lang(p.lang), en, zh);
    const P: Plot = scene.plot;
    const report = () => {
      const r = tcp_rounds(scene.loss.get_value(), scene.reno.get_value() > 0.5, scene.dup.get_value() > 0.5);
      return { loss: scene.loss.get_value(), reno: scene.reno.get_value() > 0.5, dupack: scene.dup.get_value() > 0.5, threshold: r.s, next: r.w.slice(r.at + 1, r.at + 6) };
    };
    // the loss rides on the additive-increase part of the curve, at even windows from 12 to 20
    const snap = (x: number) => clamp(2 * Math.round((x - 4 + S0) / 2), 12, 20);
    ui.add_handle({
      get: (): P3 => P.P(loss_round(scene.loss.get_value()), scene.loss.get_value()),
      set: (pt: P3) => {
        const v = snap(P.data(pt)[0]);
        if (v !== scene.loss.get_value()) scene.loss.set_value(v);
      },
      constraint: (pt: P3): P3 => {
        const x = clamp(P.data(pt)[0], loss_round(12), loss_round(20));
        return P.P(x, x - 4 + S0);
      },
      step: P.X(2) - P.X(0),
      radius: 0.38,
      label: L('the moment of the loss', '丢包的时刻'),
      on_end: () => emit(scene, 'tahoe', report()),
    });
    scene.protocol.attach(ui as any, L('Tahoe or Reno', 'Tahoe 还是 Reno'), () => emit(scene, 'tahoe', report()));
    scene.signal.attach(ui as any, L('how the loss is noticed', '丢包是怎么发现的'), () => emit(scene, 'tahoe', report()));
  },
});
