// The best straight line, and how good it is: the data (dots), the line of least squares (cobalt), and each point's
// miss as a square on its residual (ochre): the line is the one that makes the total of those squares smallest. Seen
// from above at rest; in the world, the squares rise as the amounts the line minimises.
import { PIG, extrude, render, ring_dot, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { card_ink, frame, panel, type QP } from '../_kit';

const PTS: QP[] = [[0.08, 0.22], [0.17, 0.2], [0.26, 0.38], [0.35, 0.33], [0.44, 0.52], [0.53, 0.44], [0.62, 0.62], [0.71, 0.56], [0.8, 0.75], [0.9, 0.7]];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), P = panel(0, 0, 5.6, 4.1);
    const n = PTS.length, mx = PTS.reduce((s, p) => s + p[0], 0) / n, my = PTS.reduce((s, p) => s + p[1], 0) / n;
    const b = PTS.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / PTS.reduce((s, p) => s + (p[0] - mx) ** 2, 0), a = my - b * mx, f = (x: number) => a + b * x;
    const S: Solid[] = [P.card];
    const kx = (5.6 - 1.1) / (4.1 - 0.9); // (a square on the card: as wide as it is tall)
    for (const [x, y] of PTS) { const r = y - f(x), s = Math.abs(r), x1 = x + (r > 0 ? -1 : 1) * s / kx; S.push(extrude([P.at(x, f(x), 0.05), P.at(x, y, 0.05), P.at(x1, y, 0.05), P.at(x1, f(x), 0.05)], [0, 0.004 + 0.3 * u, 0], { pig: 'ochre', k: 1, tint: 0.4, shade: 0.6 })); }
    const over = card_ink(P, cam, u, (c, k) => { P.axes(c, cam, k, ['x', 'y']); P.line(c, cam, [[0, f(0)], [1, f(1)]], PIG.cobalt, 1.8, k); });
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    over(ctx);
    for (const [x, y] of PTS) { const p = cam.p(P.at(x, y, 0.06)); ring_dot(ctx, p[0], p[1], 3, PIG.ink, 1, 1); }
  },
};
export default world;
