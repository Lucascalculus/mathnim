// Demo scenes for the interaction toolkit (WP1), shown by dev/interact.html.
// DOM-free: each demo builds a scene and wires primitives on an Interaction,
// so test/interact_demos.test.ts can run them headlessly.
import * as M from '../src/index';
import { add_cut_angles, disc_cut_angles, sectors_from_angles, snap_line_through } from '../src/ext/cut';
import { draggables_in, type Draggable, type DropZone } from '../src/ext/dragdrop';
import { polygon_area, vmobject_to_polygon } from '../src/ext/geom';
import type { Interaction } from '../src/ext/interact';
import type { Juice } from '../src/ext/juice';

const { Circle, Square, Sector, VGroup, MathTex, DecimalNumber, NumberLine, ValueTracker, Line, always_redraw, DOWN, LEFT, RIGHT } = M as any;

const CHEESE = '#F5C542', CRUST = '#C8742C', COIN = '#F0AC1F', TILE = '#4F9CF7', INK = '#E5E7EB';

export interface DemoCtx {
  ui: Interaction;
  juice: Juice | null;
  /** Show a line in the demo's event log. */
  log: (text: string) => void;
}
export interface DemoControls {
  /** Extra buttons: label -> action. */
  buttons?: Record<string, () => void>;
}
export interface Demo {
  id: string;
  title: string;
  /** One line under the figure. */
  caption: string;
  build(scene: M.Scene): void;
  setup(scene: M.Scene, c: DemoCtx): DemoControls | void;
}
const T = (tex: string, size = 34, color = INK) => MathTex(tex, { font_size: size, color });
const parts = (s: M.Scene) => s as any;

// ---------------------------------------------------------------- 1. drag and drop
const bet: Demo = {
  id: 'bet',
  title: 'Drag and drop: place your bet',
  caption: 'Drag coins onto a bet: zones snap coins into a row; missed drops fly home. Keyboard: Tab to a coin, arrows move, Enter drops, Esc puts back.',
  build(s) {
    const pz = (r: number, at: number[]) => Circle({ radius: r, fill_color: CHEESE, fill_opacity: 1, stroke_color: CRUST, stroke_width: 6 }).move_to(at);
    const big = pz(1.45, [-3.4, 1.1, 0]);
    const smalls = VGroup(pz(0.72, [2.4, 1.1, 0]), pz(0.72, [4.3, 1.1, 0]));
    s.add(big, smalls, T('\\text{one 16-inch}').move_to([-3.4, -0.75, 0]), T('\\text{two 8-inch}').move_to([3.35, -0.75, 0]));
    const coins = Array.from({ length: 5 }, (_, i) => Circle({ radius: 0.2, fill_color: COIN, fill_opacity: 1, stroke_color: '#8A5A00', stroke_width: 3 }).move_to([-1.1 + i * 0.55, -3.1, 0]));
    s.add(T('\\text{your coins}', 28, '#9CA3AF').move_to([0, -2.45, 0]), ...coins);
    parts(s).coins = coins;
  },
  setup(s, { ui, log }) {
    const row = (cx: number) => (_d: Draggable, _p: number[], _n: number) => {
      // first free place in a row under the offer
      const zone = cx < 0 ? 'one-16' : 'two-8';
      const taken = draggables_in(ui, zone).map((d) => d.mobject.get_center());
      for (let i = 0; i < 10; i++) {
        const q = [cx - 1.0 + (i % 5) * 0.5, -1.4 - Math.floor(i / 5) * 0.5, 0];
        if (!taken.some((t) => Math.hypot(t[0] - q[0], t[1] - q[1]) < 0.1)) return q;
      }
      return [cx, -1.4, 0];
    };
    const zones: DropZone[] = [
      { id: 'one-16', label: 'the 16-inch pizza', region: { box: [-5.4, -1.4, -2.0, 2.7] }, snap_to: row(-3.4), hint: 'Bet here' },
      { id: 'two-8', label: 'the two 8-inch pizzas', region: { box: [1.3, 5.4, -2.0, 2.7] }, snap_to: row(3.35), hint: 'Bet here' },
    ];
    const coins: Draggable[] = parts(s).coins.map((c: M.Mobject, i: number) =>
      ui.add_draggable(c, {
        zones, return_if_missed: 'home', label: `coin ${i + 1}`,
        on_drop: () => log(`bets: 16-inch ${draggables_in(ui, 'one-16').length}, two 8-inch ${draggables_in(ui, 'two-8').length}`),
      }));
    return { buttons: { Reset: () => coins.forEach((d) => d.reset()) } };
  },
};

