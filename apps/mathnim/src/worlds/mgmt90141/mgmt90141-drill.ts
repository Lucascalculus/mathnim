// Can you do it against the clock? A stopwatch (its hand, and the time used as a cobalt arc round the rim) and the
// timed questions beside it, the ones done ticked. Seen from above at rest; in the world, the watch stands thick.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { arc, card, disc, frame, ink } from '../_kit';

const USED = 0.62;
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [], R = 1.5, th = 0.08 + 0.25 * u;
    S.push(disc([0, 0], R, th, { shade: 0.6 }), box(-0.18, 0, -R - 0.32, 0.18, th, -R + 0.02, { shade: 0.6 }));
    for (let i = 0; i < 4; i++) S.push(card(2.4, -1.4 + i * 0.75, 5.2, -0.85 + i * 0.75, { shade: 0.5 }));
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    const y = th + 0.004, a0 = -Math.PI / 2, a1 = a0 + USED * Math.PI * 2;
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; ink(ctx, cam, [[Math.cos(a) * (R - 0.32), y, Math.sin(a) * (R - 0.32)], [Math.cos(a) * (R - 0.45), y, Math.sin(a) * (R - 0.45)]], PIG.ink, 1, 0.6); }
    ink(ctx, cam, arc([0, 0], R - 0.15, a0, a1, 60, y), PIG.cobalt, 5, 0.85);
    ink(ctx, cam, [[0, y, 0], [Math.cos(a1) * (R - 0.4), y, Math.sin(a1) * (R - 0.4)]], PIG.ink, 2, 0.9);
    for (let i = 0; i < 4; i++) {
      const z = -1.125 + i * 0.75, done = i < 3;
      ink(ctx, cam, [[2.65, 0.052, z], [2.65 + (i === 3 ? 1.2 : 1.8), 0.052, z]], PIG.graphite_t, 1.2, 0.5);
      if (done) ink(ctx, cam, [[4.65, 0.052, z], [4.75, 0.052, z + 0.1], [4.95, 0.052, z - 0.13]], PIG.viridian, 1.6, 0.95);
    }
  },
};
export default world;
