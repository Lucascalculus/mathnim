// An uncertain number's average, and how spread it is: its distribution as weights on a plank (bars, as tall as each
// value's chance), balanced on a fulcrum exactly at the mean μ; the spread σ marked either side of it. Seen from the
// front at rest.
import { PIG, box, extrude, render, turned, type Solid, type V3 } from '../../course_worlds';
import { type LessonWorld } from '../../lesson_worlds';
import { frame, ink, words } from '../_kit';

const P = [0.05, 0.15, 0.3, 0.25, 0.15, 0.07, 0.03], DX = 0.62, H = 3.6;
const world: LessonWorld = {
  view: 'front',
  draw(ctx, w, h, st) {
    const cam = turned(st.top, true), S: Solid[] = [], y0 = 0.62;
    const mu = P.reduce((m, p, i) => m + p * i, 0), sd = Math.sqrt(P.reduce((m, p, i) => m + p * (i - mu) ** 2, 0));
    const X = (i: number) => 0.3 + i * DX;
    S.push(box(-0.05, y0, -0.35, X(P.length - 1) + 0.35, y0 + 0.1, 0.35, { shade: 0.6 }));
    P.forEach((p, i) => S.push(box(X(i) - 0.2, y0 + 0.1, -0.2, X(i) + 0.2, y0 + 0.1 + p * H, 0.2, { pig: 'cobalt', k: 1, tint: 0.45, shade: 0.6 })));
    const fx = X(mu), tri: V3[] = [[fx - 0.4, 0, -0.3], [fx + 0.4, 0, -0.3], [fx, y0, -0.3]];
    S.push(extrude(tri, [0, 0, 0.6], { pig: 'ink', k: 1, tint: 0.35, shade: 0.7 }));
    frame(cam, S, w, h, [12, 12, 12, 12], [[X(0), -0.55, 0]]);
    render(ctx, cam, S);
    const z = 0.36, yb = -0.3;
    ink(ctx, cam, [[X(mu - sd), yb, z], [X(mu + sd), yb, z]], PIG.ink, 1.1, 0.8);
    for (const v of [mu - sd, mu + sd]) ink(ctx, cam, [[X(v), yb - 0.1, z], [X(v), yb + 0.1, z]], PIG.ink, 1.1, 0.8);
    words(ctx, cam, 'σ', [X(mu + sd) + 0.15, yb - 0.08, z], PIG.ink, 12, 'left', 0.9, 650);
    words(ctx, cam, 'μ', [fx - 0.55, y0 * 0.35, z], PIG.ink, 12.5, 'right', 0.9, 650);
  },
};
export default world;
