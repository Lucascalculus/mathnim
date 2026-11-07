// Every answering pattern on one page, and a set of exercises: the page (left), a row per pattern with its drawing
// and its steps; the exercises beside it (cards, the top one being worked). Seen from above at rest.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { card, frame, ink } from '../_kit';
import { it_glyph } from './_it';

const ROWS = ['bus', 'ports', 'tahoe', 'rtt', 'blocks', 'auth'], STEPS = [0.85, 0.6, 0.9, 0.7, 0.55, 0.8];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [card(0, 0, 4.2, 5.6, { shade: 0.6 })];
    for (let i = 0; i < 4; i++) S.push(card(5.0 + i * 0.12, 1.0 - i * 0.16, 7.4 + i * 0.12, 4.4 - i * 0.16, { bias: i, shade: 0.5 }, i * (0.03 + 0.12 * u), 0.04));
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    ROWS.forEach((g, i) => {
      const z = 0.2 + i * 0.88;
      it_glyph(ctx, cam, g, 0.2, z, 0.8);
      for (let k = 0; k < 2; k++) ink(ctx, cam, [[1.2, 0.052, z + 0.3 + k * 0.26], [1.2 + 2.7 * (k ? STEPS[i] * 0.7 : STEPS[i]), 0.052, z + 0.3 + k * 0.26]], PIG.graphite_t, 1.2, 0.55);
    });
    const ty = 3 * (0.03 + 0.12 * u) + 0.042, x0 = 5.36, z0 = 0.52;
    for (let k = 0; k < 4; k++) ink(ctx, cam, [[x0 + 0.25, ty, z0 + 0.5 + k * 0.42], [x0 + 0.25 + (k === 3 ? 1.1 : 1.9), ty, z0 + 0.5 + k * 0.42]], PIG.graphite_t, 1.2, 0.55);
    ink(ctx, cam, [[x0 + 0.25, ty, z0 + 2.4], [x0 + 1.4, ty, z0 + 2.4]], PIG.violet, 1.5, 0.85);
  },
};
export default world;