// ---------------------------------------------------------------- 2. cutting
const C2 = [-3.2, 0.1, 0], R2 = 1.6;
const cut: Demo = {
  id: 'cut',
  title: 'Cutting: slice the pizza, split the square',
  caption: 'Swipe across the pizza (snapped through its centre) to cut slices, or across the square to split it; then drag the pieces. Keyboard: Tab to the knife, arrows aim, Enter cuts.',
  build(s) {
    const pizza = VGroup(Circle({ radius: R2, fill_color: CHEESE, fill_opacity: 1, stroke_color: CRUST, stroke_width: 6 }).move_to(C2));
    const tile = Square({ side_length: 2.2, fill_color: TILE, fill_opacity: 0.85, stroke_color: '#FFFFFF', stroke_width: 3 }).move_to([3.2, 0.1, 0]);
    s.add(pizza, tile);
    parts(s).pizza = pizza;
    parts(s).tile = tile;
  },
  setup(s, { ui, log }) {
    const P = parts(s);
    let cuts: number[] = [];
    let slices: Draggable[] = [];
    let moved = false;
    let pieces: M.Mobject[] = [P.tile];
    const piece_drags = new Map<M.Mobject, Draggable>();
    const rebuild = () => {
      for (const d of slices) d.remove();
      slices = [];
      moved = false;
      const secs = cuts.length >= 2 ? sectors_from_angles(cuts) : [];
      const shapes = secs.length
        ? secs.map(([a0, a1]) => Sector({ radius: R2, start_angle: a0, angle: a1 - a0, fill_color: CHEESE, fill_opacity: 1, stroke_color: CRUST, stroke_width: 4 }).shift(C2))
        : [Circle({ radius: R2, fill_color: CHEESE, fill_opacity: 1, stroke_color: CRUST, stroke_width: 6 }).move_to(C2)];
      P.pizza.submobjects = [];
      P.pizza.add(...shapes);
      if (secs.length) slices = shapes.map((m: M.Mobject, i: number) => ui.add_draggable(m, { label: `slice ${i + 1}`, to_front: false, on_drop: () => (moved = true) }));
    };
    ui.add_cutter({
      adjust: (a, b) => snap_line_through(a, b, C2, 0.45),
      targets: () => pieces,
      on_cut: (a, b) => {
        const add = disc_cut_angles(C2, R2, a, b, 0.45);
        if (!add.length) return;
        if (moved) return log('Put the slices back first (Reset) - the pizza is cut as a whole.');
        cuts = add_cut_angles(cuts, add);
        rebuild();
        log(`pizza: ${Math.max(1, sectors_from_angles(cuts).length)} slice(s)`);
      },
      on_split: (orig, ps) => {
        piece_drags.get(orig)?.remove();
        pieces = pieces.filter((p) => p !== orig).concat(ps);
        for (const p of ps) piece_drags.set(p, ui.add_draggable(p, { label: 'square piece' }));
        log(`square: ${pieces.length} pieces`);
      },
    });
    return {
      buttons: {
        Reset: () => {
          cuts = [];
          rebuild();
          for (const p of pieces) if (p !== P.tile) s.remove(p);
          for (const d of piece_drags.values()) d.remove();
          piece_drags.clear();
          pieces = [P.tile];
          if (!s.mobjects.includes(P.tile)) s.add(P.tile);
          ui.notify();
        },
      },
    };
  },
};

