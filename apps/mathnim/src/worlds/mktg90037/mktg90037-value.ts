// The same product, worth different amounts to different people: one product, so one cost floor (ochre, the same in
// every column); three customers, each with their own value ceiling (teal) at their own height. Seen from the front at
// rest; in the world, the people stand behind their columns.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { say, type LessonWorld } from '../../lesson_worlds';
import { frame, words } from '../_kit';
import { person, worth } from './_mktg';

const V = [1.5, 2.6, 2.0];
const world: LessonWorld = {
  view: 'front',
  draw(ctx, w, h, st) {
    const cam = turned(st.top, true), S: Solid[] = [];
    V.forEach((v, i) => { S.push(...worth(i * 1.9, 0.8, v)); S.push(...person(i * 1.9 + 0.75, 0, { pig: 'teal', k: 1, tint: 0.25 }, 0.75)); });
    frame(cam, S, w, h, [12, 14, 12, 12], [[5.9, 0, 0]]);
    render(ctx, cam, S);
    words(ctx, cam, say(st, 'cost', '成本'), [5.1, 0.32, 0.45], PIG.ochre, 10.5, 'left');
    words(ctx, cam, say(st, 'value', '价值'), [5.1, V[2] + 0.02, 0.45], PIG.teal, 10.5, 'left');
  },
};
export default world;
