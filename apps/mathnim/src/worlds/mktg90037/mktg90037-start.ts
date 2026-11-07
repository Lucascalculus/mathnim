// What a scoring answer is made of: one answer as a column of its three parts, each marked on its own: explain the
// theory (cobalt), apply it to this brand's facts (teal, the biggest), recommend, two moves that follow from the
// analysis (ochre). Seen from the front at rest.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { say, type LessonWorld } from '../../lesson_worlds';
import { frame, ink, words } from '../_kit';

const PARTS: [number, string, string, string][] = [[0.8, 'explain', '解释', 'cobalt'], [1.4, 'apply', '应用', 'teal'], [0.7, 'recommend', '建议', 'ochre']];
const world: LessonWorld = {
  view: 'front',
  draw(ctx, w, h, st) {
    const cam = turned(st.top, true), S: Solid[] = [];
    let y = 0;
    PARTS.forEach(([hh, , , pig], i) => {
      if (i < 2) S.push(box(-0.9, y, -0.6, 0.9, y + hh - 0.06, 0.6, { pig, k: 1, tint: 0.42, shade: 0.6 }));
      else { S.push(box(-0.9, y, -0.6, -0.04, y + hh - 0.06, 0.6, { pig, k: 1, tint: 0.42, shade: 0.6 }), box(0.04, y, -0.6, 0.9, y + hh - 0.06, 0.6, { pig, k: 1, tint: 0.42, shade: 0.6 })); }
      y += hh;
    });
    frame(cam, S, w, h, [12, 14, 12, 12], [[-2.8, 0, 0], [2.8, 0, 0]]);
    render(ctx, cam, S);
    y = 0;
    PARTS.forEach(([hh, en, zh, pig]) => {
      ink(ctx, cam, [[0.95, y + hh / 2, 0.6], [1.35, y + hh / 2, 0.6]], PIG.ink, 0.8, 0.6);
      words(ctx, cam, say(st, en, zh), [1.45, y + hh / 2 - 0.08, 0.6], PIG[pig], 11, 'left');
      y += hh;
    });
  },
};
export default world;
