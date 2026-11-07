// What to measure in marketing, and what goes wrong: the customer funnel, from everyone who hears of you to the loyal
// few, as stacked plates narrowing downward; a metric near the top (clicks, likes) is easy to grow and far from
// profit, the ones near the bottom matter. Seen from the front at rest.
import { PIG, cylinder_y, render, turned, type Solid } from '../../course_worlds';
import { say, type LessonWorld } from '../../lesson_worlds';
import { frame, ink, words } from '../_kit';

const LV: [number, string, string][] = [[1.9, 'aware', '知道'], [1.45, 'consider', '考虑'], [1.0, 'buy', '购买'], [0.6, 'loyal', '忠诚']];
const world: LessonWorld = {
  view: 'front',
  draw(ctx, w, h, st) {
    const cam = turned(st.top, true), S: Solid[] = [], dy = 0.48;
    LV.forEach(([r], i) => { const y = (LV.length - 1 - i) * dy; S.push(cylinder_y(0, 0, r, y, y + dy - 0.06, 40, { pig: 'cobalt', k: 1, tint: 0.15 + i * 0.13, shade: 0.6, bias: i })); });
    frame(cam, S, w, h, [12, 12, 12, 12], [[3.6, 0, 0], [-2.0, 0, 0]]);
    render(ctx, cam, S);
    LV.forEach(([r, en, zh], i) => { const y = (LV.length - 1 - i) * dy + dy / 2 - 0.03; ink(ctx, cam, [[r + 0.05, y, 0], [2.2, y, 0]], PIG.ink, 0.8, 0.45); words(ctx, cam, say(st, en, zh), [2.3, y - 0.07, 0], i === 3 ? PIG.cobalt : PIG.ink, 10.5, 'left', 0.95, i === 3 ? 650 : 500); });
  },
};
export default world;
