// B4 Forgetting: the base model (left) and the same model after fine-tuning (right), some of its layers pushed aside;
// the old abilities sitting on top of the base (small blocks) are partly gone from the tuned one (dashes). A leash
// between them, KL to the base, says how far it moved and predicts how much it forgets. Seen from the front at rest.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { say, type LessonWorld } from '../../lesson_worlds';
import { frame, ink, stack, words } from './_ft';

const SHIFT = [0, 0, 0.1, 0.3, 0.45, 0.35, 0.2];
const world: LessonWorld = {
  view: 'front',
  draw(ctx, w, h, st) {
    const cam = turned(st.top, true), S: Solid[] = [];
    const a = stack(-1.9, 0, 7, { w: 2.0, d: 1.4 }), b = stack(1.9, 0, 7, { w: 2.0, d: 1.4 });
    S.push(...a.solids);
    b.solids.forEach((_, i) => S.push(box(1.9 - 1.0 + SHIFT[i], b.y(i), -0.7, 1.9 + 1.0 + SHIFT[i], b.y(i) + 0.13, 0.7, { shade: 0.5, pig: SHIFT[i] > 0.15 ? 'cobalt' : undefined, k: 1, tint: 0.25 + SHIFT[i] })));
    const skills = [-2.6, -2.15, -1.7, -1.25];
    skills.forEach((x) => S.push(box(x - 0.17, a.top, -0.17, x + 0.17, a.top + 0.32, 0.17, { pig: 'teal', k: 1, tint: 0.5 })));
    skills.forEach((x, i) => S.push(box(x + 3.8 - 0.17 + 0.2, b.top, -0.17, x + 3.8 + 0.17 + 0.2, b.top + 0.32, 0.17, i % 2 ? { kind: 'wire', pig: 'teal', solid: 0, alpha: 0.7 } : { pig: 'teal', k: 1, tint: 0.5 })));
    frame(cam, S, w, h, [12, 22, 12, 12], [[0, a.top + 1.1, 0], [0, -0.5, 0]]);
    render(ctx, cam, S);
    const arc = Array.from({ length: 25 }, (_, i) => { const t = i / 24; return [-1.9 + 3.8 * t, a.top + 0.55 + 0.45 * Math.sin(Math.PI * t), 0.7] as [number, number, number]; });
    ink(ctx, cam, arc, PIG.ink, 1, 0.6, true);
    words(ctx, cam, 'KL', [0, a.top + 1.12, 0.7], PIG.ink, 11.5);
    words(ctx, cam, say(st, 'base', '原模型'), [-1.9, -0.32, 0.7], PIG.graphite_t, 10.5, 'center', 0.95, 500);
    words(ctx, cam, say(st, 'fine-tuned', '微调后'), [2.1, -0.32, 0.7], PIG.cobalt, 10.5);
  },
};
export default world;
