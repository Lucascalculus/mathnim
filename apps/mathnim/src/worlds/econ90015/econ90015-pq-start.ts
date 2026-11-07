// The predicted questions: eight cards drawn in dashes (predicted, not yet set), each with the diagram it will be
// solved on: a tax and a price cap, pollution, costs, pricing, two sellers, games, growth, the macro identity.
// Seen from above at rest; in the world, the cards lift.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { card, frame, words } from '../_kit';
import { glyph } from './_econ';

const G = ['tax', 'pollution', 'costs', 'pricing', 'oligopoly', 'games', 'growth', 'macro'], S = 1.3;
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S0: Solid[] = [];
    G.forEach((_, i) => { const x = (i % 4) * 1.6, z = Math.floor(i / 4) * 1.6; S0.push(card(x, z, x + S, z + S, { kind: 'wire', pig: 'graphite', solid: 0, alpha: 0.6 }, 0.12 * u, 0.04)); });
    frame(cam, S0, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S0);
    G.forEach((g, i) => {
      const x = (i % 4) * 1.6, z = Math.floor(i / 4) * 1.6;
      glyph(ctx, cam, g, x, z, S, 0.9, 0.12 * u + 0.042);
      words(ctx, cam, String(i + 1), [x + S - 0.12, 0.12 * u + 0.04, z + 0.3], PIG.graphite_t, 9.5, 'right', 0.9);
    });
  },
};
export default world;
