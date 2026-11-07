// The best angle to shoot: a winger runs straight up the wing toward the goal line (dashes); where is the goal widest?
// Where the circle through both posts just touches the run (dashes): there the angle at the runner (teal) is largest.
// Seen from above at rest, the plan of the pitch; in the world, the goal stands up and the runner with it.
import { PIG, box, cylinder_y, render, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { arrow3, card, frame, ink, words } from '../_kit';
import { angle, arc, at, type P2 } from './_math';

const G = 1.0, X = 2.2, ZC = Math.sqrt(X * X - G * G), L: P2 = [-G, 0], RP: P2 = [G, 0], P: P2 = [X, ZC];
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), hg = 0.06 + 0.75 * u;
    const pitch = card(-4.9, -0.5, 3.0, 4.6, { bias: -10 });
    pitch.after = (c: CanvasRenderingContext2D) => {
      ink(c, cam, [at([-4.9, 0]), at([3.0, 0])], PIG.ink, 1, 0.6);
      ink(c, cam, arc([0, ZC], X, 0, Math.PI * 2, 96), PIG.graphite_t, 1, 0.55, true);
      ink(c, cam, [at(L), at(P), at(RP)], PIG.ink, 1.2, 0.8);
      angle(c, cam, P, L, RP, 0.95, PIG.teal, 0.4);
    };
    const S: Solid[] = [pitch, box(-G - 0.06, 0, -0.06, -G + 0.06, hg, 0.06, { shade: 0.6 }), box(G - 0.06, 0, -0.06, G + 0.06, hg, 0.06, { shade: 0.6 }),
      cylinder_y(P[0], P[1], 0.12, 0.05, 0.1 + 0.5 * u, 16, { pig: 'cobalt', k: 1, tint: 0.55 })];
    if (u > 0.02) S.push(box(-G - 0.06, hg - 0.1, -0.05, G + 0.06, hg, 0.05, { shade: 0.6 }));
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    arrow3(ctx, cam, at([X, 4.3]), at([X, 0.25]), PIG.cobalt, 1.2, 0.75, true);
    words(ctx, cam, say(st, 'widest', '最宽'), at([X - 1.05, ZC + 0.08]), PIG.teal, 11, 'right');
  },
};
export default world;
