// "Pizza shop" - the pizza lesson as a game (design: docs/lessons/pizza-game.md).
// Every level is a world: the student acts (bets, stamps, cuts, builds, drags,
// serves) and Marco reacts. Same skills and misconception ids as the guided
// pizza lesson, so mastery is shared.
import type { Lesson } from '@mathnim/core';
import { expr } from '@mathnim/core';
import {
  Circle, DecimalNumber, DOWN, LEFT, Line, Mobject, NumberLine, RIGHT, Rectangle, Scene, Square,
  UP, VGroup, ValueTracker, always_redraw, BraceBetweenPoints, mul,
} from 'manim-web';
import { add_cut_angles, disc_cut_angles, snap_line_through } from 'manim-web/ext/cut';
import { Slider } from 'manim-web/ext/widgets';
import { C } from '../best-angle/theme';
import { P, T, fit, pizza, rearranged_width, say, slices } from '../pizza/figures';

/** The bet from level 0, used by the boss level's ending (this page only). */
let BET: 'big' | 'small' | 'same' | null = null;

const plain_circle = (r: number, at: number[], fill = 1) =>
  Circle({ radius: r, fill_color: P.cheese, fill_opacity: fill, stroke_color: P.crust, stroke_width: Math.max(4, 6 * r) }).move_to(at);
