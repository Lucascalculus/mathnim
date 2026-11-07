// k nearest neighbours: a new example (hollow ring) takes the class most of its k = 5 nearest examples have: the
// circle that holds them (dashes) has three round and two square, so it is called round. Seen from above at rest; in
// the world, the five neighbours stand taller than the rest.
import { PIG, render, ring_dot, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { arc, card, frame, ink } from '../_kit';
import { cloud, form } from './_ml';

const Q: [number, number] = [3.0, 2.0];
const A = cloud(10, 13, 2.0, 1.6, 0.75), B = cloud(40, 13, 4.1, 2.5, 0.75);
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [card(0, 0, 6, 4.1, { bias: -10 })];
    const all = [...A.map((p) => [...p, 0]), ...B.map((p) => [...p, 1])].filter(([x, z]) => x > 0.25 && x < 5.75 && z > 0.25 && z < 3.85) as [number, number, number][];
    const near = [...all].sort((a, b) => Math.hypot(a[0] - Q[0], a[1] - Q[1]) - Math.hypot(b[0] - Q[0], b[1] - Q[1])).slice(0, 5), r = Math.hypot(near[4][0] - Q[0], near[4][1] - Q[1]) + 0.18;
    for (const p of all) S.push(form(p[0], p[1], p[2], near.includes(p) ? 0.2 + 0.4 * u : 0.2));
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    ink(ctx, cam, arc(Q, r, 0, Math.PI * 2, 72, 0.052), PIG.ink, 1.1, 0.7, true);
    const q = cam.p([Q[0], 0.06, Q[1]]); ring_dot(ctx, q[0], q[1], 5.5, PIG.cobalt, 0, 1.8);
  },
};
export default world;
