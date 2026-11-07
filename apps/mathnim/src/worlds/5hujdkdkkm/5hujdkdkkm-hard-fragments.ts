// Fragmenting a datagram: lengths, offsets and the MF flag. One datagram too big for the next link (above) is cut into
// three (below), each with its own header (grey) and a share of the data (violet); each carries where its data starts
// (the offset, in eight-byte units) and whether more follow (MF = 1, 1, 0). Seen from above at rest.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { frame, words } from '../_kit';

const HD = 0.4, L = 6.0, PARTS: [number, number, string][] = [[0, 2.2, '0 · MF=1'], [2.2, 4.4, '185 · MF=1'], [4.4, L, '370 · MF=0']];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [], hh = 0.06 + 0.2 * u;
    S.push(box(0, 0, 0, HD, hh, 0.6, { shade: 0.6 }), box(HD, 0, 0, HD + L, hh, 0.6, { pig: 'violet', k: 1, tint: 0.5 }));
    let x = 0;
    PARTS.forEach(([a, b]) => { S.push(box(x, 0, 1.5, x + HD, hh, 2.1, { shade: 0.6 }), box(x + HD, 0, 1.5, x + HD + (b - a), hh, 2.1, { pig: 'violet', k: 1, tint: 0.5 })); x += HD + (b - a) + 0.35; });
    frame(cam, S, w, h, [12, 12, 12, 22], [[0, 0, 2.55]]);
    render(ctx, cam, S);
    x = 0;
    PARTS.forEach(([a, b, t]) => { words(ctx, cam, t, [x + HD + (b - a) / 2, 0.03, 2.5], PIG.violet, 10, 'center', 0.95, 600); x += HD + (b - a) + 0.35; });
  },
};
export default world;