// ---------------------------------------------------------------- 3. stamps
const C3 = [-2.6, -0.1, 0], R3 = 1.8;
const cover: Demo = {
  id: 'cover',
  title: 'Stamps: cover the pizza with tiles',
  caption: 'Tap inside the pizza to place quarter radius-squares (grid snap, max 20); drag one out or double-click it to remove; swipe from outside across a tile to cut it. Keyboard: arrows, Enter, Delete.',
  build(s) {
    s.add(Circle({ radius: R3, fill_color: CHEESE, fill_opacity: 1, stroke_color: CRUST, stroke_width: 6 }).move_to(C3));
    const rsq = Square({ side_length: R3, stroke_color: TILE, stroke_width: 4 }).move_to([3.6, 1.2, 0]);
    s.add(rsq, T('r^2', 40, TILE).move_to(rsq.get_center()), T('\\text{one radius-square}', 26, '#9CA3AF').next_to(rsq, DOWN, { buff: 0.15 }));
    const n = ValueTracker(0), cov = ValueTracker(0);
    const count = DecimalNumber(0, { num_decimal_places: 0, font_size: 44, color: INK }).move_to([3.9, -1.5, 0]);
    count.add_updater((m: any) => m.set_value(Math.round(n.get_value())));
    const rs = DecimalNumber(0, { num_decimal_places: 2, font_size: 44, color: TILE }).move_to([3.5, -2.5, 0]);
    rs.add_updater((m: any) => m.set_value(cov.get_value()));
    s.add(T('\\text{pieces:}').next_to(count, LEFT, { buff: 0.3 }), count, T('\\text{area} \\approx', 34).next_to(rs, LEFT, { buff: 0.25 }), rs, T('r^2', 40, TILE).move_to([4.45, -2.5, 0]));
    parts(s).n = n;
    parts(s).cov = cov;
  },
  setup(s, { ui, juice, log }) {
    const { n, cov } = parts(s);
    const tile = Square({ side_length: R3 / 2, fill_color: TILE, fill_opacity: 0.55, stroke_color: '#FFFFFF', stroke_width: 2 });
    const tween = (t: any, v: number) => (juice ? void juice.count_to(t, v, { duration: 0.35 }) : t.set_value(v));
    const recount = () => {
      // area of the placed pieces in radius-squares (the lesson's "about 3.1")
      const a = stamp.stamps.reduce((sum, m) => sum + Math.abs(polygon_area(vmobject_to_polygon(m))), 0) / (R3 * R3);
      tween(n, stamp.count);
      tween(cov, a);
      log(`${stamp.count} pieces, area ${a.toFixed(2)} r²`);
    };
    const stamp = ui.add_stamp(tile, {
      area: { center: C3, radius: R3 + 0.15 }, grid: R3 / 2, origin: [C3[0] + R3 / 4, C3[1] + R3 / 4, 0], max: 20, label: 'tile',
      on_count: () => recount(),
    });
    ui.add_cutter({
      targets: () => stamp.stamps,
      on_split: (orig, ps) => {
        stamp.forget(orig);
        for (const p of ps) stamp.adopt(p);
        log(`cut a tile into ${ps.length}`);
      },
      label: 'knife for tiles',
      hint: 'Swipe from outside to cut a tile',
    });
    return { buttons: { Clear: () => stamp.clear() } };
  },
};

// ---------------------------------------------------------------- 4. scrubbable number
const scrub: Demo = {
  id: 'scrub',
  title: 'Scrubbable number: change r',
  caption: 'Drag the number after r = sideways (or Tab to it and use the arrow keys, Home/End) to change the radius.',
  build(s) {
    const r = ValueTracker(1.5);
    s.add(always_redraw(() => Circle({ radius: r.get_value(), fill_color: CHEESE, fill_opacity: 0.95, stroke_color: CRUST, stroke_width: 6 }).move_to([-3.2, -0.2, 0])));
    const lab = T('r =', 56).move_to([0.9, 1.2, 0]);
    const num = DecimalNumber(1.5, { num_decimal_places: 1, font_size: 56, color: '#60A5FA' }).next_to(lab, RIGHT, { buff: 0.25 });
    const a_lab = T('A = \\pi r^2 \\approx', 44).move_to([1.8, -0.4, 0]);
    const a = DecimalNumber(Math.PI * 2.25, { num_decimal_places: 2, font_size: 44, color: INK }).next_to(a_lab, RIGHT, { buff: 0.25 });
    a.add_updater((m: any) => m.set_value(Math.PI * r.get_value() ** 2));
    s.add(lab, num, a_lab, a);
    parts(s).r = r;
    parts(s).num = num;
  },
  setup(s, { ui, log }) {
    const P = parts(s);
    ui.add_scrubber(P.num, P.r, { step: 0.1, min: 0.3, max: 2.4, px_per_step: 6, label: 'the radius r', on_end: (v) => log(`r = ${v.toFixed(1)}`) });
  },
};

