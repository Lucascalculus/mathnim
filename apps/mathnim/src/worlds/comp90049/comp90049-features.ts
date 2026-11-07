// Feature selection, filter, wrapper, embedded: each feature scored for how much it tells about the class (bars, seen
// from the front); a filter keeps those above a threshold (dashes) and drops the rest (drawn in dashes). Seen from the
// front at rest.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { say, type LessonWorld } from '../../lesson_worlds';
import { frame, ink, words } from '../_kit';

const SC = [0.9, 0.25, 0.7, 0.15, 0.55, 0.35, 0.8, 0.1], T = 0.45, H = 2.4;
const world: LessonWorld = {
  view: 'front',
  draw(ctx, w, h, st) {
    const cam = turned(st.top, true), S: Solid[] = [];
    SC.forEach((s, i) => S.push(box(i * 0.7, 0, -0.25, i * 0.7 + 0.5, s * H, 0.25, s > T ? { pig: 'cobalt', k: 1, tint: 0.5 } : { kind: 'wire', pig: 'graphite', solid: 0, alpha: 0.7 })));
    frame(cam, S, w, h, [12, 14, 12, 12], [[SC.length * 0.7 + 1.3, 0, 0]]);
    render(ctx, cam, S);
    ink(ctx, cam, [[-0.2, T * H, 0.26], [SC.length * 0.7, T * H, 0.26]], PIG.ink, 1.1, 0.8, true);
    words(ctx, cam, say(st, 'threshold', '阈值'), [SC.length * 0.7 + 0.08, T * H - 0.07, 0.26], PIG.ink, 10.5, 'left', 0.85, 500);
  },
};
export default world;
