// A window over a satellite link, throughput and sequence numbers: the signal goes up to the satellite and down again,
// a quarter of a second each way. To keep the link busy, the sender must have that much data in flight at once (the
// packets filling the path, violet): the window must cover the round trip. Seen from the front at rest.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { type LessonWorld } from '../../lesson_worlds';
import { frame, ink } from '../_kit';
import { packet } from './_it';

const world: LessonWorld = {
  view: 'front',
  draw(ctx, w, h, st) {
    const cam = turned(st.top, true), S: Solid[] = [], A: [number, number] = [0, 0], B: [number, number] = [6, 0], T: [number, number] = [3, 3.2];
    S.push(box(-0.4, 0, -0.3, 0.4, 0.5, 0.3, { shade: 0.6 }), box(5.6, 0, -0.3, 6.4, 0.5, 0.3, { shade: 0.6 }), box(2.6, 3.1, -0.15, 3.4, 3.4, 0.15, { pig: 'ink', k: 1, tint: 0.35 }), box(1.9, 3.2, -0.05, 2.6, 3.3, 0.05, { pig: 'cobalt', k: 1, tint: 0.5 }), box(3.4, 3.2, -0.05, 4.1, 3.3, 0.05, { pig: 'cobalt', k: 1, tint: 0.5 }));
    for (let k = 1; k <= 5; k++) { const t = k / 6, up = t < 0.5, s = up ? t * 2 : (t - 0.5) * 2, p0 = up ? A : T, p1 = up ? T : B; const x = p0[0] + (p1[0] - p0[0]) * s, y = 0.5 + (p0[1] + (p1[1] - p0[1]) * s) * 0.9; const pk = packet(x, 0, 0, 0); for (const q of pk.pts) { q[1] += y - 0.08; } pk.c[1] += y; S.push(pk); }
    frame(cam, S, w, h, [12, 12, 12, 12]);
    ink(ctx, cam, [[0.2, 0.55, 0], [2.9, 3.1, 0], [5.8, 0.55, 0]], PIG.violet, 1.2, 0.55, true);
    render(ctx, cam, S);
  },
};
export default world;
