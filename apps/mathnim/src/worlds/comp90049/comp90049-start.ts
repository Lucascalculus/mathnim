// Start here: the exam and the map of the whole course. Six stops along one road, in the order the course takes them:
// the basics, classic classifiers, linear models, evaluation, neural networks and ensembles, beyond supervised
// learning. Seen from above at rest; in the world, the stops stand up, taller as the course goes on.
import { PIG, cylinder_y, render, turned, type Solid, type V3 } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { frame, ink, words } from '../_kit';

const STOPS: [number, number, string, string, string][] = [[0, 2.2, 'basics', '基础', 'teal'], [1.7, 0.9, 'classifiers', '分类器', 'cobalt'], [3.4, 2.0, 'linear', '线性模型', 'cobalt'], [5.1, 0.8, 'evaluation', '评估', 'ochre'], [6.8, 1.9, 'networks', '神经网络', 'violet'], [8.5, 0.7, 'beyond', '监督之外', 'viridian']];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [];
    STOPS.forEach(([x, z, , , pig], i) => S.push(cylinder_y(x, z, 0.36, 0, 0.08 + (0.15 + i * 0.1) * u, 24, { pig, k: 1, tint: 0.45 })));
    frame(cam, S, w, h, [12, 12, 12, 12], [[0, 0, 2.95], [8.5, 0, -0.05]]);
    const road: V3[] = [];
    for (let i = 0; i < STOPS.length - 1; i++) for (let t = 0; t <= 1; t += 0.1) { const a = STOPS[i], b = STOPS[i + 1], e = (1 - Math.cos(Math.PI * t)) / 2; road.push([a[0] + (b[0] - a[0]) * t, 0.01, a[1] + (b[1] - a[1]) * e]); }
    ink(ctx, cam, road, PIG.graphite_t, 2.2, 0.35);
    render(ctx, cam, S);
    STOPS.forEach(([x, z, en, zh, pig], i) => {
      const top = 0.08 + (0.15 + i * 0.1) * u;
      words(ctx, cam, String(i + 1), [x, top, z + 0.1], PIG.ink, 11, 'center', 0.85, 650);
      words(ctx, cam, say(st, en, zh), [x, 0.02, z + (z > 1.5 ? 0.75 : -0.5)], PIG[pig], 10.5);
    });
  },
};
export default world;
