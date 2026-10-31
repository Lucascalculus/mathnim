// A recorded lesson generation (plan + scenes) for "Inscribed angles", so the
// syllabus -> lesson flow works offline. Served by MockProvider.
import type { LessonPlan, SyllabusEntry } from './generate';
import { RECORDED } from './recorded';

export const INSCRIBED_ENTRY: SyllabusEntry = {
  id: 'inscribed-angles',
  title: 'Inscribed angles',
  unit: 'Angles and circles',
  level: 'Grade 9-10',
  objectives: [
    'An inscribed angle stays the same as its vertex moves along the same arc.',
    'An inscribed angle is half the central angle on the same arc.',
    'An angle in a semicircle is a right angle.',
  ],
};

const SETUP_CODE = `class Answer extends Scene {
  construct() {
    const O = [-2.6, -0.2, 0], R = 2.6;
    const at = (deg) => [O[0] + R * Math.cos(deg * DEGREES), O[1] + R * Math.sin(deg * DEGREES), 0];
    const A = at(225), B = at(315), P = at(100);
    const circle = Circle({ radius: R, color: C.ink, stroke_width: 3 }).move_to(O);
    const chord = Line(A, B, { color: C.gold, stroke_width: 5 });
    const labels = VGroup(
      MathTex('A', { font_size: 34, color: C.gold }).next_to(A, DL, { buff: 0.12 }),
      MathTex('B', { font_size: 34, color: C.gold }).next_to(B, DR, { buff: 0.12 }),
      MathTex('P', { font_size: 34, color: C.accent }).next_to(P, UP, { buff: 0.15 }),
    );
    const sight = VGroup(Line(P, A, { color: C.accent, stroke_width: 3 }), Line(P, B, { color: C.accent, stroke_width: 3 }), Dot(P, { color: C.accent, radius: 0.09 }));
    const value = MathTex('\\\\angle APB = 45^\\\\circ', { font_size: 42, color: C.accent }).move_to([3.6, 0.8, 0]);
    this.play(Create(circle));
    this.play(Create(chord), FadeIn(labels));
    this.play(Create(sight));
    this.play(Write(value));
    this.wait(1);
  }
}`;

const SEMICIRCLE_CODE = `class Answer extends Scene {
  construct() {
    const O = [-2.6, -0.3, 0], R = 2.6;
    const at = (deg) => [O[0] + R * Math.cos(deg * DEGREES), O[1] + R * Math.sin(deg * DEGREES), 0];
    const A = at(180), B = at(0);
    const t = ValueTracker(120);
    this.t = t;
    const circle = Circle({ radius: R, color: C.ink, stroke_width: 3 }).move_to(O);
    const diameter = Line(A, B, { color: C.gold, stroke_width: 5 });
    const center = Dot(O, { color: C.ink, radius: 0.06 });
    const tri = always_redraw(() => {
      const P = at(t.get_value());
      const l1 = Line(P, A, { color: C.accent, stroke_width: 3 }), l2 = Line(P, B, { color: C.accent, stroke_width: 3 });
      return VGroup(l1, l2, RightAngle(l1, l2, { length: 0.3, color: C.coral }), Dot(P, { color: C.accent, radius: 0.09 }));
    });
    const central = MathTex('\\\\angle AOB = 180^\\\\circ', { font_size: 40, color: C.gold }).move_to([3.7, 1.0, 0]);
    const half = MathTex('\\\\angle APB = 90^\\\\circ', { font_size: 40, color: C.coral }).move_to([3.7, 0.0, 0]);
    this.play(Create(circle), Create(diameter), FadeIn(center));
    this.play(Write(central));
    this.play(Create(tri), Write(half));
    this.play(t.animate.set_value(40), { run_time: 2.5 });
    this.play(t.animate.set_value(150), { run_time: 2.5 });
    this.wait(1);
  }
}
function setup(scene, ui) {
  const O = [-2.6, -0.3, 0], R = 2.6;
  ui.add_handle({
    tracker: scene.t, label: 'point P on the circle',
    from_value: (v) => [O[0] + R * Math.cos(v * DEGREES), O[1] + R * Math.sin(v * DEGREES), 0],
    to_value: (p) => Math.min(175, Math.max(5, Math.atan2(p[1] - O[1], p[0] - O[0]) / DEGREES)),
    step: 3,
  });
}`;

