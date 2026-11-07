// What a firm owes its community, and when it pays: what is good for the business (cobalt) and what is good for the
// community (teal) as two discs; where they overlap is shared value, the responsibility that also pays. Seen from above
// at rest; in the world, the overlap rises.
import { PIG, extrude, render, turned, type Solid, type V3 } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { disc, frame, words } from '../_kit';

const A: [number, number] = [0, 0], B: [number, number] = [2.0, 0], R = 1.55;
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [disc(A, R, 0.05, { pig: 'cobalt', k: 1, tint: 0.25, bias: -2 }), disc(B, R, 0.05, { pig: 'teal', k: 1, tint: 0.25, bias: -2 })];
    // the lens where the two discs overlap
    const d = (B[0] - A[0]) / 2, half = Math.acos(d / R), lens: V3[] = [];
    for (let i = 0; i <= 20; i++) { const t = -half + (2 * half * i) / 20; lens.push([A[0] + R * Math.cos(t), 0.05, A[1] + R * Math.sin(t)]); }
    for (let i = 0; i <= 20; i++) { const t = Math.PI - half + (2 * half * i) / 20; lens.push([B[0] + R * Math.cos(t), 0.05, B[1] + R * Math.sin(t)]); }
    S.push(extrude(lens, [0, 0.01 + 0.4 * u, 0], { pig: 'viridian', k: 1, tint: 0.45, shade: 0.6 }));
    frame(cam, S, w, h, [12, 12, 12, 22], [[1, 0, R + 0.5]]);
    render(ctx, cam, S);
    words(ctx, cam, say(st, 'business', '企业'), [-0.6, 0.06, 0.1], PIG.cobalt, 11);
    words(ctx, cam, say(st, 'community', '社区'), [2.6, 0.06, 0.1], PIG.teal, 11);
    words(ctx, cam, say(st, 'shared value', '共享价值'), [1.0, 0.06, R + 0.42], PIG.viridian, 10.5);
  },
};
export default world;