/** A quiet scene-level poll (runs while the world is live). */
function watch(scene: Scene, f: () => void): void {
  scene.add_updater(() => f());
}
const equiv = (a: string, b: string) => {
  try {
    return expr.equivalent(a, b, { ranges: { r: [0.5, 3] } });
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------- 0. the bet
const BIG_AT = [-3.6, 0.9, 0], SMALL_AT = [3.65, 0.9, 0];
class BetScene extends Scene {
  coin!: Mobject;
  override construct() {
    this.add(pizza(1.5, BIG_AT, { toppings: true }));
    this.add(pizza(0.75, [SMALL_AT[0] - 0.95, SMALL_AT[1], 0]), pizza(0.75, [SMALL_AT[0] + 0.95, SMALL_AT[1], 0]));
    this.add(say('one 16-inch', 30).move_to([BIG_AT[0], -1.0, 0]), say('two 8-inch', 30).move_to([SMALL_AT[0], -1.0, 0]));
    this.add(say('$16', 30, C.good).move_to([BIG_AT[0], -1.55, 0]), say('$16', 30, C.good).move_to([SMALL_AT[0], -1.55, 0]));
    this.add(say('same amount', 26, C.muted).move_to([0, 0.9, 0]));
    this.add(say('your coin', 24, C.muted).move_to([-1.35, -3.05, 0]));
    this.coin = Circle({ radius: 0.3, fill_color: '#F0AC1F', fill_opacity: 1, stroke_color: '#8A5A00', stroke_width: 4 }).move_to([0, -3.05, 0]);
    this.add(this.coin);
    this.wait(0.1);
  }
}

// ---------------------------------------------------------------- 1. cover the pizza
const C1 = [-3.4, -0.1, 0], R1 = 1.8, NL_AT = [3.25, -2.55, 0];
class CoverScene extends Scene {
  tiles = ValueTracker(0);
  covered = ValueTracker(0);
  est = ValueTracker(1);
  nl!: any;
  override construct() {
    this.add(plain_circle(R1, C1));
    const sq = Square({ side_length: R1 / 2, color: C.accent, fill_opacity: 0.15, stroke_width: 3 }).move_to([1.35, 2.55, 0]);
    this.add(sq, T('\\tfrac14 r^2', 30, C.accent).next_to(sq, RIGHT, { buff: 0.2 }), say('tap the pizza to place one', 22, C.muted).move_to([3.65, 2.0, 0]));
    const n = DecimalNumber(0, { num_decimal_places: 0, font_size: 40, color: C.ink });
    n.add_updater((m: any) => m.set_value(Math.round(this.tiles.get_value())));
    const cov = DecimalNumber(0, { num_decimal_places: 2, font_size: 40, color: C.accent });
    cov.add_updater((m: any) => m.set_value(this.covered.get_value()));
    const row1 = VGroup(say('tiles:', 28), n).arrange(RIGHT, { buff: 0.2 }).move_to([2.6, 1.05, 0], { aligned_edge: LEFT });
    const row2 = VGroup(say('cheese covered:', 28), cov, T('r^2', 34, C.accent)).arrange(RIGHT, { buff: 0.2 }).move_to([1.3, 0.3, 0], { aligned_edge: LEFT });
    this.add(row1, row2);
    this.add(fit(say('How many radius-squares of cheese is the whole pizza?', 26), 6.2).move_to([NL_AT[0], -1.35, 0]));
    this.nl = NumberLine({ x_range: [0, 6, 1], length: 5.8, include_numbers: true, font_size: 28, color: C.ink, decimal_number_config: { num_decimal_places: 0, color: C.ink } }).move_to(NL_AT);
    this.add(this.nl);
    this.wait(0.1);
  }
}
/** Sample points inside the pizza (fixed grid) to measure how much cheese the tiles cover. */
const SAMPLES: number[][] = [];
for (let i = 0; i < 48; i++) for (let j = 0; j < 48; j++) {
  const x = C1[0] - R1 + ((i + 0.5) / 48) * 2 * R1, y = C1[1] - R1 + ((j + 0.5) / 48) * 2 * R1;
  if ((x - C1[0]) ** 2 + (y - C1[1]) ** 2 <= R1 * R1) SAMPLES.push([x, y]);
}
function coverage(tiles: Mobject[]): number {
  const h = R1 / 4 + 1e-6;
  const cs = tiles.map((m) => m.get_center());
  let hit = 0;
  for (const [x, y] of SAMPLES) if (cs.some((c) => Math.abs(x - c[0]) <= h && Math.abs(y - c[1]) <= h)) hit++;
  return (hit / SAMPLES.length) * Math.PI; // in radius-squares
}

// ---------------------------------------------------------------- 2. the knife
const SR = 1.6, FROM = [-4.55, 1.0, 0], TO = [-2.55, 1.0, 0];
class KnifeScene extends Scene {
  n = ValueTracker(1);
  u = ValueTracker(0);
  sn!: any;
  su!: any;
  override construct() {
    const { n, u } = this;
    this.add(always_redraw(() => (n.get_value() < 2 ? pizza(SR, FROM, { toppings: false }) : slices(n.get_value(), u.get_value(), SR, FROM, TO))));
    const look = { length: 4.4, color: C.accent, track_color: '#C9CBD3', stroke_width: 9, knob_radius: 0.17, font_size: 32 };
    this.sn = new Slider(n, { ...look, x_range: [1, 48], label: '\\text{slices}', decimals: 0 }).move_to([-2.5, -2.2, 0]);
    this.su = new Slider(u, { ...look, x_range: [0, 1], label: '\\text{line up}', decimals: 2 }).move_to([-2.5, -3.15, 0]);
    this.add(this.sn, this.su);
    const tips = VGroup(
      fit(say('1. Swipe across the pizza to cut it.', 26), 5.6),
      fit(say('2. More slices, then line them up.', 26), 5.6),
      fit(say('What shape do you get?', 26, C.muted), 5.6),
    ).arrange(DOWN, { aligned_edge: LEFT, buff: 0.3 }).move_to([3.6, 1.2, 0]);
    this.add(tips);
    this.wait(0.1);
  }
}

// ---------------------------------------------------------------- 3. build the formula
const N3 = 48, R3 = 1.9, TO3 = [-2.6, 1.3, 0];
class FormulaScene extends Scene {
  ok = ValueTracker(0);
  builder: any = null;
  override construct() {
    this.add(slices(N3, 1, R3, TO3, TO3));
    const w = rearranged_width(N3, R3), h = R3 * Math.cos(Math.PI / N3);
    const x0 = TO3[0] - w / 2, y0 = TO3[1] - h / 2;
    const side = BraceBetweenPoints([x0, y0 + h, 0], [x0, y0, 0], { color: C.accent });
    const bottom = BraceBetweenPoints([x0, y0, 0], [x0 + w, y0, 0], { color: P.crust });
    this.add(side, T('r', 40, C.accent).next_to(side, LEFT, { buff: 0.12 }));
    this.add(bottom, fit(say('half the crust', 26, P.crustText), 3.5).next_to(bottom, DOWN, { buff: 0.12 }));
    this.add(fit(say('The whole crust is 2πr long.', 26, C.muted), 5).move_to([3.4, 2.6, 0]));
    this.add(T('A \\;=', 48).move_to([0.45, -1.25, 0]));
    this.wait(0.1);
  }
}

// ---------------------------------------------------------------- 4. the dough machine
const S4 = 0.22, GC = [-2.4, -0.6, 0];
const ratio = (d: number) => (d / 8) ** 2;
class MachineScene extends Scene {
  d = ValueTracker(9);
  override construct() {
    const { d } = this;
    this.add(pizza(4 * S4, [-5.9, 2.75, 0]), say('8-inch', 22, C.muted).move_to([-5.9, 1.55, 0]));
    this.add(always_redraw(() => VGroup(
      plain_circle((d.get_value() / 2) * S4, GC),
      Line(GC, [GC[0] + (d.get_value() / 2) * S4, GC[1], 0], { color: C.accent, stroke_width: 4 }),
    )));
    const dv = DecimalNumber(9, { num_decimal_places: 1, font_size: 40, color: C.accent });
    dv.add_updater((m: any) => m.set_value(d.get_value()));
    const av = DecimalNumber(64, { num_decimal_places: 0, font_size: 40, color: C.ink });
    av.add_updater((m: any) => m.set_value(Math.PI * (d.get_value() / 2) ** 2));
    const kv = DecimalNumber(1.27, { num_decimal_places: 2, font_size: 52, color: C.coral });
    kv.add_updater((m: any) => m.set_value(ratio(d.get_value())));
    const row = (parts: Mobject[], y: number) => {
      const g = VGroup(...parts);
      const place = () => g.arrange(RIGHT, { buff: 0.18 }).move_to([1.4, y, 0], { aligned_edge: LEFT });
      place();
      g.add_updater(place);
      return g;
    };
    this.add(row([say('diameter', 28), dv, say('in', 28)], 1.4), row([say('cheese', 28), av, T('\\text{in}^2', 32)], 0.5), row([say('×', 34, C.coral), kv, say('the 8-inch', 28, C.coral)], -0.5));
    this.add(fit(say('Goal: exactly 2 × the 8-inch', 28, C.good), 5.4).move_to([3.4, -1.7, 0]));
    this.wait(0.1);
  }
}

// ---------------------------------------------------------------- quick check: three times as wide
class FactorScene extends Scene {
  override construct() {
    this.add(pizza(0.7, [-4.6, 0.3, 0]), T('r', 40, C.accent).move_to([-4.6, -0.85, 0]));
    this.add(pizza(2.1, [0.4, 0.3, 0]), T('3r', 40, C.accent).move_to([0.4, -2.2, 0]));
    this.add(T('\\text{area} \\times \\,?', 52, C.coral).move_to([4.6, 0.3, 0]));
    this.wait(0.1);
  }
}

// ---------------------------------------------------------------- 5. rush hour
const ORDERS = [
  { who: 'Ana', area: 113 },
  { who: 'Ben', area: 201 },
  { who: 'Chloe', area: 50 },
];
const S5 = 0.2, PC5 = [-3.3, -0.2, 0];
class RushScene extends Scene {
  d = ValueTracker(10);
  order = ValueTracker(0);
  served = ValueTracker(0);
  dnum!: any;
  override construct() {
    const { d, order } = this;
    this.add(always_redraw(() => plain_circle(Math.max(0.2, (d.get_value() / 2) * S5), PC5)));
    this.dnum = DecimalNumber(10, { num_decimal_places: 0, font_size: 48, color: C.accent });
    this.dnum.add_updater((m: any) => m.set_value(d.get_value()));
    const drow = VGroup(say('diameter', 30), this.dnum, say('inches', 30));
    const place = () => drow.arrange(RIGHT, { buff: 0.5 }).move_to([PC5[0], -3.15, 0]);
    place();
    drow.add_updater(place);
    this.add(drow);
    // one order card per customer; only the current one is in the scene
    const cards = ORDERS.map((o) => VGroup(
      Rectangle({ width: 5.6, height: 2.2, stroke_color: C.faint, stroke_width: 2, fill_color: '#FFFFFF', fill_opacity: 1 }),
      say(`${o.who} wants`, 30).shift(mul(0.55, UP)),
      VGroup(T(`${o.area}`, 52, C.coral), T('\\text{in}^2 \\text{ of pizza}', 36)).arrange(RIGHT, { buff: 0.15 }).shift(mul(0.35, DOWN)),
    ).move_to([3.3, 1.2, 0]));
    let shown = 0;
    this.add(cards[0]);
    this.add_updater(() => {
      const i = Math.round(order.get_value());
      if (i === shown) return;
      this.remove(cards[shown]);
      if (i < cards.length) this.add(cards[i]);
      shown = i;
    });
    const sv = DecimalNumber(0, { num_decimal_places: 0, font_size: 36, color: C.good });
    sv.add_updater((m: any) => m.set_value(this.served.get_value()));
    this.add(VGroup(say('served', 28), sv, say('of 3', 28)).arrange(RIGHT, { buff: 0.15 }).move_to([3.3, -1.1, 0]));
    this.wait(0.1);
  }
}

// ---------------------------------------------------------------- boss: settle the bet
const RB = 1.9, BIGB = [2.9, 0, 0];
const SMALL_SPOTS = [[-5.0, 1.3, 0], [-2.8, 1.3, 0], [-5.0, -1.2, 0], [-2.8, -1.2, 0]];
class SettleScene extends Scene {
  fill = ValueTracker(0);
  poured = ValueTracker(0);
  smalls: Mobject[] = [];
  override construct() {
    const { fill } = this;
    this.add(Circle({ radius: RB, stroke_color: P.crust, stroke_width: 10 }).move_to(BIGB));
    this.add(always_redraw(() => {
      const f = fill.get_value();
      return f < 0.005 ? VGroup() : Circle({ radius: RB * Math.sqrt(f), fill_color: P.cheese, fill_opacity: 1, stroke_width: 0 }).move_to(BIGB);
    }));
    this.add(say('one 16-inch', 28).move_to([BIGB[0], -2.4, 0]));
    const pct = DecimalNumber(0, { num_decimal_places: 0, font_size: 40, color: C.good });
    pct.add_updater((m: any) => m.set_value(100 * fill.get_value()));
    const full = VGroup(pct, say('% full', 28, C.good));
    const place = () => full.arrange(RIGHT, { buff: 0.12 }).move_to([BIGB[0], -3.05, 0]);
    place();
    full.add_updater(place);
    this.add(full);
    this.smalls = SMALL_SPOTS.map((p) => pizza(RB / 2, p));
    this.add(...this.smalls, say('four 8-inch pizzas', 26, C.muted).move_to([-3.9, -2.75, 0]));
    this.wait(0.1);
  }
}

// ---------------------------------------------------------------- wrap-up
class Wrap extends Scene {
  override construct() {
    const rows = VGroup(
      T('A = \\pi r^2', 60, C.accent),
      fit(say('Twice as wide → four times the pizza.', 32), 9),
      fit(say('Pizza sizes are diameters: halve them first.', 32), 9),
    ).arrange(DOWN, { buff: 0.6 }).move_to([0, 0.2, 0]);
    this.add(rows);
    this.wait(6);
  }
}

// ---------------------------------------------------------------- the lesson
export const lesson: Lesson = {
  id: 'pizza-game',
  title: 'Pizza shop: why a circle’s area is πr²',
  description: 'A game: bet, measure, cut, build the formula, run the pizza shop, settle the bet.',
  mode: 'game',
  character: { name: 'Marco', avatar: '🧑‍🍳' },
  skills: [
    { id: 'area-why', name: 'Explain $A = \\pi r^2$' },
    { id: 'area-scaling', name: 'Radius $\\times k$ → area $\\times k^2$' },
    { id: 'area-compute', name: 'Compute circle areas', prerequisites: ['area-why'] },
  ],
  misconceptions: [
    { id: 'linear-scaling', description: 'Doubling the radius doubles the area.' },
    { id: 'four-squares', description: 'The circle is 4 radius-squares - that is the square around it.' },
    { id: 'diamond-inside', description: 'The circle is only 2 radius-squares - that is the diamond inside it.' },
    { id: 'circumference-area', description: 'The area is 2πr - mixing up the crust (a length) with the pizza (an area).' },
    { id: 'forgot-pi', description: 'The area is r × r - forgetting how wide the rectangle is.' },
    { id: 'diameter-radius', description: 'Using the diameter where the formula needs the radius.' },
  ],
  steps: [
    {
      id: 'bet', kind: 'explore', chapter: 'The bet', title: 'Place your bet', scene: () => new BetScene(),
      prompt: 'Same price. Drag your coin onto the **better deal**.',
      setup: (scene: any, ui, _ctx, world) => {
        const zone = (id: string, box: [number, number, number, number], at: number[]) => ({ id, label: id, region: { box }, snap_to: at, hint: 'Bet here' });
        ui.add_draggable(scene.coin, {
          label: 'your coin', return_if_missed: 'home',
          zones: [zone('big', [-5.6, -1.6, -1.9, 2.7], [BIG_AT[0], -2.3, 0]), zone('small', [1.3, 6.0, -1.9, 2.7], [SMALL_AT[0], -2.3, 0]), zone('same', [-1.3, 1.3, 0.2, 1.6], [0, 0.2, 0])],
          on_drop: (z: any) => {
            const id = typeof z === 'string' ? z : z?.id;
            if (!id) return;
            BET = id;
            world.state.bet = id;
            world.emit('coin_placed', { bet: id });
          },
        });
      },
      goals: [{ id: 'placed', check: (_s, _c, w) => !!w.state.bet, message: 'Bet placed. Let’s find out who’s right.' }],
      lines: [
        { text: 'Friday night. Same price: one big sixteen-inch pizza, or two eight-inch ones. Put your coin on the better deal.', when: 'enter' },
        { text: 'Just drag the coin onto the offer you’d pick.', when: 'idle' },
      ],
      solve: (_s, _c, w) => {
        w.state.bet = 'big';
      },
    },
    {
      id: 'cover', kind: 'explore', chapter: 'Measure the cheese', title: 'Cover the pizza', skill: 'area-why', scene: () => new CoverScene(),
      prompt: 'Tap the pizza to cover it with **quarter radius-squares**, then drag the marker: how many radius-squares of cheese is the whole pizza?',
      setup: (scene: any, ui, _ctx, world) => {
        const tile = Square({ side_length: R1 / 2, fill_color: '#FFFFFF', fill_opacity: 0.6, stroke_color: C.accent, stroke_width: 3 });
        let half = false;
        const stamp = ui.add_stamp(tile, {
          area: { center: C1, radius: R1 + 0.15 }, grid: R1 / 2, origin: [C1[0] + R1 / 4, C1[1] + R1 / 4, 0], max: 24, label: 'tile',
          on_count: (n: number) => {
            scene.tiles.set_value(n);
            scene.covered.set_value(coverage(stamp.stamps));
            world.emit('tile_placed', { n });
            if (!half && scene.covered.get_value() >= Math.PI / 2) {
              half = true;
              world.emit('covered_half');
            }
          },
        });
        ui.add_marker(scene.nl, scene.est, {
          label: 'your estimate', decimals: 1, snap: 0.05, show_value: true,
          on_end: (v: number) => {
            world.state.err = Math.abs(v - Math.PI);
            world.emit('estimated', { v });
          },
        });
      },
      goals: [{ id: 'estimate', check: (s: any) => s.tiles.get_value() >= 4 && Math.abs(s.est.get_value() - Math.PI) <= 0.26, message: 'A bit more than three squares: π ≈ 3.14' }],
      detectors: [
        { id: 'four', on: (e) => (e.type === 'estimated' && (e.data!.v as number) >= 3.8 ? { kind: 'misconception', id: 'four-squares', message: 'Four squares cover the whole box around the pizza, corners and all.' } : null) },
        { id: 'two', on: (e) => (e.type === 'estimated' && (e.data!.v as number) <= 2.2 ? { kind: 'misconception', id: 'diamond-inside', message: 'Two squares is only the diamond inside - there’s more cheese than that.' } : null) },
      ],
      stars: (_st, w) => ((w.state.err as number) ?? 0) < 0.1 ? 3 : ((w.state.err as number) ?? 0) < 0.25 ? 2 : 1,
      lines: [
        { text: 'How much cheese is on a pizza? Let’s measure it in squares as wide as the radius.', when: 'enter' },
        { text: 'One tile. Keep going - cover the cheese.', when: { event: 'tile_placed' } },
        { text: 'Halfway there.', when: { event: 'covered_half' } },
        { text: 'Tap the pizza to drop a tile, then drag the marker.', when: 'idle' },
        { text: 'Careful - four squares cover the whole box around the pizza, corners and all.', when: { finding: 'four-squares' } },
        { text: 'Two squares is only the diamond inside. There’s more cheese than that.', when: { finding: 'diamond-inside' } },
        { text: 'A bit more than three squares. Remember that number.', when: 'goal' },
      ],
      solve: (s: any, _c, w) => {
        s.tiles.set_value(6);
        s.est.set_value(3.15);
        w.state.err = 0.01;
      },
    },
    {
      id: 'knife', kind: 'explore', chapter: 'The knife', title: 'Cut and line up', skill: 'area-why', scene: () => new KnifeScene(),
      prompt: 'Swipe across the pizza to **cut** it. Then make **many** slices and **line them up**.',
      setup: (scene: any, ui, _ctx, world) => {
        let cuts: number[] = [];
        ui.add_cutter({
          region: { center: FROM, radius: SR + 0.8 }, label: 'the knife', hint: 'Swipe to cut',
          adjust: (a: number[], b: number[]) => snap_line_through(a, b, FROM, 0.5),
          on_cut: (a: number[], b: number[]) => {
            if (scene.u.get_value() > 0.02) return; // cut the whole pizza only
            const add = disc_cut_angles(FROM, SR, a, b, 0.5);
            if (!add.length) return;
            cuts = add_cut_angles(cuts, add); // a cut through the middle adds two edges (angles)
            world.state.cuts = Math.round(cuts.length / 2);
            scene.n.set_value(Math.max(scene.n.get_value(), cuts.length));
            wake();
            world.emit('cut', { cuts: cuts.length });
          },
        });
        // the knife comes first: the sliders wake up after the first cut
        scene.sn.set_opacity(0.3);
        scene.su.set_opacity(0.3);
        let awake = false;
        const wake = () => {
          if (awake) return;
          awake = true;
          scene.sn.set_opacity(1);
          scene.su.set_opacity(1);
          scene.sn.attach(ui, { snap: 2, label: 'the slices slider', step: 2 });
          scene.su.attach(ui, { label: 'the line-up slider', step: 0.05 });
        };
        let many = false;
        watch(scene, () => {
          if (!many && scene.n.get_value() >= 8) {
            many = true;
            world.emit('many_slices');
          }
        });
      },
      goals: [{ id: 'rect', check: (s: any, _c, w) => ((w.state.cuts as number) ?? 0) >= 1 && s.n.get_value() >= 24 && s.u.get_value() >= 0.95, message: 'Almost a perfect rectangle!' }],
      stars: (st) => (st.ms < 60_000 ? 3 : st.ms < 120_000 ? 2 : 1),
      lines: [
        { text: 'Here’s a knife. Cut straight through the middle.', when: 'enter' },
        { text: 'Two slices. Keep cutting.', when: { event: 'cut' } },
        { text: 'Now line them up - tip up, tip down.', when: { event: 'many_slices' } },
        { text: 'Draw a line across the pizza to cut it.', when: 'idle' },
        { text: 'Look at that. Almost a perfect rectangle.', when: 'goal' },
      ],
      solve: (s: any, _c, w) => {
        w.state.cuts = 2;
        s.n.set_value(30);
        s.u.set_value(1);
      },
    },
    {
      id: 'formula', kind: 'explore', chapter: 'Build the formula', title: 'Build the formula', skill: 'area-why', scene: () => new FormulaScene(),
      prompt: 'A rectangle’s area is **width × height**. Drag tiles into the slots to write the pizza’s area, then press **Check**.',
      setup: (scene: any, ui) => {
        scene.builder = ui.add_tokens({
          tokens: ['\\pi', 'r', 'r', '2', { tex: '\\tfrac{1}{2}', plain: '(1/2)', label: 'one half' }, '\\times'],
          slots: 4, slots_at: [3.4, -1.25, 0], tray_at: [2.2, -3.0, 0], color: C.ink,
        });
      },
      actions: [{
        id: 'check', label: 'Check', primary: true,
        run: (scene: any, _ctx, world) => {
          const plain: string = scene.builder?.value('plain') ?? '';
          if (!plain) return;
          world.state.attempts = ((world.state.attempts as number) ?? 0) + 1;
          const ok = equiv(plain, 'pi*r^2');
          world.emit('checked', { plain, ok });
          if (ok) scene.ok.set_value(1);
        },
      }],
      goals: [{ id: 'formula', check: (s: any) => s.ok.get_value() >= 1, message: 'πr² - you built it yourself.' }],
      detectors: [
        { id: 'crust', on: (e) => (e.type === 'checked' && !e.data!.ok && (equiv(e.data!.plain as string, '2*pi*r^2') || equiv(e.data!.plain as string, '2*pi*r')) ? { kind: 'misconception', id: 'circumference-area' } : null) },
        { id: 'nopi', on: (e) => (e.type === 'checked' && !e.data!.ok && equiv(e.data!.plain as string, 'r^2') ? { kind: 'misconception', id: 'forgot-pi' } : null) },
        { id: 'wrong', on: (e) => (e.type === 'checked' && !e.data!.ok ? { kind: 'progress', id: 'try-again', message: 'Not quite - look at the two sides of the rectangle.' } : null) },
      ],
      stars: (_st, w) => (((w.state.attempts as number) ?? 1) <= 1 ? 3 : (w.state.attempts as number) === 2 ? 2 : 1),
      hints: ['The height is r. The width is half the crust.', 'The crust is 2πr long, so half of it is πr.', 'Width × height = πr × r.'],
      lines: [
        { text: 'A rectangle’s area is width times height. So what’s the area of this one?', when: 'enter' },
        { text: 'That’s the crust - how far around. We want what’s inside.', when: { finding: 'circumference-area' } },
        { text: 'Close. How wide is the rectangle, exactly?', when: { finding: 'forgot-pi' } },
        { text: 'Pi r squared. You built it yourself.', when: 'goal' },
      ],
      solve: (s: any) => s.ok.set_value(1),
    },
    {
      id: 'machine', kind: 'explore', chapter: 'The dough machine', title: 'Twice the cheese', skill: 'area-scaling', scene: () => new MachineScene(),
      prompt: 'Make a pizza with **exactly twice** the cheese of the 8-inch. Drag its edge, or this number: diameter {scrub:d} inches.',
      scrub: { d: { tracker: (s: any) => s.d, min: 6, max: 22, step: 0.1, decimals: 1, label: 'diameter in inches' } },
      setup: (scene: any, ui, _ctx, world) => {
        ui.add_handle({
          tracker: scene.d, label: 'the pizza’s edge', step: 0.1,
          from_value: (v: number) => [GC[0] + (v / 2) * S4, GC[1], 0],
          to_value: (p: number[]) => Math.min(22, Math.max(6, ((p[0] - GC[0]) / S4) * 2)),
          on_end: () => world.emit('released', { ratio: ratio(scene.d.get_value()) }),
        });
        watch(scene, () => (world.state.ratio = ratio(scene.d.get_value())));
      },
      goals: [{ id: 'double', check: (s: any) => Math.abs(ratio(s.d.get_value()) - 2) <= 0.05, message: 'Twice the cheese at about 11.3 inches - not 16!' }],
      detectors: [{ id: 'linear', on: (e) => (e.type === 'released' && Math.abs((e.data!.ratio as number) - 4) < 0.4 ? { kind: 'misconception', id: 'linear-scaling' } : null) }],
      stars: (_st, w) => {
        const err = Math.abs(((w.state.ratio as number) ?? 2) - 2);
        return err <= 0.02 ? 3 : err <= 0.04 ? 2 : 1;
      },
      lines: [
        { text: 'My dough machine makes any size. I need a pizza with exactly twice the cheese of an eight-inch.', when: 'enter' },
        { text: 'Twice as wide isn’t twice the pizza. The area grows in both directions.', when: { finding: 'linear-scaling' } },
        { text: 'Drag the edge of the pizza in or out.', when: 'idle' },
        { text: 'Eleven and a bit inches. Not sixteen!', when: 'goal' },
      ],
      solve: (s: any, _c, w) => {
        s.d.set_value(8 * Math.SQRT2);
        w.state.ratio = 2;
      },
    },
    {
      id: 'factor', kind: 'checkpoint', skill: 'area-scaling', purpose: 'check', title: 'Three times as wide', scene: () => new FactorScene(),
      narration: 'Quick one before the rush. Three times as wide - how much more pizza?',
      prompt: 'If the radius is multiplied by 3, the area is multiplied by…',
      question: { type: 'number', answer: 9, wrong: [{ answer: 3, misconception: 'linear-scaling', feedback: 'The radius is used twice in $\\pi r^2$ - the 3 counts twice: $3 \\times 3$.' }, { answer: 6, feedback: 'Not $3 + 3$: the factor multiplies, $3 \\times 3$.' }] },
      hints: ['Try it: $\\pi (3r)^2 = \\pi \\cdot 9 r^2$.'],
    },
    {
      id: 'rush', kind: 'explore', chapter: 'Rush hour', title: 'Serve the customers', skill: 'area-compute', scene: () => new RushScene(),
      prompt: 'Each customer wants an amount of pizza. Set the **diameter** (drag the number under the pizza), then press **Serve**.',
      setup: (scene: any, ui) => {
        ui.add_scrubber(scene.dnum, scene.d, { step: 1, min: 4, max: 24, px_per_step: 10, label: 'the diameter in inches' });
      },
      actions: [{
        id: 'serve', label: 'Serve', primary: true,
        run: (scene: any, _ctx, world) => {
          const i = Math.round(scene.order.get_value());
          if (i >= ORDERS.length) return;
          const d = scene.d.get_value(), want = ORDERS[i].area, got = Math.PI * (d / 2) ** 2;
          const rel = (got - want) / want;
          if (Math.abs(rel) <= 0.05) {
            scene.served.set_value(scene.served.get_value() + 1);
            scene.order.set_value(i + 1);
            world.emit('served_ok', { d, want });
          } else {
            world.state.mistakes = ((world.state.mistakes as number) ?? 0) + 1;
            world.emit(rel > 0 ? 'served_big' : 'served_small', { d, want });
          }
        },
      }],
      goals: [{ id: 'served', check: (s: any) => s.served.get_value() >= 3, message: 'Rush hour done!' }],
      detectors: [{ id: 'dr', on: (e) => (/^served_(big|small)$/.test(e.type) && Math.abs(Math.PI * (e.data!.d as number) ** 2 - (e.data!.want as number)) / (e.data!.want as number) < 0.12 ? { kind: 'misconception', id: 'diameter-radius' } : null) }],
      stars: (_st, w) => {
        const m = (w.state.mistakes as number) ?? 0;
        return m === 0 ? 3 : m === 1 ? 2 : 1;
      },
      hints: ['A 12-inch pizza has radius 6: its area is $\\pi \\cdot 6^2 \\approx 113$.', 'Area $= \\pi (d/2)^2$. Try diameters and watch the number.'],
      lines: [
        { text: 'Rush hour! Each customer wants a certain amount of pizza. Set the size and serve.', when: 'enter' },
        { text: 'Perfect.', when: { event: 'served_ok' }, once: false },
        { text: 'Too big - we’re giving away cheese.', when: { event: 'served_big' }, once: false },
        { text: 'Too small - they’ll be hungry.', when: { event: 'served_small' }, once: false },
        { text: 'Pizza sizes are diameters. The radius is half of that.', when: { finding: 'diameter-radius' } },
        { text: 'Rush hour done. Not bad at all.', when: 'goal' },
      ],
      solve: (s: any) => s.served.set_value(3),
    },
    {
      id: 'settle', kind: 'explore', chapter: 'Settle the bet', title: 'Pour the pizzas', scene: () => new SettleScene(),
      prompt: 'Drag the small pizzas onto the big one, one by one. How many fill it?',
      setup: (scene: any, ui, _ctx, world) => {
        world.state.bet = BET;
        scene.smalls.forEach((m: Mobject, i: number) => {
          const d: any = ui.add_draggable(m, {
            label: `small pizza ${i + 1}`, return_if_missed: 'home',
            zones: [{ id: 'big', label: 'the big pizza', region: { center: BIGB, radius: RB }, snap_to: 'center' }],
            on_drop: (z: any) => {
              if (!(typeof z === 'string' ? z : z?.id)) return;
              scene.remove(m);
              d.remove();
              const n = scene.poured.get_value() + 1;
              const juice: any = ui.juice;
              if (juice?.count_to) void juice.count_to(scene.fill, n / 4, { duration: 0.6 });
              else scene.fill.set_value(n / 4);
              // Marco reacts first; the count that finishes the level comes last, so his closing line is the one that stays
              if (n === 2) world.emit('poured_two');
              if (n === 4) world.emit('poured_all');
              scene.poured.set_value(n);
              world.emit('poured', { n });
            },
          });
        });
      },
      goals: [{ id: 'full', check: (s: any) => s.poured.get_value() >= 4, message: 'Four small pizzas fill one big one: the big pizza is twice the two small ones.' }],
      lines: [
        { text: 'Back to Friday’s deal. Pour the small pizzas into the big one.', when: 'enter' },
        { text: 'Two small pizzas... and the big one is only half full.', when: { event: 'poured_two' } },
        { text: 'Four small pizzas fill one big one.', when: { event: 'poured_all' } },
        { text: 'You called it. The big pizza is twice the food.', when: 'goal', if: (w) => w.state.bet === 'big' },
        { text: 'So the big pizza is twice the food of the two small ones.', when: 'goal', if: (w) => w.state.bet !== 'big' },
      ],
      solve: (s: any) => s.poured.set_value(4),
    },
    {
      id: 'wrap', kind: 'scene', chapter: 'Settle the bet', title: 'What we found', scene: Wrap,
      narration: 'Area is pi r squared. Twice as wide means four times the pizza. And pizza sizes are diameters, so halve them first.',
    },
  ],
};
