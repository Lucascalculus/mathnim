// When you cannot say how likely each future is: three options, each with its worst and best payoff (the ends of its
// line). A dial runs from pessimist to optimist; each option scores a mix of its worst and best (the bar, to the dot),
// and the longest bar wins (cobalt). Turn the dial and the winner changes. In the world, the scores rise.
import { PIG, box, render, ring_dot, turned, type Solid } from '../../course_worlds';
import { say, turn, type LessonWorld } from '../../lesson_worlds';
import { card, frame, ink, words } from '../_kit';
import { arc, wedge } from '../_kit';

const OPT: [string, number, number][] = [['A', -0.1, 0.95], ['B', 0.25, 0.6], ['C', 0.35, 0.45]], AL = 0.45, X0 = 0.6, XW = 4.2;
const world: LessonWorld = {
  draw(ctx, w, h, st) {
    const u = turn(st), cam = turned(st.top), S: Solid[] = [card(0, 0, 8.2, 3.6, { bias: -10 })];
    const score = OPT.map(([, lo, hi]) => AL * hi + (1 - AL) * lo), win = score.indexOf(Math.max(...score));
    const X = (v: number) => X0 + 0.5 + v * XW;
    OPT.forEach((_, i) => { const z = 0.6 + i * 1.0; S.push(box(X(0), 0.05, z - 0.18, X(score[i]), 0.05 + 0.004 + 0.4 * u * score[i], z + 0.18, { pig: 'cobalt', k: 1, tint: i === win ? 0.55 : 0.18, shade: 0.6 })); });
    const dc: [number, number] = [6.9, 2.3];
    S.push(wedge(dc, 0.95, Math.PI, Math.PI * 2, 0.05, 0.04, { shade: 0.6 }));
    frame(cam, S, w, h, [12, 12, 12, 12]);
    render(ctx, cam, S);
    ink(ctx, cam, [[X(0), 0.06, 0.2], [X(0), 0.06, 3.1]], PIG.ink, 0.9, 0.6);
    OPT.forEach(([name, lo, hi], i) => {
      const z = 0.6 + i * 1.0, y = 0.06;
      ink(ctx, cam, [[X(lo), y, z], [X(hi), y, z]], PIG.ink, 1.1, 0.8);
      for (const [v, pig] of [[lo, PIG.ochre], [hi, PIG.teal]] as const) ink(ctx, cam, [[X(v), y, z - 0.2], [X(v), y, z + 0.2]], pig, 2, 0.95);
      const p = cam.p([X(score[i]), 0.06 + 0.4 * u * score[i], z]); ring_dot(ctx, p[0], p[1], 3.5, PIG.cobalt, 1, 1.2);
      words(ctx, cam, name, [X0 - 0.1, y, z + 0.13], i === win ? PIG.cobalt : PIG.ink, 12, 'center', 0.95, 650);
    });
    ink(ctx, cam, arc(dc, 0.95, Math.PI, Math.PI * 2, 40, 0.095), PIG.ink, 1, 0.6);
    const ang = Math.PI + AL * Math.PI;
    ink(ctx, cam, [[dc[0], 0.095, dc[1]], [dc[0] + 0.8 * Math.cos(ang), 0.095, dc[1] + 0.8 * Math.sin(ang)]], PIG.ink, 2, 0.9);
    words(ctx, cam, say(st, 'pessimist', '悲观'), [dc[0] - 0.95, 0.06, dc[1] + 0.35], PIG.ochre, 10, 'center');
    words(ctx, cam, say(st, 'optimist', '乐观'), [dc[0] + 0.95, 0.06, dc[1] + 0.35], PIG.teal, 10, 'center');
  },
};
export default world;
