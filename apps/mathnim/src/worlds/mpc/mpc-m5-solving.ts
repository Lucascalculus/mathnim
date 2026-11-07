// M5 Solving: one QP every sample, worst case included. Seen at rest from the front, a row of samples, each with the
// time its solve took as a column under the sample period (the line in dashes): the first tall (a cold start), the
// warm-started ones low, one near the line (a hard sample). Turning into the world, the same columns stand on their
// timeline.
import { PIG, box, label, render, seg, stroke_prov, turned } from '../../course_worlds';
import { say, type LessonWorld } from '../../lesson_worlds';
import { frame } from './_mpc';

const TIMES = [0.86, 0.42, 0.34, 0.38, 0.31, 0.8, 0.36, 0.3];
const world: LessonWorld = {
  view: 'front',
  draw(ctx, w, h, st) {
    const cam = turned(st.top, true), H = 1.6, n = TIMES.length, dx = 0.9;
    const S = [box(-0.3, 0, -0.6, n * dx, 0.06, 0.6, { shade: 0.6 })];
    TIMES.forEach((t, i) => S.push(box(i * dx + 0.08, 0.06, -0.3, i * dx + 0.62, 0.06 + t * H, 0.3, { pig: 'cobalt', k: 1, tint: 0.25 + 0.55 * t })));
    frame(cam, S, w, h, [14, 30, 14, 12], [[0, H + 0.3, 0]]);
    render(ctx, cam, S);
    // the sample period: every solve must end below it
    const a = cam.p([-0.3, H + 0.06, 0.6]), b = cam.p([n * dx, H + 0.06, 0.6]), c = cam.p([n * dx, H + 0.06, -0.6]);
    stroke_prov(ctx, seg(ctx, a[0], a[1], b[0], b[1]), PIG.ink, 0, 1, 0.7);
    if (Math.abs(c[1] - b[1]) > 2) stroke_prov(ctx, seg(ctx, b[0], b[1], c[0], c[1]), PIG.ink, 0, 1, 0.5);
    // (named in the elevation; in the world the columns say it)
    if (st.top > 0.3) label(ctx, say(st, 'one sample', '一个采样周期'), a[0], a[1] - 6, PIG.graphite_t, 11, 500, 'left', 'alphabetic', (st.top - 0.3) / 0.7);
  },
};
export default world;
