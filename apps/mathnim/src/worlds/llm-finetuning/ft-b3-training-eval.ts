// B3 Training curves and evaluation: a lower loss is not a better model. On a printed card, the training loss falls
// all the way (ink); the evaluation score rises, peaks and falls (cobalt): the checkpoint to keep is at its peak
// (ring), not where the loss is lowest. Seen from above at rest, the plot itself.
import { PIG, render, ring_dot, turned } from '../../course_worlds';
import { say, type LessonWorld } from '../../lesson_worlds';
import { card, curve, frame, ink, on, words } from './_ft';

const C: [number, number, number, number] = [0, 0, 6, 3.6];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const cam = turned(st.top), S = [card(...C)];
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    ink(ctx, cam, [on(C, 0.06, 0.95), on(C, 0.06, 0.06), on(C, 0.97, 0.06)], PIG.ink, 0.9, 0.7);
    const loss = (x: number) => 0.12 + 0.75 * Math.exp(-3.2 * x), score = (x: number) => 0.3 + 0.55 * Math.exp(-((x - 0.45) ** 2) / 0.07) - 0.06 * x;
    ink(ctx, cam, curve(C, (u) => loss((u - 0.06) / 0.9), 0.06, 0.96), PIG.ink, 1.5, 0.85);
    ink(ctx, cam, curve(C, (u) => score((u - 0.06) / 0.9), 0.06, 0.96), PIG.cobalt, 1.8, 0.95);
    const pk = on(C, 0.06 + 0.45 * 0.9, score(0.45)), p = cam.p(pk); ring_dot(ctx, p[0], p[1], 5, PIG.cobalt, 1, 1.5);
    words(ctx, cam, say(st, 'training loss', '训练损失'), on(C, 0.62, 0.22), PIG.ink, 10.5, 'left', 0.85, 500);
    words(ctx, cam, say(st, 'eval score', '评测分数'), on(C, 0.66, 0.62), PIG.cobalt, 10.5, 'left');
    words(ctx, cam, say(st, 'keep this one', '留这个'), on(C, 0.47, 0.93), PIG.cobalt, 10.5);
  },
};
export default world;
