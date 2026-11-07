// Framing and errors: byte stuffing, and correcting or detecting. A frame's bytes between its two flags (ink); a byte in
// the data that looks like a flag (ochre) would end the frame early, so an escape byte is put in front of it (teal),
// and the receiver removes it. Seen from above at rest; in the world, the stuffed byte rises.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { frame, words } from '../_kit';

const B: [string, string | undefined, number][] = [['F', 'ink', 0.7], ['A', 'violet', 0.3], ['B', 'violet', 0.3], ['E', 'teal', 0.55], ['F', 'ochre', 0.5], ['C', 'violet', 0.3], ['D', 'violet', 0.3], ['F', 'ink', 0.7]];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [], D = 0.8;
    B.forEach(([, pig, tint], i) => S.push(box(i * D, 0, 0, i * D + 0.7, 0.06 + (i === 3 ? 0.45 : 0.15) * u, 0.7, { pig, k: 1, tint })));
    frame(cam, S, w, h, [12, 12, 12, 22], [[3 * D, 0, 1.25]]);
    render(ctx, cam, S);
    B.forEach(([t, pig], i) => { if (pig !== 'ink') words(ctx, cam, t === 'E' ? 'ESC' : t === 'F' ? 'FLAG' : t, [i * D + 0.35, 0.06 + (i === 3 ? 0.45 : 0.15) * u, 0.45], PIG.ink, 8.5, 'center', 0.75, 600); });
    words(ctx, cam, say(st, 'escape', '转义'), [3 * D + 0.35, 0.03, 1.2], PIG.teal, 10.5);
  },
};
export default world;
