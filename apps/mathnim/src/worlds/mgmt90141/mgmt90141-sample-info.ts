// How a test result changes your mind: a thousand imagined cases (dots), split by the truth: strong demand (left, the
// few) and weak (right, the many). A report that is 90% reliable marks most of the left and some of the right (dark).
// Among the dark dots, a good share are from the right: "90% reliable" is not "90% sure". In the world, the dark stand up.
import { PIG, cylinder_y, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { card, frame, words } from '../_kit';

const ROWS = 10, LC = 6, RC = 14, D = 0.3;
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [card(-0.3, -0.3, (LC + RC) * D + 0.75, ROWS * D + 0.0, { bias: -10 })];
    const dot = (x: number, z: number, dark: boolean) => S.push(cylinder_y(x, z, 0.085, 0.05, 0.05 + 0.02 + (dark ? 0.35 * u : 0.02), 10, dark ? { pig: 'cobalt', k: 1, tint: 0.65, shadow: false } : { pig: 'ink', k: 1, tint: 0.08, shadow: false }));
    for (let c = 0; c < LC; c++) for (let r = 0; r < ROWS; r++) dot(c * D, r * D, r >= 1 || c < 0); // 54 of 60 marked
    for (let c = 0; c < RC; c++) for (let r = 0; r < ROWS; r++) dot(LC * D + 0.45 + c * D, r * D, r < 2); // 28 of 140 marked
    frame(cam, S, w, h, [12, 12, 12, 22], [[1, 0, ROWS * D + 0.45]]);
    render(ctx, cam, S);
    words(ctx, cam, say(st, 'strong demand', '需求强'), [(LC - 1) * D / 2, 0.05, ROWS * D + 0.35], PIG.ink, 10.5);
    words(ctx, cam, say(st, 'weak demand', '需求弱'), [LC * D + 0.45 + (RC - 1) * D / 2, 0.05, ROWS * D + 0.35], PIG.ink, 10.5);
  },
};
export default world;
