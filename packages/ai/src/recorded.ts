// Recorded answers for the suggested questions of "The best angle to shoot".
// They are served by MockProvider when no API key is set, and double as the
// worked examples in the prompt (so they must pass the same validation).

export interface RecordedAnswer {
  question: string;
  title: string;
  explanation: string;
  code: string;
  checks: { label: string; value: number; expr: string }[];
  followups: string[];
}

export const RECORDED: RecordedAnswer[] = [
  {
    question: 'Why does the angle get smaller when she is very close to the goal line?',
    title: 'Too close: the posts line up',
    explanation:
      'Very close to the goal line, both posts are almost straight ahead of her, so her two lines of sight nearly lie on top of each other. The angle between them, $\\theta$, shrinks towards $0^\\circ$ - on the goal line itself she cannot see into the goal at all.',
    code: `class Answer extends Scene {
  construct() {
    const s = 0.2, O = [-6.0, 3.1, 0];
    const p = (x, y) => [O[0] + s * x, O[1] - s * y, 0];
    const d = ValueTracker(20);
    this.d = d;
    const goal = Line(p(-2, 0), p(24, 0), { color: C.muted, stroke_width: 3 });
    const posts = VGroup(Dot(p(9, 0), { color: C.ink }), Dot(p(16, 0), { color: C.ink }));
    const run = DashedLine(p(0, 30), p(0, 0), { color: C.faint, stroke_width: 3 });
    const view = always_redraw(() => {
      const P = p(0, d.get_value());
      return VGroup(
        Line(P, p(9, 0), { color: C.accent, stroke_width: 3 }),
        Line(P, p(16, 0), { color: C.accent, stroke_width: 3 }),
        Dot(P, { color: C.ink, radius: 0.1 }),
      );
    });
    const theta = () => (Math.atan(16 / d.get_value()) - Math.atan(9 / d.get_value())) * 180 / Math.PI;
    const readout = always_redraw(() =>
      MathTex(\`\\\\theta = \${theta().toFixed(1)}^\\\\circ\`, { font_size: 44, color: C.accent }).move_to([3.4, 2.2, 0]));
    const note = VGroup(
      Text('Close to the goal line,', { font_size: 26, color: C.ink }),
      Text('both posts are almost', { font_size: 26, color: C.ink }),
      Text('straight ahead of her.', { font_size: 26, color: C.ink }),
    ).arrange(DOWN, { aligned_edge: LEFT }).move_to([3.4, 0.2, 0]);
    this.add(goal, run, posts, view, readout);
    this.play(d.animate.set_value(12), { run_time: 2 });
    this.wait(0.5);
    this.play(d.animate.set_value(0.8), { run_time: 3 });
    this.play(FadeIn(note));
    this.wait(1.5);
  }
}
function setup(scene, ui) {
  const s = 0.2, O = [-6.0, 3.1, 0];
  ui.add_handle({
    tracker: scene.d, label: 'distance from the goal line',
    from_value: (v) => [O[0], O[1] - s * v, 0],
    to_value: (pt) => Math.min(29, Math.max(0.3, (O[1] - pt[1]) / s)),
    step: 0.5,
  });
}`,
    checks: [{ label: 'angle at 12 m', value: 16.26, expr: '(Math.atan(16/12) - Math.atan(9/12)) * 180 / Math.PI' }],
    followups: ['What is the largest angle she can get?', 'Why does the angle also shrink far away?'],
  },
  {
    question: 'What is the inscribed angle theorem?',
    title: 'Same arc, same angle',
    explanation:
      'Pick two points $A$ and $B$ on a circle. From **any** point $P$ on the big arc, the angle $\\angle APB$ is the same - exactly half the central angle $\\angle AOB$. Move $P$ and watch the angle stay put.',
    code: `class Answer extends Scene {
  construct() {
    const O = [-2.6, -0.2, 0], R = 2.6;
    const at = (deg) => [O[0] + R * Math.cos(deg * DEGREES), O[1] + R * Math.sin(deg * DEGREES), 0];
    const A = at(225), B = at(315);
    const t = ValueTracker(60);
    this.t = t;
    const circle = Circle({ radius: R, color: C.ink, stroke_width: 3 }).move_to(O);
    const chord = Line(A, B, { color: C.gold, stroke_width: 5 });
    const center = Dot(O, { color: C.ink, radius: 0.06 });
    const central = VGroup(Line(O, A, { color: C.coral, stroke_width: 3 }), Line(O, B, { color: C.coral, stroke_width: 3 }));
    const inscribed = always_redraw(() => {
      const P = at(t.get_value());
      return VGroup(Line(P, A, { color: C.accent, stroke_width: 3 }), Line(P, B, { color: C.accent, stroke_width: 3 }), Dot(P, { color: C.accent, radius: 0.09 }));
    });
    const ins = MathTex('\\\\angle APB = 45^\\\\circ', { font_size: 40, color: C.accent }).move_to([3.6, 1.2, 0]);
    const cen = MathTex('\\\\angle AOB = 90^\\\\circ', { font_size: 40, color: C.coral }).move_to([3.6, 0.2, 0]);
    const rule = MathTex('\\\\angle APB = \\\\tfrac{1}{2}\\\\,\\\\angle AOB', { font_size: 40, color: C.ink }).move_to([3.6, -1.0, 0]);
    this.play(Create(circle), Create(chord), FadeIn(center));
    this.play(Create(inscribed), Write(ins));
    this.play(t.animate.set_value(150), { run_time: 2.5 });
    this.play(t.animate.set_value(20), { run_time: 2.5 });
    this.play(Create(central), Write(cen));
    this.play(Write(rule));
    this.wait(1.5);
  }
}
function setup(scene, ui) {
  const O = [-2.6, -0.2, 0], R = 2.6;
  ui.add_handle({
    tracker: scene.t, label: 'point P on the circle',
    from_value: (v) => [O[0] + R * Math.cos(v * DEGREES), O[1] + R * Math.sin(v * DEGREES), 0],
    to_value: (pt) => {
      let a = Math.atan2(pt[1] - O[1], pt[0] - O[0]) / DEGREES;
      if (a < -45) a += 360;
      return Math.min(210, Math.max(-30, a));
    },
    step: 3,
  });
}`,
    checks: [{ label: 'inscribed angle for a 90° central angle', value: 45, expr: '90 / 2' }],
    followups: ['How does this find the best place to shoot?', 'What happens if P is on the small arc?'],
  },
  {
    question: 'Why is the best distance the geometric mean and not the average?',
    title: 'Geometric mean, not average',
    explanation:
      'The best distance satisfies $d^2 = a\\cdot b$: the square with side $d$ has the same area as the $a \\times b$ rectangle. For $9$ and $16$ that gives $d = \\sqrt{144} = 12$, a little less than the average $12.5$ - and $\\theta(12) \\approx 16.26^\\circ$ beats $\\theta(12.5) \\approx 16.25^\\circ$.',
    code: `class Answer extends Scene {
  construct() {
    const u = 0.22;
    const rect = Rectangle({ width: 16 * u, height: 9 * u, color: C.gold, fill_opacity: 0.15, stroke_width: 3 }).move_to([-3.6, 0.6, 0]);
    const sq = Square({ side_length: 12 * u, color: C.accent, fill_opacity: 0.15, stroke_width: 3 }).move_to([1.2, 0.6, 0]);
    const rl = MathTex('9 \\\\times 16 = 144', { font_size: 34, color: C.gold }).next_to(rect, DOWN, { buff: 0.3 });
    const sl = MathTex('12 \\\\times 12 = 144', { font_size: 34, color: C.accent }).next_to(sq, DOWN, { buff: 0.3 });
    const mean = MathTex('d = \\\\sqrt{ab} = 12', { font_size: 40, color: C.accent }).move_to([4.8, 1.6, 0]);
    const avg = MathTex('\\\\tfrac{a+b}{2} = 12.5', { font_size: 40, color: C.muted }).move_to([4.8, 0.6, 0]);
    const cmp = MathTex('\\\\theta(12) > \\\\theta(12.5)', { font_size: 40, color: C.ink }).move_to([4.8, -0.6, 0]);
    this.play(Create(rect), Write(rl));
    this.play(Create(sq), Write(sl));
    this.wait(0.5);
    this.play(Write(mean));
    this.play(Write(avg));
    this.play(Write(cmp));
    this.wait(1.5);
  }
}`,
    checks: [
      { label: 'sqrt(9*16)', value: 12, expr: 'Math.sqrt(9*16)' },
      { label: 'angle at 12', value: 16.26, expr: '(Math.atan(16/12)-Math.atan(9/12))*180/Math.PI' },
      { label: 'angle at 12.5', value: 16.25, expr: '(Math.atan(16/12.5)-Math.atan(9/12.5))*180/Math.PI' },
    ],
    followups: ['Where does d² = ab come from?', 'Is the geometric mean always smaller than the average?'],
  },
  {
    question: 'What if the goal were wider?',
    title: 'Move the far post',
    explanation:
      'The best distance is $d = \\sqrt{a\\,b}$. Keep the near post at $a = 9$ and drag the far post $b$: a wider goal pushes the best spot further out, but more slowly than the goal grows, because of the square root.',
    code: `class Answer extends Scene {
  construct() {
    const s = 0.16, O = [-6.2, 3.0, 0];
    const p = (x, y) => [O[0] + s * x, O[1] - s * y, 0];
    const b = ValueTracker(16);
    this.b = b;
    const goal = Line(p(-2, 0), p(36, 0), { color: C.muted, stroke_width: 3 });
    const run = DashedLine(p(0, 38), p(0, 0), { color: C.faint, stroke_width: 3 });
    const near = Dot(p(9, 0), { color: C.ink });
    const far = always_redraw(() => Dot(p(b.get_value(), 0), { color: C.coral, radius: 0.1 }));
    const best = () => Math.sqrt(9 * b.get_value());
    const view = always_redraw(() => {
      const P = p(0, best());
      return VGroup(Line(P, p(9, 0), { color: C.accent, stroke_width: 3 }), Line(P, p(b.get_value(), 0), { color: C.accent, stroke_width: 3 }), Dot(P, { color: C.accent, radius: 0.1 }));
    });
    const lab = always_redraw(() => MathTex(\`b = \${b.get_value().toFixed(1)},\\\\quad d = \\\\sqrt{9b} = \${best().toFixed(2)}\`, { font_size: 36, color: C.ink }).move_to([3.3, 1.8, 0]));
    this.add(goal, run, near, far, view, lab);
    this.play(b.animate.set_value(30), { run_time: 3 });
    this.play(b.animate.set_value(12), { run_time: 3 });
    this.play(b.animate.set_value(16), { run_time: 1.5 });
    this.wait(1);
  }
}
function setup(scene, ui) {
  const s = 0.16, O = [-6.2, 3.0, 0];
  ui.add_handle({
    tracker: scene.b, label: 'far post',
    from_value: (v) => [O[0] + s * v, O[1], 0],
    to_value: (pt) => Math.min(36, Math.max(10, (pt[0] - O[0]) / s)),
    step: 0.5,
  });
}`,
    checks: [{ label: 'best d for b = 25', value: 15, expr: 'Math.sqrt(9*25)' }],
    followups: ['Does the best angle get bigger with a wider goal?', 'What if she runs closer to the near post?'],
  },
  {
    question: 'Where does the crust length 2πr come from?',
    title: 'Unrolling the crust',
    explanation:
      'Straighten the crust of a pizza with radius $r$ and measure it with the diameter $d = 2r$: it is a bit more than 3 diameters - that ratio is $\\pi \\approx 3.14$. So the crust is $\\pi d = 2\\pi r$.',
    code: `class Answer extends Scene {
  construct() {
    const r = 1;
    const c0 = [-4.2, 1.3, 0];
    const crust = Circle({ radius: r, color: C.coral, stroke_width: 7 }).move_to(c0);
    const dia = Line([c0[0] - r, c0[1], 0], [c0[0] + r, c0[1], 0], { color: C.accent, stroke_width: 5 });
    const dl = MathTex('d', { font_size: 36, color: C.accent }).next_to(dia, UP, { buff: 0.1 });
    this.play(Create(crust));
    this.play(Create(dia), Write(dl));
    const L = 2 * Math.PI * r, x0 = -5.6, y = -1.0;
    const straight = Line([x0, y, 0], [x0 + L, y, 0], { color: C.coral, stroke_width: 7 });
    this.play(Transform(crust.copy(), straight), { run_time: 2 });
    const ds = VGroup(...[0, 1, 2].map((k) => Line([x0 + 2 * k * r, y - 0.35, 0], [x0 + 2 * (k + 1) * r - 0.04, y - 0.35, 0], { color: C.accent, stroke_width: 6 })));
    this.play(LaggedStart(...ds.submobjects.map((m) => Create(m)), { lag_ratio: 0.6 }), { run_time: 2 });
    const left = MathTex('\\\\approx 0.14\\\\,d', { font_size: 30, color: C.muted }).next_to([x0 + L, y - 0.35, 0], DOWN, { buff: 0.2 });
    this.play(FadeIn(left));
    const t1 = MathTex('C = \\\\pi\\\\, d', { font_size: 48, color: C.ink }).move_to([3.4, 1.5, 0]);
    const t2 = MathTex('= 2\\\\pi r', { font_size: 48, color: C.coral }).move_to([3.4, 0.5, 0]);
    const t3 = MathTex('\\\\pi \\\\approx 3.14 \\\\text{ diameters}', { font_size: 32, color: C.muted }).move_to([3.4, -0.6, 0]);
    this.play(Write(t1));
    this.play(Write(t2));
    this.play(FadeIn(t3));
    this.wait(1.5);
  }
}`,
    checks: [{ label: 'π', value: 3.14, expr: 'Math.PI' }],
    followups: ['Why is π the same for every circle?', 'How long is the crust of a 16-inch pizza?'],
  },
  {
    question: 'Is a 12-inch pizza more than two 6-inch pizzas?',
    title: 'One big or two small?',
    explanation:
      'A 12-inch pizza has radius 6: area $\\pi \\cdot 6^2 \\approx 113$ in². A 6-inch pizza has radius 3: $\\pi \\cdot 3^2 \\approx 28$ in², so two make about 57 in². Halving the diameter quarters the area - one 12-inch pizza is **twice** two 6-inch ones. Drag the slider to try other sizes.',
    code: `class Answer extends Scene {
  construct() {
    const D = ValueTracker(12);
    this.D = D;
    const k = 0.17;
    const pizza = (r, at) => Circle({ radius: r, stroke_color: '#C98A2E', stroke_width: 5, fill_color: '#F2C063', fill_opacity: 1 }).move_to(at);
    this.add(always_redraw(() => {
      const d = D.get_value();
      const rs = (d / 4) * k;
      return VGroup(pizza((d / 2) * k, [-4.6, 0.9, 0]), pizza(rs, [-1.9, 0.9 + rs + 0.06, 0]), pizza(rs, [-1.9, 0.9 - rs - 0.06, 0]));
    }));
    const big = DecimalNumber(113.1, { num_decimal_places: 0, font_size: 40, color: C.ink });
    const small = DecimalNumber(56.5, { num_decimal_places: 0, font_size: 40, color: C.ink });
    const dv = DecimalNumber(12, { num_decimal_places: 0, font_size: 40, color: C.accent });
    const rows = VGroup(
      VGroup(MathTex('\\\\text{big: } D =', { font_size: 36, color: C.accent }), dv, MathTex('\\\\text{in}', { font_size: 32, color: C.muted })),
      VGroup(MathTex('\\\\text{area} \\\\approx', { font_size: 36, color: C.ink }), big, MathTex('\\\\text{in}^2', { font_size: 32, color: C.muted })),
      VGroup(MathTex('\\\\text{two of } \\\\tfrac{D}{2} \\\\approx', { font_size: 36, color: C.ink }), small, MathTex('\\\\text{in}^2', { font_size: 32, color: C.muted })),
    );
    const place = () => {
      rows.submobjects.forEach((row, i) => row.arrange(RIGHT, { buff: 0.15 }).move_to([1.2, 1.8 - i * 0.9, 0], { aligned_edge: LEFT }));
    };
    rows.add_updater(() => {
      const d = D.get_value();
      dv.set_value(d);
      big.set_value(Math.PI * (d / 2) ** 2);
      small.set_value(2 * Math.PI * (d / 4) ** 2);
      place();
    });
    place();
    this.add(rows);
    const verdict = MathTex('\\\\text{always } 2\\\\times', { font_size: 44, color: C.good }).move_to([3.2, -1.2, 0]);
    this.slider = Slider(D, { x_range: [6, 20], length: 4, color: C.accent, track_color: '#C9CBD3', label: 'D', decimals: 0, font_size: 32 }).move_to([-3.0, -2.6, 0]);
    this.add(this.slider);
    this.play(D.animate.set_value(18), { run_time: 2 });
    this.play(D.animate.set_value(8), { run_time: 2 });
    this.play(D.animate.set_value(12), { run_time: 1.5 });
    this.play(Write(verdict));
    this.wait(1);
  }
}
function setup(scene, ui) {
  scene.slider.attach(ui, { snap: 1, label: 'the size slider', step: 1 });
}`,
    checks: [
      { label: 'area of a 12-inch pizza', value: 113.1, expr: 'Math.PI * 36' },
      { label: 'two 6-inch pizzas', value: 56.5, expr: '2 * Math.PI * 9' },
    ],
    followups: ['What if it were three small pizzas?', 'How big must one pizza be to equal two 12-inch pizzas?'],
  },
];

/** Recorded answers as provider responses (JSON strings), keyed by normalised question. */
export function recorded_responses(key: (q: string) => string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of RECORDED) {
    const { question, ...answer } = r;
    out[key(question)] = JSON.stringify(answer);
  }
  return out;
}
