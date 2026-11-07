// Framing and error control: find a frame, find an error, even fix it. A frame as its parts: the flags at each end that
// mark where it starts and stops (ink), the header, the data, and the check (teal) computed from them; one bit of the
// data flipped on the way (ochre): the check no longer matches. Seen from above at rest; in the world, the parts rise.
import { PIG, box, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { frame, words } from '../_kit';

// width, pigment, tint, name
const PARTS: [number, string | undefined, number, string, string][] = [[0.35, 'ink', 0.7, '', ''], [1.0, 'violet', 0.25, 'header', '帧头'], [3.2, 'violet', 0.5, 'data', '数据'], [0.9, 'teal', 0.55, 'check', '校验'], [0.35, 'ink', 0.7, '', '']];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [];
    let x = 0;
    const at: number[] = [];
    for (const [wd, pig, tint] of PARTS) { at.push(x); S.push(box(x, 0, 0, x + wd - 0.05, 0.1 + 0.3 * u, 0.9, { pig, k: 1, tint })); x += wd; }
    const bx = at[2] + 1.9;
    S.push(box(bx, 0.1 + 0.3 * u, 0.25, bx + 0.25, 0.14 + 0.3 * u + 0.15 * u, 0.65, { pig: 'ochre', k: 1, tint: 0.8 }));
    frame(cam, S, w, h, [12, 12, 12, 22], [[0, 0, 1.4]]);
    render(ctx, cam, S);
    PARTS.forEach(([wd, , , en, zh], i) => { if (en) words(ctx, cam, say(st, en, zh), [at[i] + wd / 2, 0.02, 1.32], i === 3 ? PIG.teal : PIG.violet, 10.5); });
  },
};
export default world;
