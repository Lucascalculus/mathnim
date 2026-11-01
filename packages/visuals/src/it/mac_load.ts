// Q1 of Review (1) (practice exam Q5): a LAN under high load, contention or collision-free? Drag the
// offered load G (frames per frame time). Slotted ALOHA delivers a frame in a slot only when exactly one
// station sends: S = G·e^(−G), at best 37% at G = 1, then falling as collisions take over (plain ALOHA,
// G·e^(−2G), faint). The bit-map protocol never collides: it carries everything offered until the
// channel is full, less one reservation bit per frame, S = min(G, d/(d + 1)) with frames d = 20 bit-slots
// long; when few stations send, the bit map simply repeats. The bars split the channel's time into
// frames, collisions and empty slots (ALOHA) and frames and reservations (bit-map).
import { Circle, Create, FadeIn, Scene, UpdateFromAlphaFunc, VGroup, ValueTracker, smooth } from 'manim-web';
import { palette } from '../theme';
import { define_visual } from '../visual';
import { aside } from '../aside';
import { LANG_SPEC, Plot, drag_x, emit, follow, live_fill, live_label, num, pct, pick, resolve_lang, words, type XY } from './kit';

export interface MacLoadParams extends Record<string, unknown> {
  load: number;
  lang: string;
}

/** Frame length of the bit-map protocol, in reservation bit-slots. */
const D = 20;
/** What the channel does at offered load G: slotted ALOHA's useful, colliding and empty slots, and the bit-map protocol's frames. */
export function channel(G: number) {
  const empty = Math.exp(-G), useful = G * Math.exp(-G);
  const frames = Math.min(G, D / (D + 1));
  return { useful, collisions: Math.max(0, 1 - empty - useful), empty, pure: G * Math.exp(-2 * G), frames, reservations: 1 - frames };
}

