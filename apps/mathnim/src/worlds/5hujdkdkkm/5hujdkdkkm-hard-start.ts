// Start here, the hard questions that keep coming up: seven of them as cards, each with its drawing: check bits, the
// shortest Ethernet frame, fragments, address blocks, shortest paths, a window over a satellite, the arithmetic of
// keys. Seen from above at rest; in the world, the cards lift.
import { PIG, render, turned, type Solid } from '../../course_worlds';
import { turn, type LessonWorld } from '../../lesson_worlds';
import { card, frame, words } from '../_kit';
import { it_glyph } from './_it';

const G = ['codes', 'ethernet', 'fragment', 'cidr', 'graph', 'satellite', 'keys'], S = 1.2;
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S0: Solid[] = [];
    G.forEach((_, i) => { const x = (i % 4) * 1.45 + (i >= 4 ? 0.72 : 0), z = Math.floor(i / 4) * 1.5; S0.push(card(x, z, x + S, z + S, { shade: 0.6 }, 0, 0.05 + 0.2 * u)); });
    frame(cam, S0, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S0);
    G.forEach((g, i) => { const x = (i % 4) * 1.45 + (i >= 4 ? 0.72 : 0), z = Math.floor(i / 4) * 1.5; it_glyph(ctx, cam, g, x, z, S, 0.052 + 0.2 * u); words(ctx, cam, String(i + 1), [x + S - 0.1, 0.05 + 0.2 * u, z + 0.28], PIG.graphite_t, 9.5, 'right', 0.9); });
  },
};
export default world;
