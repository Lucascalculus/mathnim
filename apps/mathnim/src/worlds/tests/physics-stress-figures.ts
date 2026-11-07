// Physics on the engine (a stress test): a pendulum seen from the front, its swing (dashes) and the bob at the end of
// it, and two point charges (cobalt +, ochre −) pulling on each other (arrows). Seen from the front at rest; in the
// world, the frame and the charges stand in depth.
import { PIG, box, cylinder_y, render, turned, type Solid, type V3 } from '../../course_worlds';
import { type LessonWorld } from '../../lesson_worlds';
import { arrow3, frame, ink, words } from '../_kit';

const L = 2.4, A = 0.55, PV: V3 = [0, 3.0, 0];
const world: LessonWorld = {
  view: 'front',
  draw(ctx, w, h, st) {
    const cam = turned(st.top, true), S: Solid[] = [], b: V3 = [PV[0] + L * Math.sin(A), PV[1] - L * Math.cos(A), 0];
    S.push(box(-1.6, 3.0, -0.2, 1.6, 3.15, 0.2, { shade: 0.6 }), box(-1.6, 0, -0.2, -1.45, 3.0, 0.2, { shade: 0.6 }));
    S.push(cylinder_y(b[0], 0, 0.22, b[1] - 0.22, b[1] + 0.22, 20, { pig: 'violet', k: 1, tint: 0.55 }));
    S.push(cylinder_y(3.2, 0, 0.26, 1.0, 1.5, 20, { pig: 'cobalt', k: 1, tint: 0.55 }), cylinder_y(5.4, 0, 0.26, 1.0, 1.5, 20, { pig: 'ochre', k: 1, tint: 0.55 }));
    frame(cam, S, w, h, [12, 12, 12, 12], [[0, -0.2, 0]]);
    const arc: V3[] = []; for (let i = 0; i <= 30; i++) { const t = -A + (2 * A * i) / 30; arc.push([PV[0] + L * Math.sin(t), PV[1] - L * Math.cos(t), 0]); }
    ink(ctx, cam, arc, PIG.graphite_t, 1, 0.6, true);
    ink(ctx, cam, [PV, b], PIG.ink, 1.3, 0.85);
    render(ctx, cam, S);
    arrow3(ctx, cam, [3.55, 1.25, 0.3], [4.3, 1.25, 0.3], PIG.cobalt, 1.4, 0.9); arrow3(ctx, cam, [5.05, 1.25, 0.3], [4.4, 1.25, 0.3], PIG.ochre, 1.4, 0.9);
    words(ctx, cam, '+', [3.2, 1.65, 0.3], PIG.cobalt, 13, 'center', 0.95, 650); words(ctx, cam, '−', [5.4, 1.65, 0.3], PIG.ochre, 13, 'center', 0.95, 650);
  },
};
export default world;