export const it_mac_load = define_visual<MacLoadParams>({
  name: 'it_mac_load',
  summary: 'Contention against collision-free under rising load (COMP90007 review, practice exam Q5): drag the offered load G and compare slotted ALOHA (S = G·e^−G, at best 37%, then collisions take over) with the bit-map protocol (carries all offered traffic until the channel is full); bars show the channel time spent on frames, collisions, empty slots and reservations.',
  topics: ['networks', 'mac sublayer', 'aloha', 'slotted aloha', 'bit-map protocol', 'contention', 'collision-free', 'channel efficiency'],
  params: {
    load: { type: 'number', min: 0.1, max: 4, default: 3, doc: 'the offered load G the scene ends on (frames per frame time); 3 is high load, 0.3 light load' },
    lang: LANG_SPEC,
  },
  examples: [{}, { lang: 'zh' }, { load: 0.1 }, { load: 1, lang: 'zh' }, { load: 4 }],
  ids: ['plot', 'aloha', 'bitmap', 'load', 'bars'],
  scene: (p) => {
    const lang = resolve_lang(p.lang);
    const L = (en: string, zh: string) => pick(lang, en, zh);
    class MacLoad extends Scene {
      g = new ValueTracker(0.1);
      plot!: Plot;
      override construct() {
        const c = palette();
        const { g } = this;
        this.track(g);
        const m = () => channel(g.get_value());
        const key = () => g.get_value().toFixed(3);
        aside(this, words(L(`models: slotted ALOHA with independent senders; a bit-map protocol with frames ${D} bit-slots long`, `模型：各站独立发送的时隙 ALOHA；帧长 ${D} 个位时隙的位图协议`), 20, c.muted, -6.9, 3.6));

        // ---- the useful share of the channel against the load
        const P = new Plot({ box: { x0: -5.95, x1: -0.3, y0: -2.55, y1: 2.65 }, x: [0, 4], y: [0, 1.12], x_ticks: [1, 2, 3, 4], y_ticks: [0.37, 1], y_fmt: (v) => `${Math.round(v * 100)}\\%`, x_label: { tex: 'G' }, y_label: L('useful share', '有效比例'), font: 24 });
        this.plot = P;
        P.group.name = 'plot';
        const xs = Array.from({ length: 161 }, (_, i) => i / 40);
        const pure = P.curve(xs.map((x) => [x, x * Math.exp(-2 * x)] as XY), { color: c.coral, width: 2.5, dash: true, opacity: 0.55 });
        const slotted = P.curve(xs.map((x) => [x, x * Math.exp(-x)] as XY), { color: c.coral, width: 4.5 });
        const aloha = VGroup(slotted, pure, words(L('slotted ALOHA', '时隙 ALOHA'), 22, c.coral, P.X(1.55), P.Y(0.44)), words(L('ALOHA', '纯 ALOHA'), 20, c.coral, P.X(0.62), P.Y(0.09)));
        aloha.name = 'aloha';
        const bm = P.curve(xs.map((x) => [x, channel(x).frames] as XY), { color: c.good, width: 4.5 });
        const bitmap = VGroup(bm, words(L('bit-map', '位图'), 22, c.good, P.X(1.75), P.Y(0.86)));
        bitmap.name = 'bitmap';

        // the load: a vertical line, its value at the top, a dot on each curve
        const top = 1.06;
        const cursor = P.live_curve(() => [[g.get_value(), 0], [g.get_value(), top]], { color: c.ink, width: 2.5 }, key);
        const knob = follow(Circle({ radius: 0.11, color: c.ink, fill_opacity: 1, stroke_width: 0 }), () => P.P(g.get_value(), top));
        const g_label = live_label(() => `G = ${num(g.get_value(), 1)}`, 24, c.ink, (t) => {
          const x = P.X(g.get_value());
          t.move_to([g.get_value() > 3.1 ? x - 0.22 - t.width / 2 : x + 0.22 + t.width / 2, P.Y(top), 0]);
        });
        const dots = VGroup(P.live_dot(() => [g.get_value(), m().useful], c.coral, 0.09), P.live_dot(() => [g.get_value(), m().frames], c.good, 0.09));
        const load = VGroup(cursor, knob, g_label, dots);
        load.name = 'load';

        // ---- where the channel's time goes, at this load
        const X0 = 1.0, X1 = 6.8, H = 0.46;
        const seg = (y: number, from: () => number, to: () => number, color: string, op: number) =>
          live_fill(() => {
            const a = X0 + (X1 - X0) * from(), b = X0 + (X1 - X0) * to();
            return b - a < 1e-3 ? [] : ([[a, y - H / 2], [b, y - H / 2], [b, y + H / 2], [a, y + H / 2]] as XY[]);
          }, color, op, key);
        const ya = 1.55, yb = -0.95;
        const bar_a = VGroup(
          words(L('slotted ALOHA', '时隙 ALOHA'), 24, c.coral, X0, ya + 0.62, { weight: '600' }),
          seg(ya, () => 0, () => m().useful, c.good, 0.75),
          seg(ya, () => m().useful, () => m().useful + m().collisions, c.coral, 0.75),
          seg(ya, () => m().useful + m().collisions, () => 1, c.faint, 1),
          live_label(() => `${L('frames', '帧')} ${pct(m().useful)}   ${L('collisions', '冲突')} ${pct(m().collisions)}   ${L('empty', '空闲')} ${pct(m().empty)}`, 22, c.ink, (t) => t.move_to([X0 + t.width / 2, ya - 0.6, 0]), { max_width: X1 - X0 }),
        );
        const bar_b = VGroup(
          words(L('bit-map (collision-free)', '位图（无冲突）'), 24, c.good, X0, yb + 0.62, { weight: '600' }),
          seg(yb, () => 0, () => m().frames, c.good, 0.75),
          seg(yb, () => m().frames, () => 1, c.muted, 0.35),
          live_label(() => `${L('frames', '帧')} ${pct(m().frames)}   ${L('reservations', '预约位')} ${pct(m().reservations)}`, 22, c.ink, (t) => t.move_to([X0 + t.width / 2, yb - 0.6, 0]), { max_width: X1 - X0 }),
        );
        const bars = VGroup(bar_a, bar_b);
        bars.name = 'bars';

        this.play(FadeIn(P.group), Create(slotted), Create(pure), Create(bm), { run_time: 1.6 });
        this.play(FadeIn(aloha.submobjects[2]), FadeIn(aloha.submobjects[3]), FadeIn(bitmap.submobjects[1]), { run_time: 0.5 });
        // (live parts are added, not faded: a fade copies them and they change underneath)
        this.add(load, bars);
        this.wait(0.6);
        this.play(UpdateFromAlphaFunc(g, (_m: unknown, t?: number) => g.set_value(0.1 + (p.load - 0.1) * (t ?? 1))), { run_time: 4.5, rate_func: smooth });
        this.add(aloha, bitmap, load, bars);
        this.wait(1.5);
      }
    }
    return new MacLoad();
  },
  explore: (scene: any, ui, p) => {
    const L = (en: string, zh: string) => pick(resolve_lang(p.lang), en, zh);
    drag_x(ui, scene.plot, scene.g, 1.06, { lo: 0.1, hi: 4, step: 0.1, label: L('the load G', '负载 G'), on_end: () => emit(scene, 'mac_load', { G: scene.g.get_value(), ...channel(scene.g.get_value()) }) });
  },
});