// ---------------------------------------------------------------- 5. token builder
const formula: Demo = {
  id: 'formula',
  title: 'Token builder: write the area',
  caption: 'Drag tiles into the slots (dropping on a full slot swaps); the builder reports LaTeX and calculator spellings - grading is up to the lesson. Keyboard: Tab to a tile, Enter.',
  build(s) {
    s.add(T('\\text{Area of the pizza} \\; =', 44).move_to([-3.4, 1.3, 0]));
  },
  setup(_s, { ui, juice, log }) {
    const b = ui.add_tokens({
      tokens: ['r', '\\pi', { tex: '^2', display: '\\square^2', label: 'squared' }, '\\times', '2'],
      slots: 3, slots_at: [1.4, 1.3, 0], tray_at: [0, -1.6, 0], color: '#111827',
      on_change: (latex, _seq, tb) => {
        log(`latex: ${latex || '(empty)'}   plain: ${tb.value('plain') || '(empty)'}`);
        // the real lesson grades with @mathnim/core's expression grader
        if (tb.complete && ['pi*r^2', 'r^2*pi'].includes(tb.value('plain'))) juice?.success(tb.slot_points[1]);
      },
    });
    return { buttons: { Reset: () => b.reset() } };
  },
};

// ---------------------------------------------------------------- 6. number-line marker
const estimate: Demo = {
  id: 'estimate',
  title: 'Number-line marker: estimate π',
  caption: 'Drag the pin to where you think π is (the value is hidden), then press Check. Keyboard: Tab to the pin, arrow keys.',
  build(s) {
    const nl = NumberLine({ x_range: [0, 5, 1], length: 11, include_numbers: true, font_size: 36, color: INK }).move_to([0, -0.8, 0]);
    s.add(T('\\text{Where is } \\pi \\text{ on the number line?}', 40).move_to([0, 2.3, 0]), nl);
    parts(s).nl = nl;
  },
  setup(s, { ui, juice, log }) {
    const nl = parts(s).nl;
    const m = ui.add_marker(nl, ValueTracker(1), { label: 'your estimate of pi', decimals: 2, snap: 0.01, show_value: false, on_end: (v) => log(`estimate: ${v.toFixed(2)}`) });
    let truth: M.Mobject | null = null;
    return {
      buttons: {
        Check: () => {
          m.show_value(true);
          if (!truth) {
            const p = nl.n2p(Math.PI);
            const mark = VGroup(Line([p[0], p[1] - 0.35, 0], [p[0], p[1] + 0.35, 0], { color: '#10B981', stroke_width: 6 }), T('\\pi', 36, '#10B981').move_to([p[0], p[1] - 0.75, 0]));
            truth = mark;
            s.add(mark);
          }
          const err = Math.abs(m.value - Math.PI);
          log(`off by ${err.toFixed(2)}`);
          if (err < 0.1) juice?.success(nl.n2p(m.value));
          else juice?.fail(nl.n2p(m.value));
          ui.notify();
        },
        Reset: () => {
          if (truth) s.remove(truth);
          truth = null;
          m.show_value(false);
          m.set_value(1);
        },
      },
    };
  },
};

// ---------------------------------------------------------------- 7. juice
const feel: Demo = {
  id: 'juice',
  title: 'Juice: rings, bursts, counters, blips',
  caption: 'Try the buttons (sounds are synthesized, no files). Mute and reduced motion (no particles, no movement) are global switches at the top.',
  build(s) {
    const n = ValueTracker(0);
    const count = DecimalNumber(0, { num_decimal_places: 0, font_size: 96, color: INK }).move_to([0, 0.2, 0]);
    count.add_updater((m: any) => m.set_value(Math.round(n.get_value())));
    s.add(count, T('\\text{a counter tweened with } \\texttt{juice.count\\_to}', 28, '#9CA3AF').move_to([0, -1.4, 0]));
    parts(s).n = n;
  },
  setup(s, { juice }) {
    const n = parts(s).n;
    const at = [0, 0.2, 0];
    return {
      buttons: {
        'Success': () => juice?.success(at),
        'Fail': () => juice?.fail(at),
        'Snap': () => juice?.snap(at),
        '+10': () => juice?.count_to(n, Math.round(n.get_value()) + 10, { duration: 0.6 }),
        'Click': () => juice?.sound('click'),
      },
    };
  },
};

export const DEMOS: Demo[] = [bet, cut, cover, scrub, formula, estimate, feel];
