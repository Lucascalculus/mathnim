// E3 Distillation and merging. Left: a big teacher and a small student; what passes between them is the teacher's
// whole distribution over the next token (the small bars), not just its answer. Right: two fine-tunes of the same base
// as vectors from it (cobalt, teal), merged by adding them (violet dashes). Seen from the front at rest.
import { PIG, box, render, ring_dot, turned, type Solid, type V3 } from '../../course_worlds';
import { say, type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame, ink, stack, words } from './_ft';

const P = [0.15, 0.55, 0.9, 0.35, 0.2, 0.1];
const world: LessonWorld = {
  view: 'front',
  draw(ctx, w, h, st) {
    const cam = turned(st.top, true), S: Solid[] = [];
    const t = stack(-3.4, 0, 8, { w: 2.0, d: 1.4, gap: 0.3 }), s = stack(0.2, 0, 4, { w: 1.1, d: 0.8, gap: 0.3 });
    S.push(...t.solids, ...s.solids);
    P.forEach((p, i) => S.push(box(-2.05 + i * 0.22, 1.55, -0.07, -1.9 + i * 0.22, 1.55 + p * 0.7, 0.07, { pig: 'violet', k: 1, tint: 0.5, shadow: false })));
    S.push(box(1.7, 0, -0.04, 4.5, 2.2, 0.04, { kind: 'wire', pig: 'graphite', solid: 1, alpha: 0.35 }));
    frame(cam, S, w, h, [12, 12, 12, 22], [[0, -0.42, 0]]);
    render(ctx, cam, S);
    arrow3(ctx, cam, [-2.25, 1.35, 0.7], [-0.45, 0.85, 0.7], PIG.violet, 1.2, 0.8);
    const o: V3 = [2.15, 0.4, 0.05], a: V3 = [3.35, 0.75, 0.05], b: V3 = [2.6, 1.55, 0.05], c: V3 = [3.8, 1.9, 0.05];
    ink(ctx, cam, [a, c, b], PIG.graphite_t, 0.8, 0.5, true);
    arrow3(ctx, cam, o, a, PIG.cobalt, 1.6, 0.95);
    arrow3(ctx, cam, o, b, PIG.teal, 1.6, 0.95);
    arrow3(ctx, cam, o, c, PIG.violet, 1.4, 0.9, true);
    const p = cam.p(o); ring_dot(ctx, p[0], p[1], 3.5, PIG.ink, 1, 1.2);
    words(ctx, cam, say(st, 'teacher', '教师'), [-3.4, -0.4, 0.7], PIG.graphite_t, 10.5, 'center', 0.95, 500);
    words(ctx, cam, say(st, 'student', '学生'), [0.2, -0.4, 0.4], PIG.ink, 10.5);
    words(ctx, cam, say(st, 'merge', '合并'), [3.1, -0.4, 0.05], PIG.violet, 10.5);
  },
};
export default world;
