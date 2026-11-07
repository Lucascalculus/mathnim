// How to say what a pile of numbers looks like: the numbers as a histogram (bars, seen from the front), its centre and
// its spread: the mean (ink) pulled right by the long tail, past the median (dashes), and above it the box plot, the
// middle half of the data in a box. Seen from the front at rest.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { say, type LessonWorld } from '../../lesson_worlds';
import { frame, ink, words } from '../_kit';

const H = [0.35, 0.9, 1.45, 1.7, 1.4, 1.0, 0.72, 0.5, 0.36, 0.25, 0.16, 0.1], DX = 0.42;
const world: LessonWorld = {
  view: 'front',
  draw(ctx, w, h, st) {
    const cam = turned(st.top, true), S: Solid[] = [];
    H.forEach((v, i) => S.push(box(i * DX, 0, -0.3, i * DX + DX - 0.05, v, 0.3, { pig: 'cobalt', k: 1, tint: 0.4, shade: 0.6 })));
    const by = 2.15, q1 = 1.0, med = 1.55, q3 = 2.35, lo = 0.1, hi = 4.4, mean = 1.85;
    S.push(box(q1, by - 0.16, -0.1, q3, by + 0.16, 0.1, { shade: 0.6 }));
    frame(cam, S, w, h, [12, 14, 12, 14], [[0, by + 0.6, 0], [hi, 0, 0]]);
    render(ctx, cam, S);
    const z = 0.31;
    ink(ctx, cam, [[lo, by, z], [q1, by, z]], PIG.ink, 1, 0.8); ink(ctx, cam, [[q3, by, z], [hi, by, z]], PIG.ink, 1, 0.8);
    ink(ctx, cam, [[med, by - 0.16, z], [med, by + 0.16, z]], PIG.ink, 1.6, 0.9);
    ink(ctx, cam, [[med, 0, z], [med, by - 0.2, z]], PIG.ink, 1, 0.6, true);
    ink(ctx, cam, [[mean, 0, z], [mean, by - 0.25, z]], PIG.ink, 1.6, 0.9);
    words(ctx, cam, say(st, 'mean', '均值'), [mean + 0.1, 1.85, z], PIG.ink, 10.5, 'left');
    words(ctx, cam, say(st, 'median', '中位数'), [med - 0.1, 1.85, z], PIG.graphite_t, 10.5, 'right', 0.95, 500);
  },
};
export default world;
