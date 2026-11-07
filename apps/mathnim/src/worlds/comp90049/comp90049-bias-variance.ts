// Bias, variance and learning curves: four targets, a model's predictions from many training sets as shots (dots).
// Bias is how far their centre lands from the bullseye (rows), variance how widely they scatter (columns): low bias and
// low variance (top left) is the goal. Seen from above at rest; in the world, the targets stand thick.
import { PIG, render, ring_dot, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { arc, disc, frame, ink, words } from '../_kit';
import { cloud } from './_ml';

const R = 1.0, G = 2.5;
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [], th = 0.05 + 0.15 * u;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) S.push(disc([j * G, i * G], R, th, { shade: 0.6 }));
    frame(cam, S, w, h, [64, 26, 12, 12], [[-1.2, 0, -1.4]]);
    render(ctx, cam, S);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const c: [number, number] = [j * G, i * G];
      for (const r of [R * 0.66, R * 0.33]) ink(ctx, cam, arc(c, r, 0, Math.PI * 2, 48, th + 0.002), PIG.ink, 0.8, 0.35);
      const b = i ? 0.42 : 0, s = j ? 0.3 : 0.09;
      for (const [x, z] of cloud(300 + i * 40 + j * 20, 9, c[0] + b * 0.7, c[1] - b * 0.7, s)) { const p = cam.p([x, th + 0.003, z]); ring_dot(ctx, p[0], p[1], 2.4, PIG.cobalt, 1, 1); }
    }
    words(ctx, cam, say(st, 'low variance', '低方差'), [0, th, -R - 0.3], PIG.ink, 10.5);
    words(ctx, cam, say(st, 'high variance', '高方差'), [G, th, -R - 0.3], PIG.ink, 10.5);
    words(ctx, cam, say(st, 'low bias', '低偏差'), [-R - 0.2, th, 0.08], PIG.ink, 10.5, 'right');
    words(ctx, cam, say(st, 'high bias', '高偏差'), [-R - 0.2, th, G + 0.08], PIG.ink, 10.5, 'right');
  },
};
export default world;
