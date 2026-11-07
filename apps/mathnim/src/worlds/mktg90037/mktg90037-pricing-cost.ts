// Why price is the least well used lever: on a margin of 10%, raising the price by 1% raises profit by 10%. A long
// lever on a fulcrum: a small push on the price end (+1%, cobalt) lifts the profit end a long way (+10%). Seen from the
// front at rest.
import { PIG, box, extrude, render, turned, type Solid, type V3 } from '../../course_worlds';
import { say, type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame, words } from '../_kit';

const world: LessonWorld = {
  view: 'front',
  draw(ctx, w, h, st) {
    const cam = turned(st.top, true), S: Solid[] = [], F = 0.7, ang = 0.32, L0 = -0.5, L1 = 4.5, yf = 0.7;
    S.push(extrude([[F - 0.35, 0, -0.3], [F + 0.35, 0, -0.3], [F, yf, -0.3]] as V3[], [0, 0, 0.6], { pig: 'ink', k: 1, tint: 0.35 }));
    // the plank, pivoting at the fulcrum: down on the price end (left), up on the profit end (right)
    const plank = (t: number): [number, number] => [F + (t - F) * Math.cos(ang), yf + (t - F) * Math.sin(ang)];
    const a = plank(L0), b = plank(L1), n: [number, number] = [-Math.sin(ang) * 0.12, Math.cos(ang) * 0.12];
    S.push(extrude([[a[0], a[1], -0.3], [b[0], b[1], -0.3], [b[0] + n[0], b[1] + n[1], -0.3], [a[0] + n[0], a[1] + n[1], -0.3]] as V3[], [0, 0, 0.6], { shade: 0.6 }));
    S.push(box(a[0] + 0.05, a[1] + 0.12, -0.2, a[0] + 0.45, a[1] + 0.45, 0.2, { pig: 'cobalt', k: 1, tint: 0.55 }));
    const tip = plank(L1 - 0.35);
    S.push(box(tip[0] - 0.4, tip[1] + 0.1, -0.3, tip[0] + 0.4, tip[1] + 0.9, 0.3, { pig: 'ochre', k: 1, tint: 0.45 }));
    frame(cam, S, w, h, [12, 14, 12, 12], [[a[0] - 0.4, a[1] + 1.2, 0]]);
    render(ctx, cam, S);
    arrow3(ctx, cam, [a[0] + 0.25, a[1] + 1.15, 0.3], [a[0] + 0.25, a[1] + 0.55, 0.3], PIG.cobalt, 1.4, 0.9);
    words(ctx, cam, say(st, '+1% price', '价格 +1%'), [a[0] + 0.25, a[1] + 1.3, 0.3], PIG.cobalt, 10.5);
    words(ctx, cam, say(st, '+10% profit', '利润 +10%'), [tip[0], tip[1] + 1.05, 0.3], PIG.ochre, 10.5);
  },
};
export default world;
