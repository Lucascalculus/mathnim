// The map: the paper's six questions as six cards, in the order the course takes them, each with the diagram it is
// solved on: markets (the quota, the long run), market power (the monopoly, pricing by type, two firms), growth (the
// Malthusian trap). Seen from above at rest; in the world, the cards stand up a little, in their groups.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { card, frame, words } from '../_kit';
import { glyph } from './_econ';

const CARDS: [string, number, string][] = [['quota', 1, 'teal'], ['longrun', 5, 'teal'], ['monopoly', 2, 'cobalt'], ['two', 3, 'cobalt'], ['cournot', 4, 'cobalt'], ['malthus', 6, 'viridian']];
const X = [0, 1.55, 3.45, 5.0, 6.55, 8.45], S = 1.35;
const GROUPS: [number, string, string, string][] = [[0.75 + 0.03, 'markets', '市场', 'teal'], [5.0 + 0.68, 'market power', '市场势力', 'cobalt'], [8.45 + 0.68, 'growth', '增长', 'viridian']];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S0: Solid[] = [];
    CARDS.forEach(([, , pig], i) => S0.push(card(X[i], 0, X[i] + S, S, { pig, k: 1, tint: 0.12 }, 0, 0.05 + 0.25 * u)));
    frame(cam, S0, w, h, [12, 14, 12, 26], [[4.9, 0, S + 0.75]]);
    render(ctx, cam, S0);
    const top = 0.05 + 0.25 * u;
    CARDS.forEach(([g, n], i) => {
      glyph(ctx, cam, g, X[i], 0, S, 1, top + 0.002);
      words(ctx, cam, String(n), [X[i] + S - 0.14, top, 0.3], PIG.graphite_t, 9.5, 'right', 0.9, 600);
    });
    for (const [x, en, zh, pig] of GROUPS) words(ctx, cam, say(st, en, zh), [x, 0.05, S + 0.55], PIG[pig], 10.5);
  },
};
export default world;
