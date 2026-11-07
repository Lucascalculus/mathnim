// Reference models: OSI (seven layers), the five layers we use, and TCP/IP (four), side by side at the same heights
// so you can see which matches which: the top three of OSI fold into one application layer, the bottom two of TCP/IP
// into one link layer. Seen from the front at rest.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { say, type LessonWorld } from '../../lesson_worlds';
import { frame, ink, words } from '../_kit';

const H = 3.5;
// each model: x, name, its layers as [from, to] in eighths of the height
const MODELS: [number, string, string, [number, number][]][] = [
  [0, 'OSI', 'OSI', [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]]],
  [2.0, 'five layers', '五层', [[0, 1], [1, 2], [2, 3], [3, 4], [4, 7]]],
  [4.0, 'TCP/IP', 'TCP/IP', [[0, 2], [2, 3], [3, 4], [4, 7]]],
];
const world: LessonWorld = {
  view: 'front',
  draw(ctx, w, h, st) {
    const cam = turned(st.top, true), S: Solid[] = [], u = H / 7;
    for (const [x, , , L] of MODELS) L.forEach(([a, b], i) => S.push(box(x - 0.65, a * u, -0.45, x + 0.65, b * u - 0.06, 0.45, { pig: 'violet', k: 1, tint: 0.1 + 0.06 * i, shade: 0.6 })));
    frame(cam, S, w, h, [12, 12, 12, 22], [[2, -0.4, 0]]);
    render(ctx, cam, S);
    for (const k of [1, 2, 3, 4]) ink(ctx, cam, [[0.65, k * u - 0.03, 0.46], [3.35, k * u - 0.03, 0.46]], PIG.graphite_t, 0.8, 0.4, true);
    for (const [x, en, zh] of MODELS) words(ctx, cam, say(st, en, zh), [x, -0.35, 0.45], PIG.ink, 10.5);
  },
};
export default world;