export const INSCRIBED_PLAN: LessonPlan = {
  title: 'Inscribed angles',
  description: 'Why every point on an arc sees a chord at the same angle.',
  skills: [
    { id: 'inscribed-constant', name: 'Inscribed angles on one arc are equal' },
    { id: 'inscribed-half', name: 'Inscribed angle = half the central angle' },
    { id: 'thales', name: 'Angle in a semicircle' },
  ],
  misconceptions: [
    { id: 'closer-bigger', description: 'The angle gets bigger as P gets closer to A or B.' },
    { id: 'equal-central', description: 'The inscribed angle equals the central angle.' },
  ],
  steps: [
    { kind: 'scene', id: 'setup', chapter: 'Same arc, same angle', title: 'A view from the circle', narration: 'A and B sit on a circle. From P, the chord AB is seen at 45 degrees.', brief: 'setup' },
    {
      kind: 'checkpoint', id: 'predict-move', skill: 'inscribed-constant', purpose: 'predict', confidence: true, reveal: 'reveal-arc',
      prompt: 'P slides along the big arc towards $A$. What happens to $\\angle APB$?',
      question: {
        type: 'choice', options: [
          { id: 'grows', label: 'It grows as P gets close to A', misconception: 'closer-bigger' },
          { id: 'same', label: 'It stays 45°', correct: true },
          { id: 'shrinks', label: 'It shrinks', misconception: 'closer-bigger' },
        ],
      },
    },
    { kind: 'scene', id: 'reveal-arc', title: 'Watch it stay put', narration: 'Wherever P goes on the big arc, the angle stays 45 degrees - half the central angle.', brief: 'reveal' },
    {
      kind: 'checkpoint', id: 'central', chapter: 'Half the central angle', skill: 'inscribed-half', purpose: 'check',
      prompt: 'The central angle $\\angle AOB$ is $130^\\circ$. What is the inscribed angle $\\angle APB$ (in degrees)?',
      question: { type: 'number', answer: 65, tolerance: 0.5, unit: '°', wrong: [{ answer: 130, misconception: 'equal-central', feedback: 'That is the central angle itself.' }] },
      hints: ['Compare the two angles in the last scene: 45° and 90°.', 'The inscribed angle is half of the central one.'],
    },
    { kind: 'scene', id: 'semicircle', chapter: 'Semicircles', title: 'When AB is a diameter', narration: 'Make AB a diameter. The central angle is 180 degrees, so the angle at P is always 90.', brief: 'semicircle' },
    {
      kind: 'checkpoint', id: 'thales-q', skill: 'thales', purpose: 'practice',
      prompt: '$AB$ is a diameter and $P$ is on the circle. What is $\\angle APB$ in degrees?',
      question: { type: 'number', answer: 90, tolerance: 0.5, unit: '°', wrong: [{ answer: 180, misconception: 'equal-central' }] },
      hints: ['What is the central angle of a diameter?', 'Halve it.'],
    },
  ],
};

/** Generating INSCRIBED_ENTRY offline: the recorded plan, by the syllabus entry's id. */
export const recorded_lesson_plans = (): Record<string, string> => ({ [INSCRIBED_ENTRY.id]: JSON.stringify(INSCRIBED_PLAN) });

/** The recorded generated lesson's scenes, by their question (a scene's title and brief). */
export function recorded_lesson_responses(key: (q: string) => string): Record<string, string> {
  const out: Record<string, string> = {};
  const code: Record<string, string> = { setup: SETUP_CODE, reveal: RECORDED[1].code, semicircle: SEMICIRCLE_CODE };
  for (const s of INSCRIBED_PLAN.steps) {
    if (s.kind !== 'scene') continue;
    const q = `${s.title ?? s.id}: ${s.brief}`;
    out[key(q)] = JSON.stringify({ title: s.title, explanation: s.narration, code: code[s.brief], checks: [], followups: [] });
  }
  return out;
}
